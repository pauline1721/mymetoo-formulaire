import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateEmail,
  updatePassword,
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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

/* =========================
   FIREBASE
========================= */

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

/* =========================
   VARIABLES
========================= */

let currentPseudo = "Anonyme";
let currentUserData = null;

/* =========================
   AUTH
========================= */

window.login = async function(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try{
    await signInWithEmailAndPassword(auth, email, password);
  }catch{
    document.getElementById("loginStatus").textContent = "Email ou mot de passe incorrect.";
  }
};

window.logout = async function(){
  await signOut(auth);
};

onAuthStateChanged(auth, async user => {

  if(user){

    const snap = await getDoc(doc(db,"blogUsers",user.uid));

    if(!snap.exists()){
      await signOut(auth);
      return;
    }

    currentUserData = snap.data();
    currentPseudo = currentUserData.pseudo || "Anonyme";

    document.getElementById("welcomePseudo").innerText = "Connecté(e) : " + currentPseudo;

    document.getElementById("loginBox").style.display="none";
    document.getElementById("blogContent").style.display="block";

    loadMembers();
    loadMessages();

  }else{
    document.getElementById("loginBox").style.display="block";
    document.getElementById("blogContent").style.display="none";
  }

});

/* =========================
   MENU
========================= */

window.openMenu = () => {
  document.getElementById("sideMenu").classList.add("open");
  document.getElementById("menuOverlay").classList.add("open");
};

window.closeMenu = () => {
  document.getElementById("sideMenu").classList.remove("open");
  document.getElementById("menuOverlay").classList.remove("open");
};

/* =========================
   PROFIL
========================= */

window.openMyProfile = () => {

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

  document.getElementById("myProfileModal").style.display = "block";
};

window.closeMyProfile = () => {
  document.getElementById("myProfileModal").style.display = "none";
};

window.openEditProfile = () => {

  document.getElementById("profileView").style.display = "none";
  document.getElementById("profileEdit").style.display = "block";

  document.getElementById("profileEmailEdit").value = auth.currentUser.email || "";
  document.getElementById("profileAgeEdit").value = currentUserData?.age || "";
  document.getElementById("profileDepartementEdit").value = currentUserData?.departement || "";
};

window.cancelEditProfile = () => {
  document.getElementById("profileView").style.display = "block";
  document.getElementById("profileEdit").style.display = "none";
};

window.updateProfile = async () => {

  const user = auth.currentUser;
  const status = document.getElementById("profileUpdateStatus");

  const email = document.getElementById("profileEmailEdit").value.trim();
  const age = document.getElementById("profileAgeEdit").value;
  const departement = document.getElementById("profileDepartementEdit").value;

  try{

    await updateDoc(doc(db,"blogUsers",user.uid),{
      age,
      departement
    });

    if(email !== user.email){
      await updateEmail(user,email);
    }

    currentUserData.age = age;
    currentUserData.departement = departement;

    status.textContent = "Profil mis à jour ✅";

    openMyProfile();

  }catch{
    status.textContent = "Erreur mise à jour.";
  }

};

/* =========================
   MOT DE PASSE
========================= */

window.openPasswordModal = () => {
  document.getElementById("passwordModal").style.display = "block";
};

window.closePasswordModal = () => {
  document.getElementById("passwordModal").style.display = "none";
};

window.togglePasswordVisibility = (id) => {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
};

window.changePassword = async () => {

  const user = auth.currentUser;

  const oldPass = document.getElementById("oldPassword").value;
  const newPass = document.getElementById("newPassword").value;
  const confirmPass = document.getElementById("confirmNewPassword").value;
  const status = document.getElementById("passwordStatus");

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

  }catch{
    status.textContent = "Ancien mot de passe incorrect.";
  }

};

/* =========================
   MEMBRES
========================= */

function loadMembers(){

  const container = document.getElementById("membersList");

  onSnapshot(collection(db,"blogUsers"), snap => {

    container.innerHTML = "";

    snap.forEach(docSnap => {

      if(docSnap.id === auth.currentUser.uid) return;

      const data = docSnap.data();

      const div = document.createElement("div");
      div.className = "member";
      div.innerText = data.pseudo || "Anonyme";

      container.appendChild(div);

    });

  });

}

/* =========================
   CHAT
========================= */

function loadMessages(){

  const container = document.getElementById("messages");

  const q = query(collection(db,"blogMessages"), orderBy("createdAt","asc"));

  onSnapshot(q, snap => {

    container.innerHTML = "";

    snap.forEach(docSnap => {

      const m = docSnap.data();

      const div = document.createElement("div");
      div.className = "msg";

      div.innerHTML = `
        <div class="msg-meta">${m.pseudo}</div>
        ${m.message || ""}
        ${m.imageUrl ? `<img src="${m.imageUrl}" class="chat-img">` : ""}
      `;

      container.appendChild(div);

    });

    container.scrollTop = container.scrollHeight;

  });

}

window.sendMessage = async () => {

  const text = document.getElementById("chatMessage").value.trim();
  if(!text) return;

  await addDoc(collection(db,"blogMessages"),{
    pseudo:currentPseudo,
    message:text,
    createdAt:serverTimestamp()
  });

  document.getElementById("chatMessage").value = "";

};

/* =========================
   IMAGE
========================= */

window.sendPublicImage = async () => {

  const file = document.getElementById("publicImageInput").files[0];
  if(!file) return;

  const storageRef = ref(storage, "images/"+Date.now());

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db,"blogMessages"),{
    pseudo:currentPseudo,
    imageUrl:url,
    createdAt:serverTimestamp()
  });

};

/* =========================
   MODALS
========================= */

window.openHelpModal = () => {
  closeMenu();
  document.getElementById("helpModal").style.display = "block";
};

window.closeHelpModal = () => {
  document.getElementById("helpModal").style.display = "none";
};

window.openPremiumModal = () => {
  closeMenu();
  document.getElementById("premiumModal").style.display = "block";
};

window.closePremiumModal = () => {
  document.getElementById("premiumModal").style.display = "none";
};

window.openLegalModal = () => {
  closeMenu();
  document.getElementById("legalModal").style.display = "block";
};

window.closeLegalModal = () => {
  document.getElementById("legalModal").style.display = "none";
};
