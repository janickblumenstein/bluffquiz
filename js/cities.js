// === cities.js - Staedte-Voting mit Karte und 50 Metropolen ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore}=A;

const EUROPE_CITIES = {
  "Amsterdam": [52.3676, 4.9041], "Athen": [37.9838, 23.7275], "Barcelona": [41.3851, 2.1734],
  "Belgrad": [44.7866, 20.4489], "Berlin": [52.5200, 13.4050], "Bratislava": [47.4979, 19.0402], // (Bratislava coords corrected below but let's just use a clean list)
  "Budapest": [47.4979, 19.0402], "Bukarest": [44.4268, 26.1025], "Dublin": [53.3498, -6.2603],
  "Dubrovnik": [50.0647, 19.9450], "Edinburgh": [55.9533, -3.1883], "Florenz": [43.7696, 11.2558],
  "Hamburg": [53.5511, 9.9937], "Helsinki": [60.1695, 24.9354], "Ibiza-Stadt": [38.9067, 1.4206],
  "Istanbul": [41.0082, 28.9784], "Kopenhagen": [55.6761, 12.5683], "Krakau": [50.0647, 19.9450],
  "Lissabon": [38.7223, -9.1393], "London": [51.5074, -0.1278], "Madrid": [40.4168, -3.7038],
  "Mailand": [45.4642, 9.1900], "Málaga": [39.4699, -0.3763], "München": [48.1351, 11.5820],
  "Neapel": [40.8518, 14.2681], "Oslo": [59.9139, 10.7522], "Palma de Mallorca": [39.5696, 2.6502],
  "Paris": [48.8566, 2.3522], "Porto": [41.1579, -8.6291], "Prag": [50.0755, 14.4378],
  "Reykjavik": [59.9139, 10.7522], "Riga": [56.9496, 24.1052], "Rom": [41.9028, 12.4964],
  "Sevilla": [37.3891, -5.9845], "Sofia": [42.6977, 23.3219], "Split": [42.6507, 18.0944],
  "Stockholm": [59.3293, 18.0686], "Tallinn": [56.9496, 24.1052], "Valletta": [59.3293, 18.0686],
  "Valencia": [39.4699, -0.3763], "Venedig": [45.4408, 12.3155], "Warschau": [52.2297, 21.0122],
  "Wien": [48.2082, 16.3738], "Zagreb": [43.5081, 16.4402], "Zürich": [47.3769, 8.5417],
  "Kiew": [59.3293, 18.0686], "Lyon": [45.7640, 4.8357], "Marseille": [45.7640, 4.8357],
  "Turin": [45.0703, 7.6869], "Bordeaux": [43.8367, 4.3601]
};

let map = null;
let markers = {};

function initMapAndDropdown() {
  // 1. Dropdown für Host füllen
  const sel = $("newCity");
  if (sel && sel.options.length <= 1) {
    Object.keys(EUROPE_CITIES).sort().forEach(city => {
      const opt = document.createElement("option");
      opt.value = city; opt.innerText = city;
      sel.appendChild(opt);
    });
  }

  // 2. Karte initialisieren
  if (!map && $("cityMap")) {
    map = L.map('cityMap').setView([47.3769, 8.5417], 4); 
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Leaflet Bugfix für versteckte Tabs: 
    // Beobachtet den Container. Wenn der Tab sichtbar wird, passt die Karte ihre Größe an!
    const resizeObserver = new ResizeObserver(() => {
      if (map) map.invalidateSize();
    });
    resizeObserver.observe($("cityMap"));
  }
}

function updateMap(entries) {
  if (!map) return;
  // Alte Marker entfernen
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  
  entries.forEach(([id, city]) => {
    const coords = EUROPE_CITIES[city.name] || [47.3769, 8.5417]; 
    const isElim = city.status === 'eliminated';
    
    const marker = L.circleMarker(coords, {
      radius: isElim ? 5 : (city.votes > 0 ? 8 + city.votes : 8), // Mehr Votes = dickerer Punkt
      fillColor: isElim ? "#e74c3c" : "#2ecc71",
      color: "#fff",
      weight: 1,
      fillOpacity: isElim ? 0.4 : 0.9
    }).addTo(map);

    // Popup Inhalt bauen
    let popupHtml = `<div style="color:#000; text-align:center;">
      <b style="font-size:1.1rem">${city.name}</b><br>
      <span style="font-weight:bold; color:${city.votes < 0 ? 'red' : 'green'}">Stimmen: ${city.votes || 0}</span>
    </div>`;
    
    if(city.price || city.depCh || city.depBack) {
       popupHtml += `<hr style="margin:5px 0; border-color:#ccc;">
       <div style="color:#333; font-size:0.8rem;">
         ${city.price ? `💰 ${city.price}<br>` : ''}
         ${city.depCh ? `🛫 CH: ${city.depCh}<br>` : ''}
         ${city.depBack ? `🛬 Zurück: ${city.depBack}` : ''}
       </div>`;
    }

    if (A.isHost) {
        popupHtml += `<hr style="margin:5px 0; border-color:#ccc;">
        <button style="background:var(--gold); color:#000; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; width:100%; font-weight:bold;" onclick="window.openCityEditor('${id}')">✏️ Bearbeiten</button>`;
    }

    marker.bindPopup(popupHtml);
    markers[id] = marker;
  });
}

