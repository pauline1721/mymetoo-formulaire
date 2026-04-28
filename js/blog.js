import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPaxlstCCCIJ_gwCSAI2cNt23yu8iLaK0",
  authDomain: "mymetoo-formulaire.firebaseapp.com",
  projectId: "mymetoo-formulaire",
  storageBucket: "mymetoo-formulaire.firebasestorage.app",
  messagingSenderId: "1084270329845",
  appId: "1:1084270329845:web:337a6172a4817f0db2eabc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentPseudo = "Anonyme";
let currentUserData = null;
let currentPrivateUser = null;
let currentRoom = "general";

let currentReportMode = null;
let currentReportTarget = null;

let presenceInterval = null;
let unsubscribeMembers = null;
let unsubscribePublicMessages = null;
let unsubscribePrivateList = null;
let unsubscribePrivateChat = null;

const roomTitles = {
  general: "💬 Salon général",
  entraide: "💜 Salon entraide",
  anonyme: "🕊️ Salon anonyme",
  region: "📍 Salon région",
  premium: "⭐ Salon premium"
};

function getChatId(uid1, uid2){
  return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
}

/* ================= LOGIN ================= */

window.login = async function(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const status = document.getElementById("loginStatus");

  status.textContent = "Connexion en cours...";

  try{
    await signInWithEmailAndPassword(auth, email, password);
    status.textContent = "Connexion réussie ✅";
  }catch{
    status.textContent = "Email ou mot de passe incorrect.";
  }
};

window.logout = async function(){
  closeMenu();
  const user = auth.currentUser;

  if(user){
    await updateDoc(doc(db,"blogUsers",user.uid),{
      online:false,
      lastSeen:serverTimestamp()
    });
  }

  if(presenceInterval) clearInterval(presenceInterval);
  if(unsubscribeMembers) unsubscribeMembers();
  if(unsubscribePublicMessages) unsubscribePublicMessages();
  if(unsubscribePrivateList) unsubscribePrivateList();
  if(unsubscribePrivateChat) unsubscribePrivateChat();

  await signOut(auth);
};

window.resetPassword = async function(){
  const email = document.getElementById("email").value.trim();
  const status = document.getElementById("loginStatus");

  if(!email){
    status.textContent = "Entre ton email avant de réinitialiser le mot de passe.";
    return;
  }

  try{
    await sendPasswordResetEmail(auth, email);
    status.textContent = "Email de réinitialisation envoyé ✅";
  }catch{
    status.textContent = "Impossible d’envoyer l’email de réinitialisation.";
  }
};

/* ================= AUTH STATE ================= */

onAuthStateChanged(auth, async user => {
  if(user){
    const snap = await getDoc(doc(db,"blogUsers",user.uid));

    if(!snap.exists()){
      await signOut(auth);
      return;
    }

    currentUserData = snap.data();

    if(currentUserData.active === false){
      await signOut(auth);
      document.getElementById("loginStatus").textContent = "Ce compte est désactivé.";
      return;
    }

    currentPseudo = currentUserData.pseudo || "Anonyme";

    await updateDoc(doc(db,"blogUsers",user.uid),{
      online:true,
      lastSeen:serverTimestamp()
    });

    if(presenceInterval) clearInterval(presenceInterval);

    presenceInterval = setInterval(async () => {
      if(auth.currentUser){
        await updateDoc(doc(db,"blogUsers",auth.currentUser.uid),{
          online:true,
          lastSeen:serverTimestamp()
        });
      }
    }, 10000);

    document.getElementById("welcomePseudo").innerText = "Connecté(e) : " + currentPseudo;
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("blogContent").style.display = "block";
    document.getElementById("menuButton").style.display = "block";

    loadMembers();
    loadPublicMessages();
    loadPrivateConversations();

  }else{
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("blogContent").style.display = "none";
    document.getElementById("menuButton").style.display = "none";
  }
});

/* ================= SALONS ================= */

