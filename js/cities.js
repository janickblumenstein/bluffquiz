// === cities.js - Staedte-Voting mit allen Modi ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore}=A;

const DEFAULT_CITIES=["Lissabon","Prag","Krakau","Budapest","Valencia","Porto","Sevilla","Neapel","Belgrad"];

const DEFAULT_CITIES = {
  "Lissabon": [38.7223, -9.1393],
  "Prag": [50.0755, 14.4378],
  "Krakau": [50.0647, 19.9450],
  "Budapest": [47.4979, 19.0402],
  "Valencia": [39.4699, -0.3763],
  "Porto": [41.1579, -8.6291],
  "Sevilla": [37.3891, -5.9845],
  "Neapel": [40.8518, 14.2681],
  "Belgrad": [44.7866, 20.4489]
};

let map = null;
let markers = {};

// In die renderCities() Funktion einbauen:
function updateMap(list) {
  if (!map) {
    map = L.map('cityMap').setView([47.3769, 8.5417], 4); // Startpunkt Europa
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
  }

  // Marker löschen oder aktualisieren
  Object.values(markers).forEach(m => map.removeLayer(m));
  
  Object.entries(list).forEach(([id, city]) => {
    const coords = DEFAULT_CITIES[city.name] || [47, 8]; // Fallback
    const isElim = city.status === 'eliminated';
    
    const marker = L.circleMarker(coords, {
      radius: isElim ? 5 : 8,
      fillColor: isElim ? "#e74c3c" : "#ffcc00",
      color: "#fff",
      weight: 1,
      fillOpacity: isElim ? 0.3 : 1
    }).addTo(map);

    marker.bindPopup(`<b>${city.name}</b><br>Stimmen: ${city.votes || 0}`);
    markers[id] = marker;
  });
}

// === SEED ===
const prevSeed=A.listeners.seedDefaults;
A.listeners.seedDefaults=async()=>{
  if(prevSeed) await prevSeed();
  const cityObj={};
  DEFAULT_CITIES.forEach((n,i)=>{cityObj["c_"+i]={name:n,status:"active",votes:0,price:"",depCh:"",depBack:""}});
  await set(ref(db,`rooms/${A.room}/cities/list`),cityObj);
};

// === LISTENERS ===
const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
  onValue(ref(db,`rooms/${A.room}/cities`),snap=>{
    A.state.cities=snap.val()||{};
    renderCities();
  });
  bindCityUI();
};

function bindCityUI(){
  document.querySelectorAll("[data-cityvote]").forEach(b=>{
    b.onclick=()=>startCityVote(b.dataset.cityvote);
  });
  $("addCity").onclick=addCity;
  $("endCityVote").onclick=endCityVote;
  $("cityLowestOut").onclick=lowestOut;
  $("cityResetVotes").onclick=resetVotes;
  $("cityReactivateAll").onclick=reactivateAll;
}

// === RENDER ===
function renderCities(){
  const c=A.state.cities||{};
  const list=c.list||{};
  const round=c.round;
  const entries=Object.entries(list).sort((a,b)=>{
    if(a[1].status!==b[1].status) return a[1].status==="active"?-1:1;
    return (b[1].votes||0)-(a[1].votes||0);
  });

  $("citiesList").innerHTML=entries.map(([k,city])=>{
    const meta=[];
    if(city.price) meta.push(`💰 ${city.price}`);
    if(city.depCh) meta.push(`🛫 CH: ${city.depCh}`);
    if(city.depBack) meta.push(`🛬 zurück: ${city.depBack}`);
    const metaLine=meta.length?`<div class="city-meta">${meta.join(" · ")}</div>`:"";
    return `<div class="city-row ${city.status==='eliminated'?'elim':''}" data-cid="${k}">
      <div style="flex:1">
        <div style="font-weight:bold">${city.name}</div>
        ${metaLine}
      </div>
      ${city.votes?`<span class="vote-pill ${city.votes<0?'neg':''}">${city.votes>0?'+':''}${city.votes}</span>`:''}
    </div>`;
  }).join("")||'<div class="sub">Keine Staedte</div>';

  // Tap auf Stadt oeffnet Editor (nur Host)
  document.querySelectorAll("#citiesList .city-row").forEach(el=>{
    el.onclick=()=>{ if(A.isHost) openCityEditor(el.dataset.cid); };
  });

  // Voting-Aktionsbereich
  const aa=$("citiesAction"); aa.innerHTML="";
  if(round&&round.type){ renderVoteAction(aa,round,list,entries); }
}

