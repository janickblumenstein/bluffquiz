// === core.js - Basis-Modul ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// HIER FIREBASE API KEY EINSETZEN
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "bierkultur-d2fea.firebaseapp.com",
  databaseURL: "https://bierkultur-d2fea-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "bierkultur-d2fea"
};
const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

// === Globales App-Objekt fuer andere Module ===
const App = window.App = {
  db, ref, set, onValue, update, get, remove,
  user: null, room: null, isHost: false,
  state: {}, players: {},
  timers: [],
  listeners: {},  // andere Module koennen hier ihre render-Funktionen eintragen
  $: id => document.getElementById(id),
  toast, shuffle, awardScore, switchTab, clearTimers
};

function clearTimers(){ App.timers.forEach(t=>{clearInterval(t);clearTimeout(t)}); App.timers=[]; }
function shuffle(a){ return [...a].sort(()=>Math.random()-0.5); }

function toast(text, duration=2500){
  const c=App.$("toastContainer");
  const t=document.createElement("div");
  t.className="toast"; t.innerText=text;
  c.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}

async function awardScore(player, pts, casual=false){
  const key=casual?"casual":"score";
  const r=ref(db,`rooms/${App.room}/players/${player}/${key}`);
  const cur=(await get(r)).val()||0;
  await set(r,cur+pts);
}

// === LANDINGPAGE: 3x Tap auf Logo aktiviert Host-Button ===
let logoTaps=0, logoTapTimer=null;
App.$("landingLogo").addEventListener("click", ()=>{
  logoTaps++;
  clearTimeout(logoTapTimer);
  logoTapTimer=setTimeout(()=>{ logoTaps=0; },1500);
  if(logoTaps>=3){
    App.$("btnHost").classList.remove("hidden");
    App.$("landingLogo").style.animation="shine 1s infinite";
    toast("Host-Modus freigeschaltet 👑");
    logoTaps=0;
  }
});

App.$("btnJoin").onclick=()=>start(false);
App.$("btnHost").onclick=()=>start(true);
App.$("overlayClose").onclick=()=>App.$("overlay").classList.remove("show");

async function start(takeHost){
  App.user=App.$("nameInp").value.trim();
  App.room=(App.$("roomInp").value.trim()||"MALLE26").toUpperCase();
  if(!App.user) return alert("Name eingeben!");
  const metaSnap=await get(ref(db,`rooms/${App.room}/meta`));
  if(!metaSnap.exists()){
    await set(ref(db,`rooms/${App.room}/meta`),{host:App.user,created:Date.now()});
    // seed defaults wird in den Submodulen gemacht
    if(App.listeners.seedDefaults) await App.listeners.seedDefaults();
  } else if(takeHost){
    await update(ref(db,`rooms/${App.room}/meta`),{host:App.user});
  }
  const pRef=ref(db,`rooms/${App.room}/players/${App.user}`);
  if(!(await get(pRef)).exists()){
    await set(pRef,{score:0,casual:0,bonusVotes:0,joined:Date.now()});
  }
  App.$("login").classList.add("hidden");
  App.$("app").classList.remove("hidden");
  App.$("tabbar").classList.remove("hidden");
  attachListeners();
  bindCoreUI();
  // submodule bind
  if(App.listeners.onReady) App.listeners.onReady();
}

function attachListeners(){
  onValue(ref(db,`rooms/${App.room}/meta`),snap=>{
    const m=snap.val()||{};
    App.isHost=(m.host===App.user);
    App.$("userBadge").innerHTML=App.user+(App.isHost?' <span class="badge host">(Host)</span>':'');
    App.$("hostStatus").innerHTML=`Aktueller Host: <b>${m.host||'-'}</b>`;
    App.$("btnTakeHost").style.display=App.isHost?"none":"block";
    App.$("hostControls").classList.toggle("hidden",!App.isHost);
  });
  onValue(ref(db,`rooms/${App.room}/players`),snap=>{
    App.players=snap.val()||{};
    renderLeaderboard();
    renderTokens();
    renderTokenSelect();
    // notify other modules
    if(App.listeners.onPlayers) App.listeners.onPlayers();
  });
  onValue(ref(db,`rooms/${App.room}/notifications`),snap=>{
    const n=snap.val()||{};
    for(const [key,notif] of Object.entries(n)){
      if(notif.to!==App.user||notif.shown) continue;
      toast(notif.text,4000);
      set(ref(db,`rooms/${App.room}/notifications/${key}/shown`),true);
      setTimeout(()=>remove(ref(db,`rooms/${App.room}/notifications/${key}`)),10000);
    }
  });
  onValue(ref(db,`rooms/${App.room}/hostRequest`),snap=>{
    const req=snap.val(); if(!req||req.from===App.user||!App.isHost) return;
    if(confirm(`${req.from} moechte Host uebernehmen. Erlauben?`)){
      update(ref(db,`rooms/${App.room}/meta`),{host:req.from}).then(()=>{
        remove(ref(db,`rooms/${App.room}/hostRequest`));
        toast(`Host an ${req.from} uebergeben`);
      });
    } else {
      remove(ref(db,`rooms/${App.room}/hostRequest`));
    }
  });
  onValue(ref(db,`rooms/${App.room}/event`),snap=>{
    const e=snap.val(); if(!e||e.ts===App._lastEventTs) return;
    App._lastEventTs=e.ts;
    App.$("overlayText").innerText=e.text;
    App.$("overlay").classList.add("show");
  });
}