window.switchRoom = function(room){
  currentRoom = room;

  document.querySelectorAll(".room-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.getElementById("room-" + room);
  if(activeBtn) activeBtn.classList.add("active");

  const title = document.getElementById("activeRoomTitle");
  if(title) title.innerText = roomTitles[room] || "💬 Salon";

  loadPublicMessages();
};

/* ================= MEMBRES + FILTRES ================= */

function loadMembers(){
  const container = document.getElementById("membersList");
  if(!container) return;

  if(unsubscribeMembers) unsubscribeMembers();

  unsubscribeMembers = onSnapshot(collection(db,"blogUsers"), snap => {
    container.innerHTML = "";

    const blocked = currentUserData?.blockedUsers || [];

    const search = (document.getElementById("memberSearch")?.value || "").toLowerCase().trim();
    const filterAge = document.getElementById("filterAge")?.value || "";
    const filterGenre = document.getElementById("filterGenre")?.value || "";
    const filterDepartement = (document.getElementById("filterDepartement")?.value || "").toLowerCase().trim();

    let count = 0;

    snap.forEach(docSnap => {
      const uid = docSnap.id;
      const data = docSnap.data();

      if(!auth.currentUser) return;
      if(uid === auth.currentUser.uid) return;
      if(data.active === false) return;
      if(data.online !== true) return;
      if(blocked.includes(uid)) return;

      const pseudo = (data.pseudo || "Anonyme").toLowerCase();
      const age = data.age || "";
      const genre = data.genre || "";
      const departement = (data.departement || "").toLowerCase();

      if(search && !pseudo.includes(search)) return;
      if(filterAge && age !== filterAge) return;
      if(filterGenre && genre !== filterGenre) return;
      if(filterDepartement && !departement.includes(filterDepartement)) return;

      count++;

      const div = document.createElement("div");
      div.className = "member";
      div.innerText = data.pseudo || "Anonyme";

      div.onclick = function(){
        openMemberProfile(uid, data);
      };

      container.appendChild(div);
    });

    if(count === 0){
      container.innerHTML = `<div class="member">Aucun membre trouvé</div>`;
    }
  });
}

window.loadMembers = loadMembers;

/* ================= CHAT PUBLIC ================= */

function loadPublicMessages(){
  const container = document.getElementById("messages");
  if(!container) return;

  if(unsubscribePublicMessages) unsubscribePublicMessages();

  const isPremium =
    currentUserData?.premium === true ||
    currentUserData?.plan === "premium";

  const q = isPremium
    ? query(collection(db,"blogMessages"), orderBy("createdAt","asc"))
    : query(collection(db,"blogMessages"), orderBy("createdAt","desc"), limit(30));

  unsubscribePublicMessages = onSnapshot(q, snap => {
    container.innerHTML = "";

    let messages = [];

    snap.forEach(docSnap => {
      const m = docSnap.data();

      if(m.visible === false) return;

      const room = m.room || "general";
      if(room !== currentRoom) return;

      messages.push(m);
    });

    if(!isPremium){
      messages = messages.slice(0, 5).reverse();
    }

    messages.forEach(m => {
      const div = document.createElement("div");
      div.className = "msg";

      const displayedPseudo = currentRoom === "anonyme"
        ? "Anonyme"
        : (m.pseudo || "Anonyme");

      div.innerHTML = `
        <div class="msg-meta">${displayedPseudo}</div>
        ${m.message || ""}
        ${m.imageUrl ? `<img src="${m.imageUrl}" class="chat-img">` : ""}
      `;

      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  });
}

window.sendMessage = async function(){
  const text = document.getElementById("chatMessage").value.trim();
  if(!text) return;

  const user = auth.currentUser;
  if(!user) return;

  await addDoc(collection(db,"blogMessages"),{
    uid:user.uid,
    pseudo:currentPseudo,
    message:text,
    type:"text",
    room:currentRoom,
    visible:true,
    createdAt:serverTimestamp()
  });

  document.getElementById("chatMessage").value = "";
};

window.sendPublicImage = async function(){
  const input = document.getElementById("publicImageInput");
  const file = input.files[0];
  const user = auth.currentUser;

  if(!file || !user) return;

  const storageRef = ref(storage, "images/" + user.uid + "/" + Date.now() + "_" + file.name);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db,"blogMessages"),{
    uid:user.uid,
    pseudo:currentPseudo,
    imageUrl:url,
    message:"",
    type:"image",
    room:currentRoom,
    visible:true,
    createdAt:serverTimestamp()
  });

  input.value = "";
};

/* ================= MENU / PROFIL ================= */

window.openMenu = function(){
  document.getElementById("sideMenu").classList.add("open");
  document.getElementById("menuOverlay").classList.add("open");
};

window.closeMenu = function(){
  document.getElementById("sideMenu").classList.remove("open");
  document.getElementById("menuOverlay").classList.remove("open");
};

window.openMyProfile = function(){
  closeMenu();

  const user = auth.currentUser;
  if(!user) return;

  document.getElementById("myProfilePseudo").innerText = currentUserData?.pseudo || "";
  document.getElementById("myProfileAge").innerText = currentUserData?.age || "";
  document.getElementById("myProfileGenre").innerText = currentUserData?.genre || "";
  document.getElementById("myProfileDepartement").innerText = currentUserData?.departement || "";
  document.getElementById("myProfileEmail").innerText = user.email || "";

  document.getElementById("profileView").style.display = "block";
  document.getElementById("profileEdit").style.display = "none";
  document.getElementById("profileUpdateStatus").textContent = "";
  document.getElementById("myProfileModal").style.display = "block";
};

window.closeMyProfile = function(){
  document.getElementById("myProfileModal").style.display = "none";
};

window.openEditProfile = function(){
  document.getElementById("profileView").style.display = "none";
  document.getElementById("profileEdit").style.display = "block";

  document.getElementById("profileEmailEdit").value = auth.currentUser.email || "";
  document.getElementById("profileAgeEdit").value = currentUserData?.age || "";
  document.getElementById("profileDepartementEdit").value = currentUserData?.departement || "";
};

window.cancelEditProfile = function(){
  document.getElementById("profileView").style.display = "block";
  document.getElementById("profileEdit").style.display = "none";
};

window.updateProfile = async function(){
  const user = auth.currentUser;
  const status = document.getElementById("profileUpdateStatus");

  if(!user) return;

  const email = document.getElementById("profileEmailEdit").value.trim();
  const age = document.getElementById("profileAgeEdit").value;
  const departement = document.getElementById("profileDepartementEdit").value.trim();

  try{
    await updateDoc(doc(db,"blogUsers",user.uid),{
      age,
      departement
    });

    if(email && email !== user.email){
      await updateEmail(user,email);
      await updateDoc(doc(db,"blogUsers",user.uid),{ email });
    }

    currentUserData.age = age;
    currentUserData.departement = departement;

    status.textContent = "Profil mis à jour ✅";
    openMyProfile();
    loadMembers();

  }catch(error){
    console.error(error);
    status.textContent = error.code === "auth/requires-recent-login"
      ? "Reconnecte-toi pour modifier ton email."
      : "Erreur lors de la mise à jour.";
  }
};

window.openPasswordModal = function(){
  document.getElementById("passwordModal").style.display = "block";
};

window.closePasswordModal = function(){
  document.getElementById("passwordModal").style.display = "none";
};

window.togglePasswordVisibility = function(id){
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
};

window.changePassword = async function(){
  const user = auth.currentUser;
  const oldPass = document.getElementById("oldPassword").value;
  const newPass = document.getElementById("newPassword").value;
  const confirmPass = document.getElementById("confirmNewPassword").value;
  const status = document.getElementById("passwordStatus");

  if(!oldPass || !newPass || !confirmPass){
    status.textContent = "Merci de remplir tous les champs.";
    return;
  }

  if(newPass.length < 6){
    status.textContent = "Mot de passe trop court.";
    return;
  }

  if(newPass !== confirmPass){
    status.textContent = "Les mots de passe ne correspondent pas.";
    return;
  }

  try{
    const cred = EmailAuthProvider.credential(user.email, oldPass);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPass);

    status.textContent = "Mot de passe modifié ✅";
    document.getElementById("oldPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmNewPassword").value = "";

  }catch{
    status.textContent = "Ancien mot de passe incorrect.";
  }
};

