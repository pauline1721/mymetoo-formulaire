import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_UID = "YBknFdtouzRiDzSj8b2KjncQ7sp2";

const firebaseConfig = {
  apiKey: "AIzaSyCPaxlstCCCIJ_gwCSAI2cNt23yu8iLaK0",
  authDomain: "mymetoo-formulaire.firebaseapp.com",
  projectId: "mymetoo-formulaire",
  storageBucket: "mymetoo-formulaire.firebasestorage.app",
  messagingSenderId: "1084270329845",
  appId: "1:1084270329845:web:337a6172a4817f0db2eabc"
};

const adminApp = initializeApp(firebaseConfig, "adminApp");
const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

let dailyChart = null;
let usersCache = [];

async function addAdminLog(action, details = {}){
  try{
    await addDoc(collection(db, "adminLogs"), {
      action,
      adminUid: ADMIN_UID,
      ...details,
      createdAt: serverTimestamp()
    });
  }catch(e){
    console.error("Erreur adminLogs :", e);
  }
}

const sectionTitles = {
  dashboard: "Tableau de bord",
  reports: "Signalements",
  users: "Utilisateurs",
  chat: "Chat public",
  testimonials: "Témoignages",
  adminLogs: "Historique"
};

window.showAdminSection = function(sectionName){
  document.querySelectorAll(".admin-section").forEach(section => {
    section.classList.remove("active");
  });

  document.querySelectorAll(".admin-sidebar button").forEach(btn => {
    btn.classList.remove("active");
  });

  const section = document.getElementById("section-" + sectionName);
  const nav = document.getElementById("nav-" + sectionName);

  if(section) section.classList.add("active");
  if(nav) nav.classList.add("active");

  document.getElementById("adminTitle").innerText = sectionTitles[sectionName] || "Admin";
};

window.login = async function(){
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("error");

  error.innerText = "";

  try{
    await signInWithEmailAndPassword(auth, email, password);
  }catch(e){
    error.innerText = "Email ou mot de passe incorrect";
  }
};

window.logout = async function(){
  await signOut(auth);
};

window.openBlogAsAdmin = function(){
  window.open("blog.html", "_blank");
};

window.filterReportedUsers = function(){

  const value = document
    .getElementById("reportedUsersSearch")
    .value
    .toLowerCase();

  const cards = document.querySelectorAll("#reportedUsersData .card");

  cards.forEach(card => {

    const text = card.innerText.toLowerCase();

    if(text.includes(value)){
      card.style.display = "block";
    }else{
      card.style.display = "none";
    }
  });
};

onAuthStateChanged(auth, user => {
  if(user && user.uid === ADMIN_UID){
    document.getElementById("login").style.display = "none";
    document.getElementById("adminContent").style.display = "block";
    loadAllAdminData();
  }else{
    if(user){
      signOut(auth);
    }

    document.getElementById("login").style.display = "block";
    document.getElementById("adminContent").style.display = "none";
  }
});

async function loadAllAdminData(){
  await loadReports();
  await loadUsers();
  await loadPublicMessages();
  await loadData();
  await loadAdminLogs();
  await loadReportedUsers();
}

async function getValidatedReportCountForUser(uid){
  if(!uid) return 0;

  const snap = await getDocs(collection(db, "reports"));
  let count = 0;

  snap.forEach(item => {
    const r = item.data();
    const reportedUid = r.reportedUserUid || r.authorUid || "";

    if(reportedUid === uid && r.adminDecision === "accepted"){
      count++;
    }
  });

  return count;
}

async function tempBlockUser24h(uid){
  if(!uid) return;

  const banUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await updateDoc(doc(db, "blogUsers", uid), {
    active:false,
    tempBlocked:true,
    banUntil:banUntil,
    online:false
  });

  await addAdminLog("TEMP_BLOCK_24H", {
    targetUid: uid,
    reason: "3 signalements validés"
  });
}