function bindCoreUI(){
  // Tabs
  document.querySelectorAll(".tab").forEach(t=>{
    t.onclick=()=>switchTab(t.dataset.tab);
  });
  // Host takeover request
  App.$("btnTakeHost").onclick=async()=>{
    if(!confirm("Host-Anfrage senden? Der aktuelle Host muss bestaetigen.")) return;
    await set(ref(db,`rooms/${App.room}/hostRequest`),{from:App.user,ts:Date.now()});
    toast("Anfrage gesendet");
  };
  // Host tools
  App.$("btnResetScores").onclick=async()=>{
    if(!App.isHost||!confirm("Alle Scores auf 0?")) return;
    const upd={};
    Object.keys(App.players).forEach(p=>{upd[`${p}/score`]=0;upd[`${p}/casual`]=0;upd[`${p}/bonusVotes`]=0});
    await update(ref(db,`rooms/${App.room}/players`),upd);
  };
  App.$("btnFullReset").onclick=async()=>{
    if(!App.isHost||!confirm("ALLES loeschen?")) return;
    await remove(ref(db,`rooms/${App.room}`));
    location.reload();
  };
  App.$("btnDrinkEvent").onclick=()=>{
    const rules=["ALLE TRINKEN!","Letzter trinkt 2 Schlucke","Brillentraeger trinken","Top 3 trinken","Host bestimmt wer trinkt"];
    set(ref(db,`rooms/${App.room}/event`),{text:rules[Math.floor(Math.random()*rules.length)],ts:Date.now()});
  };
  App.$("giveBonusVote").onclick=async()=>{
    if(!App.isHost) return;
    const p=App.$("tokenPlayer").value; if(!p) return;
    const r=ref(db,`rooms/${App.room}/players/${p}/bonusVotes`);
    const cur=(await get(r)).val()||0;
    await set(r,cur+1);
    toast(`Bonus-Stimme an ${p}`);
  };
  App.$("giveHostPoints").onclick=async()=>{
    if(!App.isHost) return;
    const p=App.$("tokenPlayer").value; if(!p) return;
    const amt=parseInt(App.$("hostPointAmt").value)||0;
    if(amt===0) return;
    await awardScore(p,amt);
    toast(`${amt>0?'+':''}${amt} Pkt an ${p}`);
  };
}

function switchTab(name){
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));
  document.querySelectorAll(".tabPane").forEach(p=>p.classList.add("hidden"));
  App.$("tab"+name).classList.remove("hidden");
}

function renderLeaderboard(){
  const sorted=Object.entries(App.players).sort((a,b)=>{
    const sa=(a[1].score||0)+((a[1].casual||0)*0.1);
    const sb=(b[1].score||0)+((b[1].casual||0)*0.1);
    return sb-sa;
  });
  App.$("leaderboard").innerHTML=sorted.map(([n,d],i)=>{
    const tot=(d.score||0)+((d.casual||0)*0.1);
    return `<div class="score-row ${n===App.user?'me':''} ${i===0?'top':''}">
      <span>${i===0?'👑 ':(i+1+'. ')}${n}</span>
      <strong>${tot.toFixed(1)} Pkt<span class="casual">(${d.score||0}+${d.casual||0}c)</span></strong>
    </div>`;
  }).join("")||'<div class="sub">Keine Spieler</div>';
}

function renderTokens(){
  const me=App.players[App.user]||{};
  let html="";
  if(me.bonusVotes) html+=`<div style="margin-bottom:10px"><span class="token bonus">⭐ ${me.bonusVotes}x Bonus-Stadt-Stimme</span></div>`;
  html+=`<div class="sub">Verschenke Punkte an andere (z.B. als Bribe). Der Empfaenger wird benachrichtigt.</div>`;
  const others=Object.keys(App.players).filter(p=>p!==App.user);
  if(others.length){
    html+=`<div class="row" style="margin-top:8px">
      <select id="giftTarget">${others.map(p=>`<option value="${p}">${p}</option>`).join("")}</select>
      <input id="giftAmount" type="number" placeholder="Pkt" style="max-width:80px">
    </div>
    <button class="btn-purple" id="giftSend">💝 Punkte senden</button>`;
  }
  App.$("myTokens").innerHTML=html;
  const gs=App.$("giftSend");
  if(gs) gs.onclick=async()=>{
    const target=App.$("giftTarget").value;
    const amt=parseInt(App.$("giftAmount").value);
    if(!target||!amt||amt<=0) return;
    const me=App.players[App.user]||{};
    if((me.score||0)<amt) return alert("Nicht genug Punkte!");
    await awardScore(App.user,-amt);
    await awardScore(target,amt);
    await set(ref(db,`rooms/${App.room}/notifications/${target}_${Date.now()}`),{
      to:target,from:App.user,text:`💝 ${App.user} hat dir ${amt} Punkte geschenkt!`,ts:Date.now()
    });
    App.$("giftAmount").value="";
    toast(`${amt} Pkt an ${target} geschickt`);
  };
}

function renderTokenSelect(){
  const sel=App.$("tokenPlayer"); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML=Object.keys(App.players).map(p=>`<option value="${p}">${p}</option>`).join("");
  if(cur) sel.value=cur;
}

console.log("✅ core.js loaded");