/* ================= MEMBRES BLOQUÉS ================= */

window.openBlockedUsersModal = async function(){
  closeMenu();

  const user = auth.currentUser;
  const list = document.getElementById("blockedUsersList");

  if(!user || !list) return;

  list.innerHTML = "Chargement...";

  const blocked = currentUserData?.blockedUsers || [];

  if(blocked.length === 0){
    list.innerHTML = "Aucun membre bloqué.";
    document.getElementById("blockedUsersModal").style.display = "block";
    return;
  }

  list.innerHTML = "";

  for(const uid of blocked){
    const snap = await getDoc(doc(db,"blogUsers",uid));
    const data = snap.exists() ? snap.data() : null;

    const div = document.createElement("div");
    div.className = "private-conversation";

    div.innerHTML = `
      <div class="name">${data?.pseudo || "Utilisateur"}</div>
      <div class="preview">${data?.departement || "Département non renseigné"}</div>
      <button onclick="unblockUser('${uid}')">Débloquer</button>
    `;

    list.appendChild(div);
  }

  document.getElementById("blockedUsersModal").style.display = "block";
};

window.closeBlockedUsersModal = function(){
  document.getElementById("blockedUsersModal").style.display = "none";
};

window.unblockUser = async function(uid){
  const user = auth.currentUser;
  if(!user || !uid) return;

  await updateDoc(doc(db,"blogUsers",user.uid),{
    blockedUsers:arrayRemove(uid)
  });

  currentUserData.blockedUsers = (currentUserData.blockedUsers || []).filter(id => id !== uid);

  await openBlockedUsersModal();
  loadMembers();
  loadPrivateConversations();
};