async function loadReports(){
  const container = document.getElementById("reportsData");
  container.innerHTML = "";

  const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  let pendingCount = 0;

  if(snapshot.empty){
    container.innerHTML = `<div class="empty">Aucun signalement pour le moment.</div>`;
    document.getElementById("reportsCount").innerText = "0";
    return;
  }

  snapshot.forEach(item => {
    const r = item.data();
    const id = item.id;
    const dateObj = r.createdAt?.toDate ? r.createdAt.toDate() : null;

    if(r.status === "done") return;

    pendingCount++;

    let typeText = "Signalement";

    if(r.type === "profile") typeText = "Profil signalé";
    if(r.type === "privateConversation") typeText = "Discussion privée signalée";
    if(r.type === "blogMessage") typeText = "Message public signalé";

    const reportedUid = r.reportedUserUid || r.authorUid || "";

    const div = document.createElement("div");
    div.className = "report-card";

    div.innerHTML = `
      <div class="report-type">🚨 ${typeText}</div>

      <div class="field"><span class="label">Statut :</span> ${r.status || "pending"}</div>
      <div class="field"><span class="label">Décision admin :</span> ${r.adminDecision || "En attente"}</div>
      <div class="field"><span class="label">Signalé par UID :</span> ${r.reportedBy || ""}</div>

      <div class="field"><span class="label">Utilisateur signalé :</span> ${r.reportedUserPseudo || r.pseudo || ""}</div>
      <div class="field"><span class="label">UID utilisateur signalé :</span> ${reportedUid}</div>

      <div class="field"><span class="label">Genre :</span> ${r.reportedUserGenre || ""}</div>
      <div class="field"><span class="label">Âge :</span> ${r.reportedUserAge || ""}</div>

      <div class="field"><span class="label">Chat ID :</span> ${r.chatId || ""}</div>
      <div class="field"><span class="label">Message ID :</span> ${r.messageId || ""}</div>

      ${r.reason ? `<div class="report-message"><span class="label">Raison du signalement :</span><br>${r.reason}</div>` : ""}
      ${r.message ? `<div class="report-message"><span class="label">Message signalé :</span><br>${r.message}</div>` : ""}

      <div class="field"><span class="label">Date :</span> ${dateObj ? dateObj.toLocaleString("fr-FR") : ""}</div>

      <div class="report-actions">
        <button class="accept-btn" onclick="acceptReport('${id}')">Valider le signalement</button>
        <button class="refuse-btn" onclick="refuseReport('${id}')">Refuser le signalement</button>
        <button class="hide-btn" onclick="markReportDone('${id}')">Marquer comme traité</button>

        ${reportedUid ? `
          <button class="block-btn" onclick="disableUser('${reportedUid}')">Bloquer immédiatement</button>
        ` : ""}
      </div>
    `;

    container.appendChild(div);
  });

  if(pendingCount === 0){
    container.innerHTML = `<div class="empty">Aucun signalement à traiter.</div>`;
  }

  document.getElementById("reportsCount").innerText = pendingCount;
}

window.acceptReport = async function(reportId){
  const ok = confirm("Valider ce signalement ?");
  if(!ok) return;

  try{
    const reportSnap = await getDoc(doc(db, "reports", reportId));

    if(!reportSnap.exists()){
      alert("Signalement introuvable.");
      return;
    }

    const r = reportSnap.data();
    const reportedUid = r.reportedUserUid || r.authorUid || "";

    await updateDoc(doc(db, "reports", reportId), {
      adminDecision:"accepted",
      status:"done",
      treatedAt:new Date(),
      treatedBy:ADMIN_UID
    });

    await addAdminLog("ACCEPT_REPORT", {
  reportId,
  type: r.type || "",
  reason: r.reason || "",

  reportedByUid: r.reportedBy || "",
  reportedUserUid: reportedUid,
  reportedUserPseudo: r.reportedUserPseudo || r.pseudo || "",
  reportedUserGenre: r.reportedUserGenre || "",
  reportedUserAge: r.reportedUserAge || "",

  messageId: r.messageId || "",
  chatId: r.chatId || "",
  reportedMessage: r.message || ""
});

    const validCount = await getValidatedReportCountForUser(reportedUid);

    if(validCount >= 3){
      await tempBlockUser24h(reportedUid);
      alert("Signalement validé. L’utilisateur a atteint 3 signalements validés : compte bloqué 24h.");
    }else{
      alert("Signalement validé.");
    }

    await loadReports();
    await loadUsers();

  }catch(e){
    alert("Erreur lors de la validation du signalement.");
    console.error(e);
  }
};

