// === missions.js - Einmalig/Mehrmalig Missionen ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore}=A;

const DEFAULT_MISSIONS=[
  {title:"Gruppenfoto mit Einheimischem",desc:"Charmant fragen ob er aufs Foto will",points:10,type:"once"},
  {title:"Paella zusammen essen",desc:"Mind. ein Teller pro Person geteilt",points:5,type:"once"},
  {title:"Bestellen komplett auf Spanisch",desc:"Ohne ein englisches Wort",points:5,type:"multi"},
  {title:"3 verschiedene Bars an einem Tag",desc:"Alle zusammen",points:10,type:"once"},
  {title:"Sonnenuntergangs-Gruppenfoto",desc:"Am Meer, alle drauf",points:5,type:"once"},
  {title:"Barkeeper zum Lachen gebracht",desc:"Joke, Story, egal wie",points:5,type:"multi"},
  {title:"Alle mit Hut gleichzeitig",desc:"Foto als Beweis",points:10,type:"once"},
  {title:"Tanzen im Club",desc:"Die ganze Gruppe auf der Tanzflaeche",points:10,type:"once"},
  {title:"Im Meer baden",desc:"Komplett rein, nicht nur Fuesse",points:5,type:"multi"},
  {title:"Nachtschwimmen",desc:"Nach Mitternacht im Meer",points:20,type:"once"},
  {title:"Kuriose Sehenswuerdigkeit besucht",desc:"Etwas Untouristisches",points:10,type:"once"},
  {title:"Mit Einheimischen angestossen",desc:"Salud!",points:5,type:"multi"}
];

const prevSeed=A.listeners.seedDefaults;
A.listeners.seedDefaults=async()=>{
  if(prevSeed) await prevSeed();
  const mObj={};
  DEFAULT_MISSIONS.forEach((m,i)=>{
    if(m.type==="multi") mObj["m_"+i]={...m,createdBy:"System",completed:{}};
    else mObj["m_"+i]={...m,createdBy:"System",done:false,claimedBy:null,confirmedBy:[],vetoedBy:[]};
  });
  await set(ref(db,`rooms/${A.room}/missions`),mObj);
};

const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
  onValue(ref(db,`rooms/${A.room}/missions`),snap=>{
    A.state.missions=snap.val()||{};
    renderMissions();
  });
  $("addMission").onclick=addMission;
};

function renderMissions(){
  const list=$("missionsList");
  const missions=A.state.missions||{};
  const entries=Object.entries(missions).sort((a,b)=>{
    const aDone=a[1].type==="once"?a[1].done:false;
    const bDone=b[1].type==="once"?b[1].done:false;
    if(aDone!==bDone) return aDone?1:-1;
    return (b[1].points||0)-(a[1].points||0);
  });
  list.innerHTML=entries.map(([id,m])=>{
    const isMulti=m.type==="multi";
    const typeTag=isMulti?'<span class="type-tag group">MEHRMALIG</span>':'<span class="type-tag solo">EINMALIG</span>';
    let actions="";

    if(isMulti){
      const completed=m.completed||{};
      const myEntry=completed[A.user];
      const doneList=Object.entries(completed).filter(([p,e])=>e&&e.done).map(([p])=>p);
      if(myEntry&&myEntry.done){
        actions+=`<div class="sub">✅ Du hast es erledigt (+${m.points} Pkt)</div>`;
      } else if(myEntry&&!myEntry.done){
        const cb=(myEntry.confirmedBy||[]).length;
        actions+=`<div class="sub">Dein Anspruch: ${cb}/2 Bestaetigungen</div>`;
        actions+=`<button class="btn-ghost btn-sm" data-leavemulti="${id}">Zuruecknehmen</button>`;
      } else {
        actions+=`<button class="btn-green btn-sm" data-joinmulti="${id}">Ich habs!</button>`;
      }
      const pendingOthers=Object.entries(completed).filter(([p,e])=>p!==A.user&&e&&!e.done&&!(e.confirmedBy||[]).includes(A.user));
      if(pendingOthers.length){
        actions+='<div class="sub" style="margin-top:6px">Bestaetigen:</div>';
        pendingOthers.forEach(([p,e])=>{
          const cb=(e.confirmedBy||[]).length;
          actions+=`<button class="btn-blue btn-sm" data-confirmmulti="${id}" data-target="${p}">✓ ${p} (${cb}/2)</button> `;
          actions+=`<button class="btn-red btn-sm" data-vetomulti="${id}" data-target="${p}">✗</button> `;
        });
      }
      if(doneList.length) actions+=`<div class="sub" style="margin-top:6px">Erledigt: ${doneList.join(", ")}</div>`;
      return `<div class="mission group">
        <span class="pts">${m.points} Pkt</span>
        ${typeTag}<b>${m.title}</b>
        ${m.desc?`<div class="desc">${m.desc}</div>`:""}
        ${actions}
      </div>`;
    }

    // ONCE mode
    const conf=(m.confirmedBy||[]).length;
    const claimed=m.claimedBy;
    const iClaimed=claimed===A.user;
    const iConfirmed=(m.confirmedBy||[]).includes(A.user);
    if(m.done){
      actions=`<div class="sub">✅ Erledigt von ${claimed} · +${m.points} Pkt</div>`;
    } else {
      if(!claimed){
        actions+=`<button class="btn-green btn-sm" data-join="${id}">Ich habs!</button>`;
      } else if(iClaimed){
        actions+=`<div class="sub">Dein Anspruch: ${conf}/2 Bestaetigungen</div>`;
        actions+=`<button class="btn-ghost btn-sm" data-leave="${id}">Zuruecknehmen</button>`;
      } else {
        actions+=`<div class="sub">Beansprucht von: ${claimed} (${conf}/2)</div>`;
        if(!iConfirmed){
          actions+=`<button class="btn-blue btn-sm" data-confirm="${id}">✓ Bestaetigen</button> `;
          actions+=`<button class="btn-red btn-sm" data-veto="${id}">✗ Quatsch</button>`;
        } else actions+=`<div class="sub">Du hast bestaetigt</div>`;
      }
    }
    return `<div class="mission ${m.done?'done':''}">
      <span class="pts">${m.points} Pkt</span>
      ${typeTag}<b>${m.title}</b>
      ${m.desc?`<div class="desc">${m.desc}</div>`:""}
      ${actions}
    </div>`;
  }).join("")||'<div class="sub">Keine Missionen</div>';

  list.querySelectorAll("[data-join]").forEach(b=>b.onclick=()=>joinOnce(b.dataset.join));
  list.querySelectorAll("[data-leave]").forEach(b=>b.onclick=()=>leaveOnce(b.dataset.leave));
  list.querySelectorAll("[data-confirm]").forEach(b=>b.onclick=()=>confirmOnce(b.dataset.confirm));
  list.querySelectorAll("[data-veto]").forEach(b=>b.onclick=()=>vetoOnce(b.dataset.veto));
  list.querySelectorAll("[data-joinmulti]").forEach(b=>b.onclick=()=>joinMulti(b.dataset.joinmulti));
  list.querySelectorAll("[data-leavemulti]").forEach(b=>b.onclick=()=>leaveMulti(b.dataset.leavemulti));
  list.querySelectorAll("[data-confirmmulti]").forEach(b=>b.onclick=()=>confirmMulti(b.dataset.confirmmulti,b.dataset.target));
  list.querySelectorAll("[data-vetomulti]").forEach(b=>b.onclick=()=>vetoMulti(b.dataset.vetomulti,b.dataset.target));
}