/* ================= PROFIL MEMBRE ================= */

window.openMemberProfile = function(uid, data){
  const modal = document.getElementById("memberProfileModal");
  if(!modal) return;

  document.getElementById("memberProfileTitle").innerText = "Profil de " + (data.pseudo || "Anonyme");
  document.getElementById("memberProfilePseudo").innerText = data.pseudo || "Anonyme";
  document.getElementById("memberProfileAge").innerText = data.age || "Non renseigné";
  document.getElementById("memberProfileGenre").innerText = data.genre || "Non renseigné";
  document.getElementById("memberProfileDepartement").innerText = data.departement || "Non renseigné";

  modal.dataset.uid = uid;
  modal.dataset.pseudo = data.pseudo || "Anonyme";
  modal.style.display = "block";
};

window.closeMemberProfile = function(){
  document.getElementById("memberProfileModal").style.display = "none";
};

window.messageMemberProfile = function(){
  const modal = document.getElementById("memberProfileModal");
  const uid = modal.dataset.uid;
  const pseudo = modal.dataset.pseudo || "Utilisateur";

  closeMemberProfile();
  openPrivateChat(uid, pseudo);
};

/* ================= BLOCAGE ================= */

async function blockUser(uid, pseudo){
  const user = auth.currentUser;
  if(!user || !uid) return;

  const ok = confirm("Bloquer " + (pseudo || "ce membre") + " ? Il ne pourra plus t’envoyer de message privé.");
  if(!ok) return;

  await updateDoc(doc(db,"blogUsers",user.uid),{
    blockedUsers:arrayUnion(uid)
  });

  currentUserData.blockedUsers = currentUserData.blockedUsers || [];
  if(!currentUserData.blockedUsers.includes(uid)){
    currentUserData.blockedUsers.push(uid);
  }

  const chatId = getChatId(user.uid, uid);
  await setDoc(doc(db,"privateMessages",chatId),{
    hiddenFor:arrayUnion(user.uid)
  }, { merge:true });

  document.getElementById("memberProfileModal").style.display = "none";
  document.getElementById("privateChatWindow").style.display = "none";
  currentPrivateUser = null;

  loadMembers();
  loadPrivateConversations();

  alert("Utilisateur bloqué ✅");
}