window.refuseReport = async function(reportId){
  const ok = confirm("Refuser ce signalement ?");
  if(!ok) return;

  try{
  const reportSnap = await getDoc(doc(db, "reports", reportId));

  if(!reportSnap.exists()){
    alert("Signalement introuvable.");
    return;
  }

  const r = reportSnap.data();
  const reportedUid = r.reportedUserUid || r.authorUid || "";

  await updateDoc(doc(db, "reports", reportId), {
      adminDecision:"refused",
      status:"done",
      treatedAt:new Date(),
      treatedBy:ADMIN_UID
    });

    await addAdminLog("REFUSE_REPORT", {
  reportId,
  type: r.type || "",
  reason: r.reason || "",

  reportedByUid: r.reportedBy || "",
  reportedUserUid: reportedUid,
  reportedUserPseudo: r.reportedUserPseudo || r.pseudo || "",
  reportedUserGenre: r.reportedUserGenre || "",
  reportedUserAge: r.reportedUserAge || "",

  messageId: r.messageId || "",
  chatId: r.chatId || "",
  reportedMessage: r.message || ""
});
    await loadReports();

  }catch(e){
    alert("Erreur lors du refus du signalement.");
    console.error(e);
  }
};

window.markReportDone = async function(reportId){
  try{
    await updateDoc(doc(db, "reports", reportId), {
      status:"done",
      adminDecision:"treated_without_decision",
      treatedAt:new Date(),
      treatedBy:ADMIN_UID
    });

    await addAdminLog("MARK_REPORT_DONE", {
      reportId
    });

    await loadReports();

  }catch(e){
    alert("Erreur lors du traitement du signalement.");
    console.error(e);
  }
};

async function loadUsers(){
  const snapshot = await getDocs(collection(db, "blogUsers"));
  usersCache = snapshot.docs.map(item => ({
    id:item.id,
    ...item.data()
  }));

  renderUsers(usersCache);
}

async function renderUsers(list){
  const oldContainer = document.getElementById("usersData");
  const activeContainer = document.getElementById("activeUsersData");
  const blockedContainer = document.getElementById("blockedUsersData");

  if(oldContainer) oldContainer.innerHTML = "";
  if(activeContainer) activeContainer.innerHTML = "";
  if(blockedContainer) blockedContainer.innerHTML = "";

  let usersCount = usersCache.length;
  let disabledCount = usersCache.filter(u => u.active === false).length;

  for(const u of list){
    const uid = u.id;
    const active = u.active !== false;
    const tempBlocked = u.tempBlocked === true;
    const banUntil = u.banUntil?.toDate ? u.banUntil.toDate() : null;
    const lastSeenTime = u.lastSeen?.toDate ? u.lastSeen.toDate().getTime() : 0;
    const online = u.online === true && (Date.now() - lastSeenTime < 300000);
    const lastSeen = u.lastSeen?.toDate ? u.lastSeen.toDate().toLocaleString("fr-FR") : "";
    const validatedReports = await getValidatedReportCountForUser(uid);

    const div = document.createElement("div");
    div.className = active ? "card" : "card hidden-response";

    div.innerHTML = `
      ${!active ? `<div class="badge-hidden">Compte bloqué</div>` : ""}
      ${tempBlocked && banUntil ? `<div class="badge-warning">Blocage temporaire jusqu’au ${banUntil.toLocaleString("fr-FR")}</div>` : ""}

      <div class="field"><span class="label">Pseudo :</span> ${u.pseudo || "Anonyme"}</div>
      <div class="field"><span class="label">UID :</span> ${uid}</div>
      <div class="field"><span class="label">Email :</span> ${u.email || "Non renseigné"}</div>
      <div class="field"><span class="label">Genre :</span> ${u.genre || u.gender || "Non renseigné"}</div>
      <div class="field"><span class="label">Âge :</span> ${u.age || u.trancheAge || u.ageRange || "Non renseigné"}</div>
      <div class="field"><span class="label">Département :</span> ${u.departement || "Non renseigné"}</div>
      <div class="field"><span class="label">Premium :</span> ${u.premium === true || u.plan === "premium" ? "Oui" : "Non"}</div>
      <div class="field"><span class="label">Statut :</span> ${active ? "Actif" : "Bloqué"}</div>
      <div class="field"><span class="label">Signalements validés :</span> ${validatedReports}</div>
      <div class="field"><span class="label">En ligne :</span> ${online ? "Oui" : "Non"}</div>
      <div class="field"><span class="label">Dernière activité :</span> ${lastSeen}</div>

      <button class="${active ? "report-btn" : "hide-btn"}" onclick="${active ? `disableUser('${uid}')` : `enableUser('${uid}')`}">
        ${active ? "Bloquer cet utilisateur" : "Réactiver cet utilisateur"}
      </button>

      <button class="hide-btn" onclick="togglePremiumUser('${uid}', ${u.premium === true || u.plan === "premium"})">
        ${u.premium === true || u.plan === "premium" ? "Retirer Premium" : "Activer Premium"}
      </button>
    `;

    if(activeContainer && blockedContainer){
      if(active){
        activeContainer.appendChild(div);
      }else{
        blockedContainer.appendChild(div);
      }
    }else if(oldContainer){
      oldContainer.appendChild(div);
    }
  }

  if(activeContainer && activeContainer.innerHTML === ""){
    activeContainer.innerHTML = `<div class="empty">Aucun utilisateur actif.</div>`;
  }

  if(blockedContainer && blockedContainer.innerHTML === ""){
    blockedContainer.innerHTML = `<div class="empty">Aucun utilisateur bloqué.</div>`;
  }

  document.getElementById("usersCount").innerText = usersCount;
  document.getElementById("disabledCount").innerText = disabledCount;
}

