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
  onSnapshot
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
let presenceInterval = null;

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
  const user = auth.currentUser;

  if(user){
    await updateDoc(doc(db,"blogUsers",user.uid),{
      online:false,
      lastSeen:serverTimestamp()
    });
  }

  if(presenceInterval){
    clearInterval(presenceInterval);
    presenceInterval = null;
  }

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

    if(presenceInterval){
      clearInterval(presenceInterval);
    }

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

    loadMembers();
    loadMessages();

  }else{
    if(presenceInterval){
      clearInterval(presenceInterval);
      presenceInterval = null;
    }

    document.getElementById("loginBox").style.display = "block";
    document.getElementById("blogContent").style.display = "none";
  }
});

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
      age:age,
      departement:departement
    });

    if(email && email !== user.email){
      await updateEmail(user,email);

      await updateDoc(doc(db,"blogUsers",user.uid),{
        email:email
      });
    }

    currentUserData.age = age;
    currentUserData.departement = departement;

    status.textContent = "Profil mis à jour ✅";
    openMyProfile();

  }catch(error){
    console.error(error);

    if(error.code === "auth/requires-recent-login"){
      status.textContent = "Reconnecte-toi pour modifier ton email.";
    }else{
      status.textContent = "Erreur lors de la mise à jour.";
    }
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

function loadMembers(){
  const container = document.getElementById("membersList");

  onSnapshot(collection(db,"blogUsers"), snap => {
    if(!auth.currentUser) return;

    container.innerHTML = "";

    let count = 0;
    const now = Date.now();

    snap.forEach(docSnap => {
      const uid = docSnap.id;
      const data = docSnap.data();

      if(uid === auth.currentUser.uid) return;
      if(data.active === false) return;
      if(data.online !== true) return;

      const lastSeenTime = data.lastSeen?.toDate ? data.lastSeen.toDate().getTime() : 0;

      if(!lastSeenTime) return;
      if(now - lastSeenTime > 120000) return;

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
      container.innerHTML = `<div class="member">Aucun autre membre en ligne</div>`;
    }
  });
}

window.openMemberProfile = function(uid, data){
  const modal = document.getElementById("memberProfileModal");

  if(modal){
    document.getElementById("memberProfileTitle").innerText = "Profil de " + (data.pseudo || "Anonyme");
    document.getElementById("memberProfilePseudo").innerText = data.pseudo || "Anonyme";
    document.getElementById("memberProfileAge").innerText = data.age || "Non renseigné";
    document.getElementById("memberProfileGenre").innerText = data.genre || "Non renseigné";
    document.getElementById("memberProfileDepartement
