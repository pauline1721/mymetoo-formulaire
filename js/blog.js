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
  limit,
  where
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

const ADMIN_UID = "YBknFdtouzRiDzSj8b2KjncQ7sp2";

const departements = [
  "Ain (01)","Aisne (02)","Allier (03)","Alpes-de-Haute-Provence (04)",
  "Hautes-Alpes (05)","Alpes-Maritimes (06)","Ardèche (07)","Ardennes (08)",
  "Ariège (09)","Aube (10)","Aude (11)","Aveyron (12)","Bouches-du-Rhône (13)",
  "Calvados (14)","Cantal (15)","Charente (16)","Charente-Maritime (17)",
  "Cher (18)","Corrèze (19)","Corse-du-Sud (2A)","Haute-Corse (2B)",
  "Côte-d'Or (21)","Côtes-d'Armor (22)","Creuse (23)","Dordogne (24)",
  "Doubs (25)","Drôme (26)","Eure (27)","Eure-et-Loir (28)",
  "Finistère (29)","Gard (30)","Haute-Garonne (31)","Gers (32)",
  "Gironde (33)","Hérault (34)","Ille-et-Vilaine (35)","Indre (36)",
  "Indre-et-Loire (37)","Isère (38)","Jura (39)","Landes (40)",
  "Loir-et-Cher (41)","Loire (42)","Haute-Loire (43)","Loire-Atlantique (44)",
  "Loiret (45)","Lot (46)","Lot-et-Garonne (47)","Lozère (48)",
  "Maine-et-Loire (49)","Manche (50)","Marne (51)","Haute-Marne (52)",
  "Mayenne (53)","Meurthe-et-Moselle (54)","Meuse (55)","Morbihan (56)",
  "Moselle (57)","Nièvre (58)","Nord (59)","Oise (60)",
  "Orne (61)","Pas-de-Calais (62)","Puy-de-Dôme (63)",
  "Pyrénées-Atlantiques (64)","Hautes-Pyrénées (65)",
  "Pyrénées-Orientales (66)","Bas-Rhin (67)","Haut-Rhin (68)",
  "Rhône (69)","Haute-Saône (70)","Saône-et-Loire (71)",
  "Sarthe (72)","Savoie (73)","Haute-Savoie (74)","Paris (75)",
  "Seine-Maritime (76)","Seine-et-Marne (77)","Yvelines (78)",
  "Deux-Sèvres (79)","Somme (80)","Tarn (81)","Tarn-et-Garonne (82)",
  "Var (83)","Vaucluse (84)","Vendée (85)","Vienne (86)",
  "Haute-Vienne (87)","Vosges (88)","Yonne (89)","Territoire de Belfort (90)",
  "Essonne (91)","Hauts-de-Seine (92)","Seine-Saint-Denis (93)",
  "Val-de-Marne (94)","Val-d'Oise (95)"
];

function remplirSelectDepartements(select, firstLabel){
  if(!select) return;

  select.innerHTML = "";

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = firstLabel;
  select.appendChild(firstOption);

  departements.forEach(dep => {
    const option = document.createElement("option");
    option.value = dep;
    option.textContent = dep;
    select.appendChild(option);
  });
}

function initDepartements(){
  remplirSelectDepartements(
    document.getElementById("filterDepartement"),
    "Tous les départements"
  );

  remplirSelectDepartements(
    document.getElementById("profileDepartementEdit"),
    "Choisir un département"
  );
}

let isAdmin = false;
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
  }catch(error){
    console.error(error);
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
    }).catch(() => {});
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
  }catch(error){
    console.error(error);
    status.textContent = "Impossible d’envoyer l’email de réinitialisation.";
  }
};

/* ================= AUTH STATE ================= */