function renderVoteAction(aa,round,list,entries){
  const myV=(round.votes||{})[A.user];
  const me=A.players[A.user]||{};
  const activeOnly=entries.filter(e=>e[1].status==="active");

  if(round.type==="pos3"){
    const bonusUsed=(round.bonusUsed||{})[A.user]||0;
    const canBonus=(me.bonusVotes||0)>bonusUsed;
    aa.innerHTML=`<hr><h3>Vergib 3 Punkte (max. 3 Staedte):</h3>`+activeOnly.map(([k,city])=>{
      const sel=myV&&myV.includes(k);
      return `<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'✓ ':''}${city.name}</button>`;
    }).join("")+(canBonus?`<hr><div class="sub">Du hast Bonus-Stimmen! +1 fuer:</div>`+activeOnly.map(([k,city])=>`<button class="btn-purple btn-sm" data-bonus="${k}">⭐ +1 ${city.name}</button>`).join(""):"");
  }
  else if(round.type==="pos3stack"){
    // Mehrfachvergabe: 3 Punkte die beliebig auf eine oder mehrere Staedte verteilt werden
    const stack=myV||{}; // {city: count}
    const used=Object.values(stack).reduce((a,b)=>a+b,0);
    aa.innerHTML=`<hr><h3>3 Punkte verteilen (${used}/3 verwendet, auch mehrere auf eine Stadt!):</h3>`+activeOnly.map(([k,city])=>{
      const cnt=stack[k]||0;
      return `<div class="row" style="align-items:center;margin:3px 0">
        <button class="btn-red btn-sm" data-stackdown="${k}" ${cnt<=0?'disabled':''}>−</button>
        <div style="text-align:center;font-weight:bold">${city.name} <span class="vote-pill">${cnt}</span></div>
        <button class="btn-green btn-sm" data-stackup="${k}" ${used>=3?'disabled':''}>+</button>
      </div>`;
    }).join("");
  }
  else if(round.type==="neg1"){
    aa.innerHTML=`<hr><h3>Welche Stadt soll WEG?</h3>`+activeOnly.map(([k,city])=>{
      const sel=myV===k;
      return `<button class="${sel?'btn-red':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'✗ ':''}${city.name}</button>`;
    }).join("");
  }
  else if(round.type==="duel"){
    const duelCities=round.duelCities||[];
    if(duelCities.length<2 && A.isHost){
      aa.innerHTML=`<hr><div class="sub">Waehle 2 Staedte fuers Duell:</div>`+activeOnly.map(([k,city])=>{
        const sel=duelCities.includes(k);
        return `<button class="${sel?'btn-orange':'btn-ghost'}" style="text-align:left" data-duelpick="${k}">${sel?'⚔️ ':''}${city.name}</button>`;
      }).join("");
    } else if(duelCities.length===2){
      aa.innerHTML=`<hr><h3>⚔️ Duell – Gewinner bleibt:</h3>`+duelCities.map(k=>{
        const city=list[k]; if(!city) return "";
        const sel=myV===k;
        return `<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left;font-size:1.1rem;padding:18px" data-city="${k}">${sel?'✓ ':''}${city.name}</button>`;
      }).join("");
    }
  }
  else if(round.type==="ko"){
    aa.innerHTML=`<hr><h3>K.O.-Modus – wer soll bleiben (wenigste Stimmen fliegt):</h3>`+activeOnly.map(([k,city])=>{
      const sel=myV===k;
      return `<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'✓ ':''}${city.name}</button>`;
    }).join("");
  }

  else if(round.type==="revive"){
    const elimOnly=entries.filter(e=>e[1].status==="eliminated");
    if(!elimOnly.length){
      aa.innerHTML=`<hr><h3>🔄 Comeback-Modus:</h3><div class="sub">Es gibt keine eliminierten Städte zum Zurückholen.</div>`;
    } else {
      aa.innerHTML=`<hr><h3>Welche Stadt soll ZURÜCK ins Rennen?</h3>`+elimOnly.map(([k,city])=>{
        const sel=myV===k;
        return `<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'✓ ':''}${city.name}</button>`;
      }).join("");
    }
  }
  else if(round.type==="weighted"){
    // Zeige dem User sein Stimmengewicht
    const sortedP=Object.entries(A.players).sort((a,b)=>{
      const sa=(a[1].score||0)+((a[1].casual||0)*0.1);
      const sb=(b[1].score||0)+((b[1].casual||0)*0.1);
      return sb-sa;
    });
    const myRank=sortedP.findIndex(([n])=>n===A.user);
    const myWeight=myRank===0?3:(myRank<=2?2:1);
    aa.innerHTML=`<hr><div class="flash gold">Modus "Gewichtet nach Rang"<br>Dein Rang: <b>${myRank+1}.</b> → Deine Stimme zaehlt <b>${myWeight}x</b><br><small style="opacity:.7">1. Platz = 3x · 2.-3. Platz = 2x · Rest = 1x</small></div><h3>Deine Lieblingsstadt:</h3>`+activeOnly.map(([k,city])=>{
      const sel=myV===k;
      return `<button class="${sel?'btn-gold':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'★ ':''}${city.name}</button>`;
    }).join("");
  }

  // Event bindings
  aa.querySelectorAll("[data-city]").forEach(b=>b.onclick=async()=>{
    const k=b.dataset.city;
    if(round.type==="pos3"){
      let cur=myV||[];
      if(cur.includes(k)) cur=cur.filter(x=>x!==k);
      else if(cur.length<3) cur.push(k);
      await set(ref(db,`rooms/${A.room}/cities/round/votes/${A.user}`),cur);
    } else {
      await set(ref(db,`rooms/${A.room}/cities/round/votes/${A.user}`),k);
    }
  });
  aa.querySelectorAll("[data-stackup]").forEach(b=>b.onclick=async()=>{
    const k=b.dataset.stackup;
    const cur={...(myV||{})};
    const used=Object.values(cur).reduce((a,b)=>a+b,0);
    if(used>=3) return;
    cur[k]=(cur[k]||0)+1;
    await set(ref(db,`rooms/${A.room}/cities/round/votes/${A.user}`),cur);
  });
  aa.querySelectorAll("[data-stackdown]").forEach(b=>b.onclick=async()=>{
    const k=b.dataset.stackdown;
    const cur={...(myV||{})};
    if(!cur[k]) return;
    cur[k]--;
    if(cur[k]<=0) delete cur[k];
    await set(ref(db,`rooms/${A.room}/cities/round/votes/${A.user}`),cur);
  });
  aa.querySelectorAll("[data-bonus]").forEach(b=>b.onclick=async()=>{
    const k=b.dataset.bonus;
    const cur=(round.bonusUsed||{})[A.user]||0;
    await set(ref(db,`rooms/${A.room}/cities/round/bonusUsed/${A.user}`),cur+1);
    await set(ref(db,`rooms/${A.room}/cities/round/bonusVotes/${A.user}_${cur}`),k);
    const r=ref(db,`rooms/${A.room}/players/${A.user}/bonusVotes`);
    const v=(await get(r)).val()||0;
    await set(r,Math.max(0,v-1));
    toast("Bonus-Stimme eingesetzt");
  });
  aa.querySelectorAll("[data-duelpick]").forEach(b=>b.onclick=async()=>{
    if(!A.isHost) return;
    const k=b.dataset.duelpick;
    let cur=round.duelCities||[];
    if(cur.includes(k)) cur=cur.filter(x=>x!==k);
    else if(cur.length<2) cur.push(k);
    await set(ref(db,`rooms/${A.room}/cities/round/duelCities`),cur);
  });
}