async function addMission(){
  const t=$("newMissionTitle").value.trim(); if(!t) return;
  const d=$("newMissionDesc").value.trim();
  const p=parseInt($("newMissionPoints").value);
  const type=$("newMissionType").value;
  const base={title:t,desc:d,points:p,type,createdBy:A.user};
  if(type==="multi") base.completed={};
  else { base.done=false; base.claimedBy=null; base.confirmedBy=[]; base.vetoedBy=[]; }
  await set(ref(db,`rooms/${A.room}/missions/m_${Date.now()}`),base);
  $("newMissionTitle").value=""; $("newMissionDesc").value="";
  toast("Mission hinzugefuegt");
}

async function joinOnce(id){
  const r=ref(db,`rooms/${A.room}/missions/${id}`);
  const m=(await get(r)).val(); if(!m||m.done||m.claimedBy) return;
  await update(r,{claimedBy:A.user,confirmedBy:[],vetoedBy:[]});
}
async function leaveOnce(id){
  const r=ref(db,`rooms/${A.room}/missions/${id}`);
  const m=(await get(r)).val(); if(!m||m.done) return;
  if(m.claimedBy===A.user) await update(r,{claimedBy:null,confirmedBy:[],vetoedBy:[]});
}
async function confirmOnce(id){
  const r=ref(db,`rooms/${A.room}/missions/${id}`);
  const m=(await get(r)).val(); if(!m||m.done||!m.claimedBy||m.claimedBy===A.user) return;
  const cb=m.confirmedBy||[];
  if(cb.includes(A.user)) return;
  cb.push(A.user);
  if(cb.length>=2){
    await update(r,{confirmedBy:cb,done:true});
    await awardScore(m.claimedBy,m.points);
    toast(`Mission "${m.title}" abgeschlossen!`);
  } else await update(r,{confirmedBy:cb});
}
async function vetoOnce(id){
  const r=ref(db,`rooms/${A.room}/missions/${id}`);
  const m=(await get(r)).val(); if(!m||m.done) return;
  if(!confirm("Veto einlegen? Anspruch wird zurueckgesetzt.")) return;
  await update(r,{claimedBy:null,confirmedBy:[],vetoedBy:[A.user]});
  toast("Veto - Anspruch zurueckgesetzt");
}
async function joinMulti(id){
  const r=ref(db,`rooms/${A.room}/missions/${id}/completed/${A.user}`);
  if((await get(r)).val()) return;
  await set(r,{confirmedBy:[],done:false,claimedAt:Date.now()});
}
async function leaveMulti(id){
  const r=ref(db,`rooms/${A.room}/missions/${id}/completed/${A.user}`);
  const cur=(await get(r)).val();
  if(cur&&!cur.done) await remove(r);
}
async function confirmMulti(id,target){
  if(target===A.user) return;
  const r=ref(db,`rooms/${A.room}/missions/${id}/completed/${target}`);
  const entry=(await get(r)).val();
  if(!entry||entry.done) return;
  const cb=entry.confirmedBy||[];
  if(cb.includes(A.user)) return;
  cb.push(A.user);
  if(cb.length>=2){
    const m=(await get(ref(db,`rooms/${A.room}/missions/${id}`))).val();
    await update(r,{confirmedBy:cb,done:true});
    await awardScore(target,m.points);
    toast(`${target} hat "${m.title}" erfuellt`);
  } else await update(r,{confirmedBy:cb});
}
async function vetoMulti(id,target){
  if(!confirm(`Veto gegen ${target}? Sein Anspruch wird geloescht.`)) return;
  await remove(ref(db,`rooms/${A.room}/missions/${id}/completed/${target}`));
  toast(`Veto gegen ${target}`);
}

console.log("✅ missions.js loaded");