window.showAllUsers = function(){
  renderUsers(usersCache);
};

window.showOnlineUsers = function(){
  const onlineUsers = usersCache.filter(u => {
    const lastSeenTime = u.lastSeen?.toDate ? u.lastSeen.toDate().getTime() : 0;
    return u.online === true && (Date.now() - lastSeenTime < 300000);
  });

  renderUsers(onlineUsers);
};

window.disableUser = async function(uid){
  const ok = confirm("Bloquer cet utilisateur ?");
  if(!ok) return;

  try{
    await updateDoc(doc(db, "blogUsers", uid), {
      active:false,
      online:false
    });

    await addAdminLog("BLOCK_USER", {
      targetUid: uid
    });

    await loadUsers();
    await loadReports();
  }catch(e){
    alert("Erreur : impossible de bloquer l’utilisateur.");
    console.error(e);
  }
};

window.enableUser = async function(uid){
  const ok = confirm("Réactiver cet utilisateur ?");
  if(!ok) return;

  try{
    await updateDoc(doc(db, "blogUsers", uid), {
      active:true,
      tempBlocked:false,
      banUntil:null
    });

    await addAdminLog("UNBLOCK_USER", {
      targetUid: uid
    });

    await loadUsers();
  }catch(e){
    alert("Erreur : impossible de réactiver l’utilisateur.");
    console.error(e);
  }
};

window.togglePremiumUser = async function(uid, isPremium){
  const ok = confirm(isPremium ? "Retirer Premium à cet utilisateur ?" : "Activer Premium pour cet utilisateur ?");
  if(!ok) return;

  try{
    await updateDoc(doc(db, "blogUsers", uid), {
      premium: !isPremium,
      plan: !isPremium ? "premium" : "free"
    });

    await addAdminLog(!isPremium ? "ACTIVATE_PREMIUM" : "REMOVE_PREMIUM", {
      targetUid: uid
    });

    await loadUsers();
  }catch(e){
    alert("Erreur : impossible de modifier le statut Premium.");
    console.error(e);
  }
};