// === CITY EDITOR ===
function openCityEditor(cid){
  const city=((A.state.cities||{}).list||{})[cid]; if(!city) return;
  const panel=$("cityEditPanel");
  panel.classList.remove("hidden");
  $("cityEditBody").innerHTML=`
    <div class="q-big" style="font-size:1.1rem">${city.name}</div>
    <label class="sub">Name:</label>
    <input id="edName" value="${city.name||''}">
    <label class="sub">Preis (z.B. CHF 250):</label>
    <input id="edPrice" value="${city.price||''}" placeholder="z.B. CHF 250">
    <label class="sub">Abflug von CH:</label>
    <input id="edDepCh" value="${city.depCh||''}" placeholder="z.B. Fr 12.06. 14:30 ZRH">
    <label class="sub">Abflug zurueck:</label>
    <input id="edDepBack" value="${city.depBack||''}" placeholder="z.B. So 14.06. 18:00">
    <div class="row">
      <button class="btn-green" id="edSave">💾 Speichern</button>
      <button class="btn-red" id="edDelete">🗑️ Stadt loeschen</button>
    </div>
    <button class="btn-ghost" id="edClose">Schliessen</button>
  `;
  $("edSave").onclick=async()=>{
    await update(ref(db,`rooms/${A.room}/cities/list/${cid}`),{
      name:$("edName").value.trim(),
      price:$("edPrice").value.trim(),
      depCh:$("edDepCh").value.trim(),
      depBack:$("edDepBack").value.trim()
    });
    panel.classList.add("hidden");
    toast("Gespeichert");
    // Flash-Animation
    setTimeout(()=>{
      const el=document.querySelector(`[data-cid="${cid}"]`);
      if(el){ el.classList.add("flash-up"); setTimeout(()=>el.classList.remove("flash-up"),600); }
    },100);
  };
  $("edDelete").onclick=async()=>{
    if(!confirm(`Stadt "${city.name}" endgueltig loeschen?`)) return;
    await remove(ref(db,`rooms/${A.room}/cities/list/${cid}`));
    panel.classList.add("hidden");
  };
  $("edClose").onclick=()=>panel.classList.add("hidden");
}