onAuthStateChanged(auth, async user => {
  if(user){

    initDepartements(); // 👈 ICI EXACTEMENT

    isAdmin = user.uid === ADMIN_UID;

    const snap = await getDoc(doc(db,"blogUsers",user.uid));

    if(!snap.exists()){
      if(isAdmin){
        currentUserData = {
          pseudo:"Administrateur",
          premium:true,
          plan:"premium",
          active:true,
          blockedUsers:[],
          role:"admin",
          adminProfileVisible:true,
          adminContactEnabled:true,
          allowContact:true
        };

        await setDoc(doc(db,"blogUsers",user.uid),{
          pseudo:"Administrateur",
          email:user.email || "",
          active:true,
          premium:true,
          plan:"premium",
          role:"admin",
          adminProfileVisible:true,
          adminContactEnabled:true,
          allowContact:true,
          online:true,
          lastSeen:serverTimestamp()
        }, { merge:true });
      }else{
        await signOut(auth);
        return;
      }
    }else{
      currentUserData = snap.data();

      if(isAdmin){
        const adminDefaults = {};

        if(currentUserData.allowContact === undefined){
          adminDefaults.allowContact = true;
          currentUserData.allowContact = true;
        }

        if(currentUserData.adminProfileVisible === undefined){
          adminDefaults.adminProfileVisible = true;
          currentUserData.adminProfileVisible = true;
        }

        if(currentUserData.adminContactEnabled === undefined){
          adminDefaults.adminContactEnabled = true;
          currentUserData.adminContactEnabled = true;
        }

        if(Object.keys(adminDefaults).length > 0){
          await updateDoc(doc(db,"blogUsers",user.uid), adminDefaults).catch(() => {});
        }
      }
    }

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
        }).catch(() => {});
      }
    }, 10000);

    document.getElementById("welcomePseudo").innerText =
      isAdmin
        ? "Connecté(e) : " + currentPseudo + " 👑 ADMIN"
        : "Connecté(e) : " + currentPseudo;

    document.getElementById("loginBox").style.display = "none";
    document.getElementById("blogContent").style.display = "block";
    document.getElementById("menuButton").style.display = "block";

    const adminInvisibleBtn = document.getElementById("adminInvisibleBtn");
    if(adminInvisibleBtn){
      adminInvisibleBtn.style.display = isAdmin ? "block" : "none";
    }

    const adminStatusDot = document.getElementById("adminStatusDot");
    if(adminStatusDot){
      adminStatusDot.textContent = currentUserData.allowContact === false ? "🔴" : "🟢";
    }

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

      if(uid === ADMIN_UID && data.adminProfileVisible === false && !isAdmin) return;

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
    currentUserData?.plan === "premium" ||
    isAdmin === true;

  const q = isPremium
    ? query(collection(db,"blogMessages"), orderBy("createdAt","asc"))
    : query(collection(db,"blogMessages"), orderBy("createdAt","desc"), limit(30));

  unsubscribePublicMessages = onSnapshot(q, snap => {
    container.innerHTML = "";

    let messages = [];

    snap.forEach(docSnap => {
      const m = docSnap.data();

      if(m.visible === false && !isAdmin) return;

      const room = m.room || "general";
      if(room !== currentRoom) return;

      messages.push({
        id:docSnap.id,
        ...m
      });
    });

    if(!isPremium){
      messages = messages.slice(0, 5).reverse();
    }

    messages.forEach(m => {
      const div = document.createElement("div");
      div.className = m.visible === false ? "msg admin-hidden-msg" : "msg";

      const displayedPseudo = currentRoom === "anonyme" && !isAdmin
        ? "Anonyme"
        : (m.pseudo || "Anonyme");

      div.innerHTML = `
        ${m.visible === false && isAdmin ? `<div class="private-badge">Message masqué</div>` : ""}

        <div class="msg-meta">
          ${displayedPseudo}
          ${isAdmin ? `<span class="private-badge">UID : ${m.uid || "inconnu"}</span>` : ""}
        </div>

        ${m.message || ""}
        ${m.imageUrl ? `<img src="${m.imageUrl}" class="chat-img">` : ""}

        ${isAdmin ? `
          <div class="admin-message-actions">
            ${m.visible === false
              ? `<button class="secondary" onclick="adminShowPublicMessage('${m.id}')">Afficher</button>`
              : `<button class="danger" onclick="adminHidePublicMessage('${m.id}')">Masquer</button>`
            }

            ${m.uid && m.uid !== ADMIN_UID ? `<button class="danger" onclick="adminBlockUser('${m.uid}')">Bloquer utilisateur</button>` : ""}
          </div>
        ` : ""}
      `;

      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }, error => {
    console.error("Erreur chat public :", error);
  });
}

window.sendMessage = async function(){
  const text = document.getElementById("chatMessage").value.trim();
  const status = document.getElementById("messageStatus");

  if(!text) return;

  const user = auth.currentUser;
  if(!user) return;

  try{
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
    if(status) status.textContent = "";
  }catch(error){
    console.error(error);
    if(status) status.textContent = "Erreur lors de l’envoi du message.";
  }
};

window.sendPublicImage = async function(){
  const input = document.getElementById("publicImageInput");
  const status = document.getElementById("messageStatus");
  const file = input?.files?.[0];
  const user = auth.currentUser;

  if(!file || !user) return;

  try{
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
    if(status) status.textContent = "";
  }catch(error){
    console.error(error);
    if(status) status.textContent = "Erreur lors de l’envoi de la photo.";
  }
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

  initDepartements(); // 👈 AJOUTE CETTE LIGNE ICI

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
  if(!input) return;

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

  }catch(error){
    console.error(error);
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

  const isAdminProfile = uid === ADMIN_UID;

  document.getElementById("memberProfileTitle").innerText =
    isAdminProfile ? "👑 Administrateur" : "Profil de " + (data.pseudo || "Anonyme");

  document.getElementById("memberProfilePseudo").innerText = data.pseudo || "Anonyme";
  document.getElementById("memberProfileAge").innerText = data.age || "Non renseigné";
  document.getElementById("memberProfileGenre").innerText = data.genre || "Non renseigné";
  document.getElementById("memberProfileDepartement").innerText = data.departement || "Non renseigné";

  modal.dataset.uid = uid;
  modal.dataset.pseudo = data.pseudo || "Anonyme";

  const privateBtn = document.getElementById("memberPrivateBtn");
  const blockBtn = document.getElementById("memberBlockBtn");
  const reportBtn = document.getElementById("memberReportBtn");

  if(isAdminProfile){
    if(blockBtn) blockBtn.style.display = "none";
    if(reportBtn) reportBtn.style.display = "none";

    if(privateBtn){
      privateBtn.style.display = data.allowContact === false ? "none" : "block";
    }
  }else{
    if(privateBtn) privateBtn.style.display = "block";
    if(blockBtn) blockBtn.style.display = "block";
    if(reportBtn) reportBtn.style.display = "block";
  }

  modal.style.display = "block";
};

window.closeMemberProfile = function(){
  document.getElementById("memberProfileModal").style.display = "none";
};

window.messageMemberProfile = async function(){
  const modal = document.getElementById("memberProfileModal");
  const uid = modal.dataset.uid;
  const pseudo = modal.dataset.pseudo || "Utilisateur";

  if(uid === ADMIN_UID){
    const snap = await getDoc(doc(db,"blogUsers", uid));
    const data = snap.exists() ? snap.data() : null;

    const canContact = data?.allowContact !== false;

    if(!canContact){
      alert("L’administrateur n’est pas disponible actuellement.");
      return;
    }
  }

  closeMemberProfile();
  await openPrivateChat(uid, pseudo);
};

/* ================= BLOCAGE ================= */

async function blockUser(uid, pseudo){
  const user = auth.currentUser;
  if(!user || !uid) return;

  if(uid === ADMIN_UID){
    alert("Impossible de bloquer l’administrateur.");
    return;
  }

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

  if(modal.dataset.uid === ADMIN_UID){
    alert("Impossible de bloquer l’administrateur.");
    return;
  }

  blockUser(modal.dataset.uid, modal.dataset.pseudo);
};

window.blockPrivateUser = function(){
  if(!currentPrivateUser) return;

  if(currentPrivateUser.uid === ADMIN_UID){
    alert("Impossible de bloquer l’administrateur.");
    return;
  }

  blockUser(currentPrivateUser.uid, currentPrivateUser.pseudo);
};

/* ================= MESSAGES PRIVÉS ================= */

function updatePrivateBadge(unreadCount){
  const btnPrivate = document.getElementById("btnPrivate");
  const privateHeader = document.querySelector(".private-header span");

  if(btnPrivate){
    btnPrivate.innerHTML = unreadCount > 0
      ? `💬 Messages privés <span class="private-badge">${unreadCount}</span>`
      : "💬 Messages privés";
  }

  if(privateHeader){
    privateHeader.innerHTML = unreadCount > 0
      ? `Messages privés <span class="private-badge">${unreadCount}</span>`
      : "Messages privés";
  }
}

function loadPrivateConversations(){
  const user = auth.currentUser;
  const list = document.getElementById("privateList");

  if(!user || !list) return;

  if(unsubscribePrivateList){
    unsubscribePrivateList();
    unsubscribePrivateList = null;
  }

  const q = query(
    collection(db,"privateMessages"),
    where("participants","array-contains",user.uid)
  );

  unsubscribePrivateList = onSnapshot(q, snap => {
    list.innerHTML = "";

    let conversations = [];
    let unreadCount = 0;

    snap.forEach(docSnap => {
      const chat = docSnap.data();

      if(!Array.isArray(chat.participants)) return;

      const otherUid = chat.participants.find(id => id !== user.uid);
      if(!otherUid) return;

      const hiddenFor = Array.isArray(chat.hiddenFor) ? chat.hiddenFor : [];

      const isUnread =
        chat.unreadFor === user.uid ||
        (Array.isArray(chat.unreadBy) && chat.unreadBy.includes(user.uid));

      /*
        Important :
        Si une conversation est masquée MAIS qu’un nouveau message arrive,
        on la réaffiche quand même pour que la notification apparaisse.
      */
      if(hiddenFor.includes(user.uid) && !isUnread) return;

      const blocked = currentUserData?.blockedUsers || [];
      if(blocked.includes(otherUid)) return;

      const otherPseudo = chat.participantPseudos?.[otherUid] || "Utilisateur";

      if(isUnread) unreadCount++;

      conversations.push({
        id: docSnap.id,
        otherUid,
        otherPseudo,
        isUnread,
        lastMessage: chat.lastMessage || "Conversation privée",
        updatedAt: chat.updatedAt
      });
    });

    conversations.sort((a,b) => {
      const da = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
      const dbb = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
      return dbb - da;
    });

    if(conversations.length === 0){
      list.innerHTML = "Aucune conversation privée pour le moment.";
      updatePrivateBadge(0);
      return;
    }

    conversations.forEach(chat => {
      const div = document.createElement("div");
      div.className = chat.isUnread
        ? "private-conversation private-conversation-unread"
        : "private-conversation";

      div.innerHTML = `
        <div class="name">
          ${chat.otherPseudo}
          ${chat.isUnread ? `<span class="private-badge">Nouveau</span>` : ""}
        </div>
        <div class="preview">${chat.lastMessage}</div>
      `;

      div.onclick = function(){
        openPrivateChat(chat.otherUid, chat.otherPseudo);
      };

      list.appendChild(div);
    });

    updatePrivateBadge(unreadCount);

    list.style.display = "none";
    list.offsetHeight;
    list.style.display = "block";

  }, error => {
    console.error("Erreur messages privés :", error);
    list.innerHTML = "Erreur de chargement des messages privés.";
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

  const otherSnap = await getDoc(doc(db,"blogUsers",uid));
  const otherData = otherSnap.exists() ? otherSnap.data() : null;

  if(uid === ADMIN_UID && user.uid !== ADMIN_UID){
    const canContactAdmin = otherData?.allowContact !== false;

    if(!canContactAdmin){
      alert("L’administrateur n’est pas disponible actuellement.");
      return;
    }
  }

  if(otherData?.blockedUsers?.includes(user.uid) && user.uid !== ADMIN_UID){
    alert("Tu ne peux pas envoyer de message privé à cet utilisateur.");
    return;
  }

  currentPrivateUser = {
    uid: uid,
    pseudo: pseudo || otherData?.pseudo || "Utilisateur"
  };

  const chatId = getChatId(user.uid, uid);
  const chatRef = doc(db,"privateMessages",chatId);

  await setDoc(chatRef,{
    participants:[user.uid, uid],
    participantPseudos:{
      [user.uid]:currentPseudo,
      [uid]:currentPrivateUser.pseudo
    },
    hiddenFor:arrayRemove(user.uid),
    updatedAt:serverTimestamp()
  }, { merge:true });

  const snap = await getDoc(chatRef);
const chat = snap.exists() ? snap.data() : null;

// ⚠️ ON MARQUE LU UNIQUEMENT SI C'EST LE DESTINATAIRE
if(chat && chat.unreadFor === user.uid){
  await updateDoc(chatRef,{
    unreadFor:"",
    unreadBy:arrayRemove(user.uid)
  }).catch(() => {});
}

  const privateTitle = document.getElementById("privateTitle");
  const privateChatWindow = document.getElementById("privateChatWindow");
  const privateStatus = document.getElementById("privateStatus");

  if(privateTitle) privateTitle.innerText = "Discussion avec " + currentPrivateUser.pseudo;
  if(privateChatWindow) privateChatWindow.style.display = "block";
  if(privateStatus) privateStatus.textContent = "";

  listenPrivateChat(chatId);
};

function listenPrivateChat(chatId){
  const container = document.getElementById("privateMessages");
  if(!container) return;

  if(unsubscribePrivateChat){
    unsubscribePrivateChat();
    unsubscribePrivateChat = null;
  }

  const q = query(
    collection(db,"privateMessages",chatId,"messages"),
    orderBy("createdAt","asc")
  );

  unsubscribePrivateChat = onSnapshot(q, snap => {
    container.innerHTML = "";

    snap.forEach(docSnap => {
      const m = docSnap.data();

      const div = document.createElement("div");
      div.className = "private-msg " + (m.from === auth.currentUser?.uid ? "mine" : "");
      div.textContent = m.message || "";

      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }, error => {
    console.error("Erreur discussion privée :", error);
  });
}
window.sendPrivateMessage = async function(){
  const user = auth.currentUser;
  const textInput = document.getElementById("privateText");
  const status = document.getElementById("privateStatus");

  const text = textInput ? textInput.value.trim() : "";

  if(!user || !currentPrivateUser){
    if(status) status.textContent = "Aucune conversation sélectionnée.";
    return;
  }

  if(!text){
    if(status) status.textContent = "Écris un message avant d’envoyer.";
    return;
  }

  const otherSnap = await getDoc(doc(db,"blogUsers",currentPrivateUser.uid));
  const otherData = otherSnap.exists() ? otherSnap.data() : null;

  // ❌ on bloque seulement SI c’est un utilisateur vers admin
if(
  currentPrivateUser.uid === ADMIN_UID &&
  user.uid !== ADMIN_UID
){
    const canContactAdmin = otherData?.allowContact !== false;

    if(!canContactAdmin){
      if(status) status.textContent = "L’administrateur n’est pas disponible actuellement.";
      return;
    }
  }

  if(otherData?.blockedUsers?.includes(user.uid) && user.uid !== ADMIN_UID){
    if(status) status.textContent = "Message impossible.";
    return;
  }

  const chatId = getChatId(user.uid, currentPrivateUser.uid);
  const chatRef = doc(db,"privateMessages",chatId);

  await updateDoc(chatRef,{
    lastMessage:text,
    unreadFor:currentPrivateUser.uid,
    unreadBy:arrayUnion(currentPrivateUser.uid),
    hiddenFor:arrayRemove(currentPrivateUser.uid),
    updatedAt:serverTimestamp()
  }).catch(async () => {
    await setDoc(chatRef,{
      participants:[user.uid, currentPrivateUser.uid],
      participantPseudos:{
        [user.uid]:currentPseudo,
        [currentPrivateUser.uid]:currentPrivateUser.pseudo
      },
      lastMessage:text,
      unreadFor:currentPrivateUser.uid,
      unreadBy:[currentPrivateUser.uid],
      hiddenFor:[],
      updatedAt:serverTimestamp()
    });
  });

  await addDoc(collection(db,"privateMessages",chatId,"messages"),{
    from:user.uid,
    to:currentPrivateUser.uid,
    pseudo:currentPseudo,
    message:text,
    type:"text",
    createdAt:serverTimestamp()
  });

  if(textInput) textInput.value = "";
  if(status) status.textContent = "";

  loadPrivateConversations();
};

window.viewPrivateProfile = async function(){
  if(!currentPrivateUser) return;

  const snap = await getDoc(doc(db,"blogUsers", currentPrivateUser.uid));
  if(!snap.exists()) return;

  openMemberProfile(currentPrivateUser.uid, snap.data());
};

window.minimizePrivateChat = function(){
  const privateChatWindow = document.getElementById("privateChatWindow");
  if(privateChatWindow) privateChatWindow.style.display = "none";
};

window.hideCurrentPrivateConversation = async function(){
  const user = auth.currentUser;
  if(!user || !currentPrivateUser) return;

  const ok = confirm("Supprimer cette conversation de ta liste ?");
  if(!ok) return;

  const chatId = getChatId(user.uid, currentPrivateUser.uid);
  const chatRef = doc(db,"privateMessages",chatId);

  await setDoc(chatRef,{
    hiddenFor:arrayUnion(user.uid),
    unreadFor:"",
    unreadBy:arrayRemove(user.uid)
  }, { merge:true });

  const privateChatWindow = document.getElementById("privateChatWindow");
  if(privateChatWindow) privateChatWindow.style.display = "none";

  currentPrivateUser = null;
  loadPrivateConversations();
};

/* ================= SIGNALEMENT ================= */

window.reportMemberProfile = function(){
  const modal = document.getElementById("memberProfileModal");

  if(modal.dataset.uid === ADMIN_UID){
    alert("Impossible de signaler l’administrateur.");
    return;
  }

  currentReportMode = "profile";
  currentReportTarget = {
    uid:modal.dataset.uid,
    pseudo:modal.dataset.pseudo || "Utilisateur"
  };

  openReportModal("⚠️ Signaler ce profil", "Explique pourquoi tu signales ce profil :");
};

window.reportPrivateConversation = function(){
  if(!currentPrivateUser) return;

  if(currentPrivateUser.uid === ADMIN_UID){
    alert("Impossible de signaler l’administrateur.");
    return;
  }

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

  if(currentReportTarget.uid === ADMIN_UID){
    status.textContent = "Impossible de signaler l’administrateur.";
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

window.adminHidePublicMessage = async function(messageId){
  if(!isAdmin) return;

  const ok = confirm("Masquer ce message public ?");
  if(!ok) return;

  await updateDoc(doc(db,"blogMessages",messageId),{
    visible:false
  });
};

window.adminShowPublicMessage = async function(messageId){
  if(!isAdmin) return;

  const ok = confirm("Réafficher ce message public ?");
  if(!ok) return;

  await updateDoc(doc(db,"blogMessages",messageId),{
    visible:true
  });
};

window.adminBlockUser = async function(uid){
  if(!isAdmin || !uid) return;

  if(uid === ADMIN_UID){
    alert("Impossible de bloquer l’administrateur.");
    return;
  }

  const ok = confirm("Bloquer cet utilisateur depuis le chat ?");
  if(!ok) return;

  await updateDoc(doc(db,"blogUsers",uid),{
    active:false,
    online:false
  });

  alert("Utilisateur bloqué ✅");
};

window.openAdminSettingsModal = function(){
  if(!isAdmin) return;

  closeMenu();

  const visibleText = document.getElementById("adminVisibleStatus");
  const contactText = document.getElementById("adminContactStatus");

  if(visibleText){
    visibleText.textContent = currentUserData.adminProfileVisible === false
      ? "Invisible pour les membres"
      : "Visible pour les membres";
  }

  if(contactText){
    contactText.textContent = currentUserData.allowContact === false
      ? "Messages privés désactivés"
      : "Messages privés activés";
  }

  document.getElementById("adminSettingsStatus").textContent = "";
  document.getElementById("adminSettingsModal").style.display = "block";
};

window.closeAdminSettingsModal = function(){
  document.getElementById("adminSettingsModal").style.display = "none";
};

window.toggleAdminVisibility = async function(){
  if(!isAdmin || !auth.currentUser) return;

  const newValue = currentUserData.adminProfileVisible === false ? true : false;

  await updateDoc(doc(db,"blogUsers",auth.currentUser.uid),{
    adminProfileVisible:newValue
  });

  currentUserData.adminProfileVisible = newValue;

  const visibleText = document.getElementById("adminVisibleStatus");
  if(visibleText){
    visibleText.textContent = newValue
      ? "Visible pour les membres"
      : "Invisible pour les membres";
  }

  const adminSettingsStatus = document.getElementById("adminSettingsStatus");
  if(adminSettingsStatus){
    adminSettingsStatus.textContent = "Visibilité mise à jour ✅";
  }

  loadMembers();
};

window.toggleAdminContact = async function(){
  if(!isAdmin) return;

  const user = auth.currentUser;
  if(!user) return;

  const newState = !(currentUserData.allowContact === true);

  await updateDoc(doc(db,"blogUsers", user.uid),{
    allowContact:newState,
    adminContactEnabled:newState,
    adminProfileVisible:newState
  });

  currentUserData.allowContact = newState;
  currentUserData.adminContactEnabled = newState;
  currentUserData.adminProfileVisible = newState;

  const adminStatusDot = document.getElementById("adminStatusDot");
  if(adminStatusDot){
    adminStatusDot.textContent = newState ? "🟢" : "🔴";
  }

  const contactText = document.getElementById("adminContactStatus");
  if(contactText){
    contactText.textContent = newState
      ? "Messages privés activés"
      : "Messages privés désactivés";
  }

  const visibleText = document.getElementById("adminVisibleStatus");
  if(visibleText){
    visibleText.textContent = newState
      ? "Visible pour les membres"
      : "Invisible pour les membres";
  }

  loadMembers();

  alert(newState 
    ? "🟢 Tu es visible (on peut t’écrire)" 
    : "🔴 Tu es invisible (personne ne peut t’écrire)");
};

window.addEventListener("beforeunload", () => {
  const user = auth.currentUser;

  if(user){
    updateDoc(doc(db,"blogUsers",user.uid),{
      online:false,
      lastSeen:serverTimestamp()
    }).catch(() => {});
  }
});