async function loadPublicMessages(){
  const container = document.getElementById("messagesData");
  container.innerHTML = "";

  const q = query(collection(db, "blogMessages"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  if(snapshot.empty){
    container.innerHTML = `<div class="empty">Aucun message public.</div>`;
    return;
  }

  snapshot.forEach(item => {
    const m = item.data();
    const id = item.id;
    const visible = m.visible !== false;
    const dateObj = m.createdAt?.toDate ? m.createdAt.toDate() : null;

    const div = document.createElement("div");
    div.className = visible ? "card" : "card hidden-response";

    div.innerHTML = `
      ${!visible ? `<div class="badge-hidden">Message masqué</div>` : ""}
      <div class="field"><span class="label">Salon :</span> ${m.room || "general"}</div>
      <div class="field"><span class="label">Pseudo :</span> ${m.pseudo || "Anonyme"}</div>
      <div class="field"><span class="label">UID :</span> ${m.uid || ""}</div>
      <div class="field"><span class="label">Type :</span> ${m.type || "text"}</div>
      <div class="field"><span class="label">Date :</span> ${dateObj ? dateObj.toLocaleString("fr-FR") : ""}</div>
      <div class="message"><span class="label">Message :</span><br>${m.message || ""}</div>
      ${m.imageUrl ? `<div class="message"><span class="label">Image :</span><br><a href="${m.imageUrl}" target="_blank">Voir l’image</a></div>` : ""}

      <button onclick="togglePublicMessageVisibility('${id}', ${visible})" class="hide-btn">
        ${visible ? "Masquer ce message" : "Afficher ce message"}
      </button>

      ${m.uid ? `
        <button class="report-btn" onclick="disableUser('${m.uid}')">
          Bloquer l’utilisateur
        </button>
      ` : ""}
    `;

    container.appendChild(div);
  });
}

window.togglePublicMessageVisibility = async function(id, isVisible){
  try{
    await updateDoc(doc(db, "blogMessages", id), {
      visible: !isVisible
    });

    await addAdminLog(isVisible ? "HIDE_PUBLIC_MESSAGE" : "SHOW_PUBLIC_MESSAGE", {
      messageId: id
    });

    await loadPublicMessages();
  }catch(e){
    alert("Erreur lors de la modification du message.");
    console.error(e);
  }
};

window.toggleVisibility = async function(id, isVisible){
  try{
    await updateDoc(doc(db, "reponses", id), {
      visible: !isVisible
    });

    await addAdminLog(isVisible ? "HIDE_TESTIMONIAL" : "SHOW_TESTIMONIAL", {
      testimonialId: id
    });

    await loadData();
  }catch(e){
    alert("Erreur lors de la modification");
    console.error(e);
  }
};

window.toggleReplyVisibility = async function(parentId, replyId, isVisible){
  try{
    await updateDoc(doc(db, "reponses", parentId, "commentaires", replyId), {
      visible: !isVisible
    });     

    await addAdminLog(isVisible ? "HIDE_TESTIMONIAL_REPLY" : "SHOW_TESTIMONIAL_REPLY", {
      testimonialId: parentId,
      replyId: replyId
    });

    await loadData();
  }catch(e){
    alert("Erreur lors de la modification de la réponse");
    console.error(e);
  }
};

function renderDailyChart(daysData){
  const labels = Object.keys(daysData).sort();
  const values = labels.map(day => daysData[day]);

  const ctx = document.getElementById("dailyChart");

  if(!ctx) return;

  if(dailyChart){
    dailyChart.destroy();
  }

  dailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Formulaires envoyés",
        data: values,
        backgroundColor: "#6f42bd",
        borderRadius: 8
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ display:false }
      },
      scales:{
        y:{
          beginAtZero:true,
          ticks:{ precision:0 }
        }
      }
    }
  });
}

async function loadReplies(parentId, repliesContainer){
  repliesContainer.innerHTML = "";

  const q = query(
    collection(db, "reponses", parentId, "commentaires"),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);
  let count = 0;

  snap.forEach(replyDoc => {
    const r = replyDoc.data();
    const replyId = replyDoc.id;
    const isVisible = r.visible !== false;
    const dateObj = r.createdAt?.toDate ? r.createdAt.toDate() : null;

    count++;

    const div = document.createElement("div");
    div.className = isVisible ? "reply-admin" : "reply-admin hidden-reply";

    div.innerHTML = `
      ${!isVisible ? `<div class="badge-hidden">Réponse masquée</div>` : ""}
      ${r.message || "Réponse vide"}
      <small>Réponse anonyme ${dateObj ? "• " + dateObj.toLocaleString("fr-FR") : ""}</small>

      <button onclick="toggleReplyVisibility('${parentId}', '${replyId}', ${isVisible})"
        class="reply-hide-btn ${isVisible ? "" : "show"}">
        ${isVisible ? "Masquer cette réponse" : "Afficher cette réponse"}
      </button>
    `;

    repliesContainer.appendChild(div);
  });

  if(count === 0){
    repliesContainer.innerHTML = `<div class="field"><span class="label">Réponses :</span> Aucune réponse pour ce témoignage.</div>`;
  }
}