// === HOST ACTIONS ===
async function addCity(){
  if(!A.isHost) return;
  const v=$("newCity").value.trim(); if(!v) return;
  await set(ref(db,`rooms/${A.room}/cities/list/c_${Date.now()}`),{name:v,status:"active",votes:0,price:"",depCh:"",depBack:""});
  $("newCity").value="";
  toast("Stadt hinzugefuegt");
}

async function startCityVote(type){
  if(!A.isHost) return;
  await set(ref(db,`rooms/${A.room}/cities/round`),{type,votes:{},startedAt:Date.now()});
  toast(`Voting-Modus: ${type}`);
}

async function endCityVote(){
  if(!A.isHost) return;
  const c=A.state.cities||{},r=c.round; if(!r) return;
  const list=c.list||{};
  const tally={};

  if(r.type==="pos3"){
    Object.values(r.votes||{}).forEach(arr=>{(arr||[]).forEach(k=>tally[k]=(tally[k]||0)+1)});
    Object.values(r.bonusVotes||{}).forEach(k=>{tally[k]=(tally[k]||0)+1});
    for(const [k,v] of Object.entries(tally)) await set(ref(db,`rooms/${A.room}/cities/list/${k}/votes`),((list[k].votes)||0)+v);
  }
  else if(r.type==="pos3stack"){
    Object.values(r.votes||{}).forEach(stack=>{
      if(typeof stack==="object") Object.entries(stack).forEach(([k,v])=>{tally[k]=(tally[k]||0)+v});
    });
    for(const [k,v] of Object.entries(tally)) await set(ref(db,`rooms/${A.room}/cities/list/${k}/votes`),((list[k].votes)||0)+v);
  }
  else if(r.type==="neg1"){
    Object.values(r.votes||{}).forEach(k=>{tally[k]=(tally[k]||0)+1});
    for(const [k,v] of Object.entries(tally)) await set(ref(db,`rooms/${A.room}/cities/list/${k}/votes`),((list[k].votes)||0)-v);
  }
  else if(r.type==="duel"){
    const duel=r.duelCities||[];
    if(duel.length===2){
      Object.values(r.votes||{}).forEach(k=>{tally[k]=(tally[k]||0)+1});
      const [a,b]=duel;
      const va=tally[a]||0,vb=tally[b]||0;
      const loser=va<vb?a:(vb<va?b:null);
      if(loser){ await update(ref(db,`rooms/${A.room}/cities/list/${loser}`),{status:"eliminated"}); toast(`${list[loser].name} fliegt raus!`); }
      else toast("Unentschieden");
    }
  }
  else if(r.type==="ko"){
    Object.values(r.votes||{}).forEach(k=>{tally[k]=(tally[k]||0)+1});
    const active=Object.entries(list).filter(e=>e[1].status==="active");
    let lowest=null,minV=Infinity;
    active.forEach(([k])=>{const t=tally[k]||0; if(t<minV){minV=t;lowest=k;}});
    if(lowest){ await update(ref(db,`rooms/${A.room}/cities/list/${lowest}`),{status:"eliminated"}); toast(`${list[lowest].name} fliegt raus`); }
  }

  else if(r.type==="revive"){
    Object.values(r.votes||{}).forEach(k=>{tally[k]=(tally[k]||0)+1});
    const elim=Object.entries(list).filter(e=>e[1].status==="eliminated");
    let highest=null,maxV=0; // maxV=0 stellt sicher, dass mind. 1 Stimme nötig ist
    
    // Finde die eliminierte Stadt mit den meisten Stimmen
    elim.forEach(([k])=>{
      const t=tally[k]||0; 
      if(t>maxV){maxV=t; highest=k;}
    });
    
    if(highest){ 
      await update(ref(db,`rooms/${A.room}/cities/list/${highest}`),{status:"active"}); 
      toast(`🔄 ${list[highest].name} ist wieder im Rennen!`); 
    } else {
      toast("Keine Stadt zurückgeholt (Niemand hat abgestimmt).");
    }
  }
    
  else if(r.type==="weighted"){
    // Stimmen gewichtet nach Rang: 1. Platz = 3x, 2.-3. Platz = 2x, Rest = 1x
    const sortedP=Object.entries(A.players).sort((a,b)=>{
      const sa=(a[1].score||0)+((a[1].casual||0)*0.1);
      const sb=(b[1].score||0)+((b[1].casual||0)*0.1);
      return sb-sa;
    });
    const weightOf=name=>{
      const i=sortedP.findIndex(([n])=>n===name);
      if(i<0) return 1;
      if(i===0) return 3;
      if(i<=2) return 2;
      return 1;
    };
    for(const [player,cityKey] of Object.entries(r.votes||{})){
      const w=weightOf(player);
      tally[cityKey]=(tally[cityKey]||0)+w;
    }
    for(const [k,v] of Object.entries(tally)) await set(ref(db,`rooms/${A.room}/cities/list/${k}/votes`),((list[k].votes)||0)+v);
    toast("Gewichtete Stimmen vergeben");
  }
  await remove(ref(db,`rooms/${A.room}/cities/round`));
}