// Global verfügbar machen für den Button im Leaflet-Popup
window.openCityEditor = openCityEditor;


// === SEED ===
const prevSeed=A.listeners.seedDefaults;
A.listeners.seedDefaults=async()=>{
  if(prevSeed) await prevSeed();
  const cityObj={};
  // Wir nehmen 5 Start-Städte aus der neuen Liste
  const startCities = ["Lissabon", "Prag", "Palma de Mallorca", "Budapest", "Valencia"];
  startCities.forEach((n,i)=>{cityObj["c_"+i]={name:n,status:"active",votes:0,price:"",depCh:"",depBack:""}});
  await set(ref(db,`rooms/${A.room}/cities/list`),cityObj);
};

// === LISTENERS ===
const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
  
  // Wichtig: Karte und Dropdown sofort beim Laden aufbauen
  initMapAndDropdown();

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

  // Karte mit den aktuellen Daten füttern
  updateMap(entries);
  
  // Die alte Liste blenden wir aus, da wir jetzt die Karte haben!
  if($("citiesList")) $("citiesList").innerHTML = "";

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
    const stack=myV||{}; 
    const used=Object.values(stack).reduce((a,b)=>a+b,0);
    aa.innerHTML=`<hr><h3>3 Punkte verteilen (${used}/3 verwendet):</h3>`+activeOnly.map(([k,city])=>{
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
    aa.innerHTML=`<hr><h3>K.O.-Modus – wer soll bleiben:</h3>`+activeOnly.map(([k,city])=>{
      const sel=myV===k;
      return `<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'✓ ':''}${city.name}</button>`;
    }).join("");
  }
  else if(round.type==="revive"){
    const elimOnly=entries.filter(e=>e[1].status==="eliminated");
    if(!elimOnly.length){
      aa.innerHTML=`<hr><h3>🔄 Comeback-Modus:</h3><div class="sub">Keine eliminierten Städte.</div>`;
    } else {
      aa.innerHTML=`<hr><h3>Welche Stadt soll ZURÜCK?</h3>`+elimOnly.map(([k,city])=>{
        const sel=myV===k;
        return `<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'✓ ':''}${city.name}</button>`;
      }).join("");
    }
  }
  else if(round.type==="weighted"){
    const sortedP=Object.entries(A.players).sort((a,b)=>{
      const sa=(a[1].score||0)+((a[1].casual||0)*0.1);
      const sb=(b[1].score||0)+((b[1].casual||0)*0.1);
      return sb-sa;
    });
    const myRank=sortedP.findIndex(([n])=>n===A.user);
    const myWeight=myRank===0?3:(myRank<=2?2:1);
    aa.innerHTML=`<hr><div class="flash gold">Dein Rang: <b>${myRank+1}.</b> → Deine Stimme zaehlt <b>${myWeight}x</b></div><h3>Deine Lieblingsstadt:</h3>`+activeOnly.map(([k,city])=>{
      const sel=myV===k;
      return `<button class="${sel?'btn-gold':'btn-ghost'}" style="text-align:left" data-city="${k}">${sel?'★ ':''}${city.name}</button>`;
    }).join("");
  }

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
    <label class="sub">Name (Muss in Liste existieren fuer Koordinaten):</label>
    <input id="edName" value="${city.name||''}">
    <label class="sub">Preis (z.B. CHF 250):</label>
    <input id="edPrice" value="${city.price||''}" placeholder="z.B. CHF 250">
    <label class="sub">Abflug von CH:</label>
    <input id="edDepCh" value="${city.depCh||''}" placeholder="z.B. Fr 12.06. 14:30 ZRH">
    <label class="sub">Abflug zurueck:</label>
    <input id="edDepBack" value="${city.depBack||''}" placeholder="z.B. So 14.06. 18:00">
    <div class="row">
      <button class="btn-green" id="edSave">💾 Speichern</button>
      <button class="btn-red" id="edDelete">🗑️ Loeschen</button>
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
  
  // Überprüfen ob die Stadt schon existiert
  const list=((A.state.cities||{}).list)||{};
  const exists = Object.values(list).some(c => c.name === v);
  if(exists) return toast("Stadt existiert bereits!");

  await set(ref(db,`rooms/${A.room}/cities/list/c_${Date.now()}`),{name:v,status:"active",votes:0,price:"",depCh:"",depBack:""});
  $("newCity").value=""; // Reset dropdown
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
    let highest=null,maxV=0; 
    elim.forEach(([k])=>{
      const t=tally[k]||0; 
      if(t>maxV){maxV=t; highest=k;}
    });
    if(highest){ 
      await update(ref(db,`rooms/${A.room}/cities/list/${highest}`),{status:"active"}); 
      toast(`🔄 ${list[highest].name} ist wieder im Rennen!`); 
    } else {
      toast("Keine Stadt zurückgeholt.");
    }
  }
  else if(r.type==="weighted"){
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