async function loadData(){
  const container = document.getElementById("data");
  container.innerHTML = "";

  let total = 0;
  let daysData = {};

  const q = query(collection(db, "reponses"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  if(snapshot.empty){
    container.innerHTML = `<div class="empty">Aucune réponse pour le moment.</div>`;
  }

  for(const item of snapshot.docs){
    const d = item.data();
    const id = item.id;
    const isVisible = d.visible !== false;

    total++;

    let dateObj = null;

    if(d.createdAt && d.createdAt.toDate){
      dateObj = d.createdAt.toDate();
      const dayKey = dateObj.toLocaleDateString("fr-FR");
      daysData[dayKey] = (daysData[dayKey] || 0) + 1;
    }

    const expressionText = Array.isArray(d.expression)
      ? d.expression.join(", ")
      : (d.expression || "");

    const div = document.createElement("div");
    div.className = isVisible ? "card" : "card hidden-response";

    div.innerHTML = `
      ${!isVisible ? `<div class="badge-hidden">Témoignage masqué</div>` : ""}
      <div class="field"><span class="label">Âge :</span> ${d.age || ""}</div>
      <div class="field"><span class="label">Genre :</span> ${d.genre || ""}</div>
      <div class="field"><span class="label">Justice :</span> ${d.justice || ""}</div>
      <div class="field"><span class="label">Parlé :</span> ${d.parle || ""}</div>
      <div class="field"><span class="label">Écoute :</span> ${d.ecoute || ""}</div>
      <div class="field"><span class="label">Expression :</span> ${expressionText}</div>
      <div class="field"><span class="label">Partage autorisé :</span> ${d.partageAutorise ? "Oui" : "Non"}</div>
      <div class="field"><span class="label">Inscrit au blog :</span> ${d.blogAccessRequested ? "Oui" : "Non"}</div>
      <div class="field"><span class="label">Pseudo blog :</span> ${d.blogPseudo || ""}</div>
      <div class="field"><span class="label">UID blog :</span> ${d.blogUid || ""}</div>
      <div class="field"><span class="label">Affiché sur la page témoignages :</span> ${isVisible ? "Oui" : "Non"}</div>
      <div class="field"><span class="label">Date :</span> ${dateObj ? dateObj.toLocaleString("fr-FR") : ""}</div>
      <div class="message"><span class="label">Message :</span><br>${d.message || "Aucun message"}</div>

      <button onclick="toggleVisibility('${id}', ${isVisible})" class="hide-btn">
        ${isVisible ? "Masquer le témoignage" : "Afficher le témoignage"}
      </button>

      <div class="replies-admin">
        <div class="replies-admin-title">Réponses anonymes à ce témoignage</div>
        <div id="admin-replies-${id}"></div>
      </div>
    `;

    container.appendChild(div);
    await loadReplies(id, document.getElementById("admin-replies-" + id));
  }

  document.getElementById("total").innerText = total;
  renderDailyChart(daysData);
}

async function loadAdminLogs(){
  const container = document.getElementById("adminLogsData");

  if(!container) return;

  container.innerHTML = "";

  const q = query(
    collection(db, "adminLogs"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  if(snapshot.empty){
    container.innerHTML =
      `<div class="empty">Aucune action administrateur.</div>`;
    return;
  }

  snapshot.forEach(item => {
    const log = item.data();

    const dateObj = log.createdAt?.toDate
      ? log.createdAt.toDate()
      : null;

    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
<div class="field">
  <span class="label">Action :</span>
  ${log.action || ""}
</div>

<div class="field">
  <span class="label">Utilisateur signalé :</span>
  ${log.reportedUserPseudo || log.targetUid || "Aucun"}
</div>

<div class="field">
  <span class="label">UID utilisateur :</span>
  ${log.reportedUserUid || "Aucun"}
</div>

<div class="field">
  <span class="label">Auteur du signalement :</span>
  ${log.reportedByUid || "Inconnu"}
</div>

<div class="field">
  <span class="label">Raison :</span>
  ${log.reason || "Aucune"}
</div>

<div class="field">
  <span class="label">Message signalé :</span>
  ${log.reportedMessage || "Aucun"}
</div>

<div class="field">
  <span class="label">Date :</span>
  ${dateObj ? dateObj.toLocaleString("fr-FR") : ""}
</div>
`;

    container.appendChild(div);
  });
}

window.toggleReportedUserDetails = function(id){
  const el = document.getElementById(id);
  if(!el) return;

  el.style.display = el.style.display === "none" ? "block" : "none";
};

async function loadReportedUsers(){
  const container = document.getElementById("reportedUsersData");
  if(!container) return;

  container.innerHTML = "";

  const snapshot = await getDocs(collection(db, "reports"));

  if(snapshot.empty){
    container.innerHTML = `<div class="empty">Aucun utilisateur signalé.</div>`;
    return;
  }

  const grouped = {};

  snapshot.forEach(item => {
    const r = item.data();
    const uid = r.reportedUserUid || r.authorUid;

    if(!uid) return;

    if(!grouped[uid]){
      grouped[uid] = [];
    }

    grouped[uid].push({
      id:item.id,
      ...r
    });
  });

  for(const uid in grouped){
    const reports = grouped[uid];
    const first = reports[0];
    const reportsCount = reports.length;

let dangerLevel = "🟢 Faible";
let borderColor = "#27ae60";

if(reportsCount >= 2){
  dangerLevel = "🟠 Surveillance";
  borderColor = "#f39c12";
}

if(reportsCount >= 5){
  dangerLevel = "🔴 Dangereux";
  borderColor = "#e74c3c";
}

    let userData = {};

    try{
      const userSnap = await getDoc(doc(db, "blogUsers", uid));
      if(userSnap.exists()){
        userData = userSnap.data();
      }
    }catch(e){
      console.error(e);
    }

    const safeId = "reported-user-" + uid.replace(/[^a-zA-Z0-9]/g, "");

    let reportsHtml = "";

    reports.forEach((r, index) => {
      const dateObj = r.createdAt?.toDate ? r.createdAt.toDate() : null;

      reportsHtml += `
        <div class="report-card" style="margin-top:15px;">
          <strong>Signalement n°${index + 1}</strong>

          <div class="field">
            <span class="label">Signalé par :</span>
            ${r.reportedBy || "Inconnu"}
          </div>

          <div class="field">
            <span class="label">Raison :</span>
            ${r.reason || "Aucune"}
          </div>

          <div class="field">
            <span class="label">Décision admin :</span>
            ${r.adminDecision || "En attente"}
          </div>

          <div class="field">
            <span class="label">Date :</span>
            ${dateObj ? dateObj.toLocaleString("fr-FR") : ""}
          </div>
        </div>
      `;
    });

    const div = document.createElement("div");
div.className = "card";
div.style.borderLeft = `6px solid ${borderColor}`;

div.innerHTML = `
  <div class="field">
    <strong>👤 ${userData.pseudo || first.reportedUserPseudo || "Utilisateur"}</strong><br>
    <span class="label">Email :</span> ${userData.email || "Non renseigné"}<br>
    <span class="label">Signalements :</span> ${reports.length}
  </div>

  <button class="hide-btn" onclick="toggleReportedUserDetails('${safeId}')">
    Voir / cacher le dossier
  </button>

  <div id="${safeId}" style="display:none; margin-top:15px;">
    <div class="field"><span class="label">UID :</span> ${uid}</div>
    <div class="field"><span class="label">Pseudo :</span> ${userData.pseudo || first.reportedUserPseudo || "Non renseigné"}</div>
    <div class="field"><span class="label">Email :</span> ${userData.email || "Non renseigné"}</div>
    <div class="field"><span class="label">Genre :</span> ${userData.genre || "Non renseigné"}</div>
    <div class="field"><span class="label">Âge :</span> ${userData.age || "Non renseigné"}</div>
    <div class="field"><span class="label">Département :</span> ${userData.departement || "Non renseigné"}</div>
    <div class="field"><span class="label">Niveau :</span> ${dangerLevel}</div>
    <div class="field"><span class="label">Nombre de signalements :</span> ${reports.length}</div>

    ${reportsHtml}
  </div>
`;
    container.appendChild(div);
  }
}
window.openBlogAsAdmin = function(){
  window.open("./blog.html", "_blank");
};