async function lowestOut(){
  if(!A.isHost) return;
  const list=((A.state.cities||{}).list)||{};
  const active=Object.entries(list).filter(e=>e[1].status==="active");
  if(!active.length) return;
  const minV=Math.min(...active.map(e=>e[1].votes||0));
  const losers=active.filter(e=>(e[1].votes||0)===minV);
  if(!confirm(`${losers.length} Stadt/Staedte mit Score ${minV} werden eliminiert: ${losers.map(l=>l[1].name).join(", ")}?`)) return;
  for(const [k] of losers) await update(ref(db,`rooms/${A.room}/cities/list/${k}`),{status:"eliminated"});
  toast(`${losers.length} raus`);
}

async function resetVotes(){
  if(!A.isHost) return;
  if(!confirm("Alle Stimmen auf 0 setzen? (Liste bleibt)")) return;
  const list=((A.state.cities||{}).list)||{};
  for(const k of Object.keys(list)) await update(ref(db,`rooms/${A.room}/cities/list/${k}`),{votes:0});
  toast("Alle Votes auf 0");
}

async function reactivateAll(){
  if(!A.isHost) return;
  if(!confirm("Alle Staedte wieder aktivieren?")) return;
  const list=((A.state.cities||{}).list)||{};
  for(const k of Object.keys(list)) await update(ref(db,`rooms/${A.room}/cities/list/${k}`),{status:"active"});
  toast("Alle reaktiviert");
}

console.log("✅ cities.js loaded");