window.blockMemberProfile = function(){
  const modal = document.getElementById("memberProfileModal");
  blockUser(modal.dataset.uid, modal.dataset.pseudo);
};

window.blockPrivateUser = function(){
  if(!currentPrivateUser) return;
  blockUser(currentPrivateUser.uid, currentPrivateUser.pseudo);
};

/* ================= MESSAGES PRIVÉS ================= */

function loadPrivateConversations(){
  const user = auth.currentUser;
  const list = document.getElementById("privateList");
  const btnPrivate = document.getElementById("btnPrivate");

  if(!user || !list) return;
  if(unsubscribePrivateList) unsubscribePrivateList();

  unsubscribePrivateList = onSnapshot(collection(db,"privateMessages"), snap => {
    list.innerHTML = "";

    const blocked = currentUserData?.blockedUsers || [];
    let totalConversations = 0;
    let unreadCount = 0;

    snap.forEach(docSnap => {
      const chat = docSnap.data();

      if(!Array.isArray(chat.participants)) return;
      if(!chat.participants.includes(user.uid)) return;
      if(Array.isArray(chat.hiddenFor) && chat.hiddenFor.includes(user.uid)) return;

      const otherUid = chat.participants.find(id => id !== user.uid);
      if(blocked.includes(otherUid)) return;

      const otherPseudo = chat.participantPseudos?.[otherUid] || "Utilisateur";
      const isUnread = chat.unreadFor === user.uid;

      totalConversations++;
      if(isUnread) unreadCount++;

      const div = document.createElement("div");
      div.className = "private-conversation";
      div.innerHTML = `
        <div class="name">
          ${otherPseudo}
          ${isUnread ? `<span class="private-badge">Nouveau</span>` : ""}
        </div>
        <div class="preview">${chat.lastMessage || "Conversation privée"}</div>
      `;

      div.onclick = function(){
        openPrivateChat(otherUid, otherPseudo);
      };

      list.appendChild(div);
    });

    if(totalConversations === 0){
      list.innerHTML = "Aucune conversation privée pour le moment.";
    }

    if(btnPrivate){
      btnPrivate.innerHTML = unreadCount > 0
        ? `💬 Messages privés <span class="private-badge">${unreadCount}</span>`
        : "💬 Messages privés";
    }
  });
}

window.openPrivatePanel = function(){
  const panel = document.getElementById("privatePanel");
  if(panel){
    panel.style.display = "block";
    panel.classList.add("mobile-open");
  }
};

window.closePrivatePanel = function(){
  const panel = document.getElementById("privatePanel");
  if(panel){
    panel.classList.remove("mobile-open");
    if(window.innerWidth <= 800){
      panel.style.display = "none";
    }
  }
};

window.openPrivateChat = async function(uid, pseudo){
  const user = auth.currentUser;
  if(!user || !uid) return;

  const blocked = currentUserData?.blockedUsers || [];
  if(blocked.includes(uid)){
    alert("Tu as bloqué cet utilisateur.");
    return;
  }

  const otherSnap = await getDoc(doc(db,"blogUsers",uid));
  const otherData = otherSnap.exists() ? otherSnap.data() : null;

  if(otherData?.blockedUsers?.includes(user.uid)){
    alert("Tu ne peux pas envoyer de message privé à cet utilisateur.");
    return;
  }

  currentPrivateUser = { uid, pseudo };
  const chatId = getChatId(user.uid, uid);
  const chatRef = doc(db,"privateMessages",chatId);

  const snap = await getDoc(chatRef);
  const existingChat = snap.exists() ? snap.data() : null;

  const dataToSave = {
    participants:[user.uid, uid],
    participantPseudos:{
      [user.uid]:currentPseudo,
      [uid]:pseudo
    },
    hiddenFor:arrayRemove(user.uid),
    updatedAt:serverTimestamp()
  };

  if(existingChat && existingChat.unreadFor === user.uid){
    dataToSave.unreadFor = "";
  }

  await setDoc(chatRef, dataToSave, { merge:true });

  document.getElementById("privateTitle").innerText = "Discussion avec " + pseudo;
  document.getElementById("privateChatWindow").style.display = "block";
  document.getElementById("privateStatus").textContent = "";

  listenPrivateChat(chatId);
};

function listenPrivateChat(chatId){
  const container = document.getElementById("privateMessages");

  if(unsubscribePrivateChat) unsubscribePrivateChat();

  const q = query(collection(db,"privateMessages",chatId,"messages"), orderBy("createdAt","asc"));

  unsubscribePrivateChat = onSnapshot(q, snap => {
    container.innerHTML = "";

    snap.forEach(docSnap => {
      const m = docSnap.data();

      const div = document.createElement("div");
      div.className = "private-msg " + (m.from === auth.currentUser.uid ? "mine" : "");
      div.textContent = m.message || "";

      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  });
}

window.sendPrivateMessage = async function(){
  const user = auth.currentUser;
  const text = document.getElementById("privateText").value.trim();
  const status = document.getElementById("privateStatus");

  if(!user || !currentPrivateUser){
    status.textContent = "Aucune conversation sélectionnée.";
    return;
  }

  const blocked = currentUserData?.blockedUsers || [];
  if(blocked.includes(currentPrivateUser.uid)){
    status.textContent = "Tu as bloqué cet utilisateur.";
    return;
  }

  const otherSnap = await getDoc(doc(db,"blogUsers",currentPrivateUser.uid));
  const otherData = otherSnap.exists() ? otherSnap.data() : null;

  if(otherData?.blockedUsers?.includes(user.uid)){
    status.textContent = "Message impossible.";
    return;
  }

  if(!text){
    status.textContent = "Écris un message avant d’envoyer.";
    return;
  }

  const chatId = getChatId(user.uid, currentPrivateUser.uid);
  const chatRef = doc(db,"privateMessages",chatId);

  await setDoc(chatRef,{
    participants:[user.uid, currentPrivateUser.uid],
    participantPseudos:{
      [user.uid]:currentPseudo,
      [currentPrivateUser.uid]:currentPrivateUser.pseudo
    },
    lastMessage:text,
    unreadFor:currentPrivateUser.uid,
    hiddenFor:arrayRemove(currentPrivateUser.uid),
    updatedAt:serverTimestamp()
  }, { merge:true });

  await addDoc(collection(db,"privateMessages",chatId,"messages"),{
    from:user.uid,
    to:currentPrivateUser.uid,
    pseudo:currentPseudo,
    message:text,
    type:"text",
    createdAt:serverTimestamp()
  });

  document.getElementById("privateText").value = "";
  status.textContent = "";
};

window.viewPrivateProfile = async function(){
  if(!currentPrivateUser) return;

  const snap = await getDoc(doc(db,"blogUsers", currentPrivateUser.uid));
  if(!snap.exists()) return;

  openMemberProfile(currentPrivateUser.uid, snap.data());
};

window.minimizePrivateChat = function(){
  document.getElementById("privateChatWindow").style.display = "none";
};

window.hideCurrentPrivateConversation = async function(){
  const user = auth.currentUser;
  if(!user || !currentPrivateUser) return;

  const ok = confirm("Supprimer cette conversation de ta liste ?");
  if(!ok) return;

  const chatId = getChatId(user.uid, currentPrivateUser.uid);
  const chatRef = doc(db,"privateMessages",chatId);

  const snap = await getDoc(chatRef);
  const chat = snap.exists() ? snap.data() : null;

  const dataToSave = {
    hiddenFor:arrayUnion(user.uid)
  };

  if(chat && chat.unreadFor === user.uid){
    dataToSave.unreadFor = "";
  }

  await setDoc(chatRef, dataToSave, { merge:true });

  document.getElementById("privateChatWindow").style.display = "none";
  currentPrivateUser = null;
};

/* ================= SIGNALEMENT ================= */

window.reportMemberProfile = function(){
  const modal = document.getElementById("memberProfileModal");

  currentReportMode = "profile";
  currentReportTarget = {
    uid:modal.dataset.uid,
    pseudo:modal.dataset.pseudo || "Utilisateur"
  };

  openReportModal("⚠️ Signaler ce profil", "Explique pourquoi tu signales ce profil :");
};

window.reportPrivateConversation = function(){
  if(!currentPrivateUser) return;

  currentReportMode = "privateConversation";
  currentReportTarget = {
    uid:currentPrivateUser.uid,
    pseudo:currentPrivateUser.pseudo || "Utilisateur",
    chatId:getChatId(auth.currentUser.uid, currentPrivateUser.uid)
  };

  openReportModal("⚠️ Signaler cette discussion", "Explique pourquoi tu signales cette discussion privée :");
};

function openReportModal(title, text){
  document.getElementById("reportModalTitle").textContent = title;
  document.getElementById("reportModalText").textContent = text;
  document.getElementById("reportReason").value = "";
  document.getElementById("reportModalStatus").textContent = "";
  document.getElementById("reportModal").style.display = "flex";
}

window.closeReportModal = function(){
  document.getElementById("reportModal").style.display = "none";
  document.getElementById("reportReason").value = "";
  document.getElementById("reportModalStatus").textContent = "";
  currentReportMode = null;
  currentReportTarget = null;
};

window.confirmReport = async function(){
  const user = auth.currentUser;
  const reason = document.getElementById("reportReason").value.trim();
  const status = document.getElementById("reportModalStatus");

  if(!user){
    status.textContent = "Tu dois être connecté(e).";
    return;
  }

  if(reason.length < 5){
    status.textContent = "Merci d’expliquer la raison du signalement.";
    return;
  }

  if(!currentReportMode || !currentReportTarget){
    status.textContent = "Aucun signalement sélectionné.";
    return;
  }

  const reportData = {
    type:currentReportMode,
    reportedUserUid:currentReportTarget.uid,
    reportedUserPseudo:currentReportTarget.pseudo,
    reportedBy:user.uid,
    reportedByPseudo:currentPseudo,
    reason:reason,
    createdAt:serverTimestamp(),
    status:"pending"
  };

  if(currentReportMode === "privateConversation"){
    reportData.chatId = currentReportTarget.chatId;
  }

  await addDoc(collection(db,"reports"), reportData);

  status.textContent = "Signalement envoyé ✅";

  setTimeout(() => {
    closeReportModal();
  }, 700);
};

/* ================= MODALES ================= */

window.openHelpModal = function(){
  closeMenu();
  document.getElementById("helpModal").style.display = "block";
};

window.closeHelpModal = function(){
  document.getElementById("helpModal").style.display = "none";
};

window.openPremiumModal = function(){
  closeMenu();
  document.getElementById("premiumModal").style.display = "block";
};

window.closePremiumModal = function(){
  document.getElementById("premiumModal").style.display = "none";
};

window.openLegalModal = function(){
  closeMenu();
  document.getElementById("legalModal").style.display = "block";
};

window.closeLegalModal = function(){
  document.getElementById("legalModal").style.display = "none";
};

window.addEventListener("beforeunload", () => {
  const user = auth.currentUser;

  if(user){
    updateDoc(doc(db,"blogUsers",user.uid),{
      online:false,
      lastSeen:serverTimestamp()
    });
  }
});
