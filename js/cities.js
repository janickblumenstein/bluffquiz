// === cities.js - Staedte-Voting mit Karte, Tabelle und 50 Metropolen ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore}=A;

const EUROPE_CITIES = {
  "Amsterdam": [52.3676, 4.9041], "Athen": [37.9838, 23.7275], "Barcelona": [41.3851, 2.1734],
  "Belgrad": [44.7866, 20.4489], "Berlin": [52.5200, 13.4050], "Bratislava": [48.1486, 17.1077],
  "Budapest": [47.4979, 19.0402], "Bukarest": [44.4268, 26.1025], "Dublin": [53.3498, -6.2603],
  "Dubrovnik": [42.6507, 18.0944], "Edinburgh": [55.9533, -3.1883], "Florenz": [43.7696, 11.2558],
  "Hamburg": [53.5511, 9.9937], "Helsinki": [60.1695, 24.9354], "Ibiza-Stadt": [38.9067, 1.4206],
  "Istanbul": [41.0082, 28.9784], "Kopenhagen": [55.6761, 12.5683], "Krakau": [50.0647, 19.9450],
  "Lissabon": [38.7223, -9.1393], "London": [51.5074, -0.1278], "Madrid": [40.4168, -3.7038],
  "Mailand": [45.4642, 9.1900], "Málaga": [36.7213, -4.4213], "München": [48.1351, 11.5820],
  "Neapel": [40.8518, 14.2681], "Oslo": [59.9139, 10.7522], "Palma de Mallorca": [39.5696, 2.6502],
  "Paris": [48.8566, 2.3522], "Porto": [41.1579, -8.6291], "Prag": [50.0755, 14.4378],
  "Reykjavik": [64.1466, -21.9426], "Riga": [56.9496, 24.1052], "Rom": [41.9028, 12.4964],
  "Sevilla": [37.3891, -5.9845], "Sofia": [42.6977, 23.3219], "Split": [43.5081, 16.4402],
  "Stockholm": [59.3293, 18.0686], "Tallinn": [59.4370, 24.7536], "Valletta": [35.8989, 14.5146],
  "Valencia": [39.4699, -0.3763], "Venedig": [45.4408, 12.3155], "Warschau": [52.2297, 21.0122],
  "Wien": [48.2082, 16.3738], "Zagreb": [45.8150, 15.9819], "Zürich": [47.3769, 8.5417],
  "Kiew": [50.4501, 30.5234], "Lyon": [45.7640, 4.8357], "Marseille": [43.2965, 5.3698],
  "Turin": [45.0703, 7.6869], "Bordeaux": [44.8378, -0.5792]
};

let map = null;
let markers = {};

function initMapAndDropdown() {
  const sel = $("newCity");
  if (sel && sel.options.length <= 1) {
    Object.keys(EUROPE_CITIES).sort().forEach(city => {
      const opt = document.createElement("option");
      opt.value = city; opt.innerText = city;
      sel.appendChild(opt);
    });
  }

  if (!map && $("cityMap")) {
    map = L.map('cityMap').setView([47.3769, 8.5417], 4); 
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    const resizeObserver = new ResizeObserver(() => { if (map) map.invalidateSize(); });
    resizeObserver.observe($("cityMap"));
  }
}

function updateMap(entries) {
  if (!map) return;
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  
  entries.forEach(([id, city]) => {
    const coords = EUROPE_CITIES[city.name] || [47.3769, 8.5417]; 
    const isElim = city.status === 'eliminated';
    
    const marker = L.circleMarker(coords, {
      radius: isElim ? 5 : (city.votes > 0 ? 8 + city.votes : 8),
      fillColor: isElim ? "#e74c3c" : "#2ecc71",
      color: "#fff",
      weight: 1,
      fillOpacity: isElim ? 0.4 : 0.9
    }).addTo(map);

    let popupHtml = `<div style="color:#000; text-align:center;">
      <b style="font-size:1.1rem">${city.name}</b><br>
      <span style="font-weight:bold; color:${city.votes < 0 ? 'red' : 'green'}">Stimmen: ${city.votes || 0}</span>
    </div>`;
    marker.bindPopup(popupHtml);
    markers[id] = marker;
  });
}

// Global verfügbar machen für HTML Event-Handler
window.openCityEditor = openCityEditor;


// === SEED ===
const prevSeed=A.listeners.seedDefaults;
A.listeners.seedDefaults=async()=>{
  if(prevSeed) await prevSeed();
  const cityObj={};
  const startCities = ["Lissabon", "Prag", "Palma de Mallorca", "Budapest", "Valencia"];
  startCities.forEach((n,i)=>{cityObj["c_"+i]={name:n,status:"active",votes:0,price:"",depCh:"",depBack:""}});
  await set(ref(db,`rooms/${A.room}/cities/list`),cityObj);
};

// === LISTENERS ===
const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
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

// === RENDER & TABELLE ===
function renderCities(){
  const c=A.state.cities||{};
  const list=c.list||{};
  const round=c.round;
  const entries=Object.entries(list);

  updateMap(entries);
  renderCitiesTable(entries);

  const aa=$("citiesAction"); aa.innerHTML="";
  if(round&&round.type){ renderVoteAction(aa,round,list,entries); }
}

// Hilfsfunktionen fürs Sortieren
function parsePrice(str) {
    if(!str) return Infinity; // Leere ans Ende
    const m = str.match(/\d+/);
    return m ? parseInt(m[0]) : Infinity;
}
function parseDateForSort(str) {
    if(!str || str.trim() === "") return Infinity; // Leere Felder ans Ende

    // Standardwerte: Wir gehen von Mai (Monat 5) aus, falls nichts angegeben ist
    let day = 0, month = 5, hour = 0, minute = 0; 

    // 1. Uhrzeit suchen (sucht nach HH:MM oder HH.MM)
    const timeMatch = str.match(/(\d{1,2})[:.](\d{2})/);
    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
    }

    // 2. Datum suchen (sucht nach DD.MM. oder nur DD.)
    // Akzeptiert: "12.05.", "12.5.", "12.05", "12."
    const dateMatch = str.match(/(\d{1,2})\.(\d{1,2})?/) || str.match(/(\d{1,2})/);
    
    if (dateMatch) {
        day = parseInt(dateMatch[1], 10);
        if (dateMatch[2]) {
            month = parseInt(dateMatch[2], 10); // Falls ein Monat da ist, überschreibe den Mai
        }
    }

    // Wir berechnen eine sortierbare Zahl (z.B. Monat 5, Tag 12, 14:30 Uhr -> 5121430)
    return (month * 1000000) + (day * 10000) + (hour * 100) + minute;
}

function renderCitiesTable(entries) {
    const listDiv = $("citiesList");
    if(!listDiv) return;

    // Globale Sortier-Richtung merken
    window._citySort = window._citySort || { col: 'votes', asc: false };
    const sort = window._citySort;

    let sorted = [...entries];
    sorted.sort((a,b) => {
        const cA = a[1];
        const cB = b[1];

        // Eliminierte immer nach unten
        if (cA.status !== cB.status) {
            return cA.status === 'active' ? -1 : 1;
        }

        let valA, valB;
        if(sort.col === 'name') { valA = cA.name.toLowerCase(); valB = cB.name.toLowerCase(); }
        else if(sort.col === 'votes') { valA = cA.votes || 0; valB = cB.votes || 0; }
        else if(sort.col === 'price') { valA = parsePrice(cA.price); valB = parsePrice(cB.price); }
        else if(sort.col === 'depCh') { valA = parseDateForSort(cA.depCh); valB = parseDateForSort(cB.depCh); }
        else if(sort.col === 'depBack') { valA = parseDateForSort(cA.depBack); valB = parseDateForSort(cB.depBack); }

        if (valA < valB) return sort.asc ? -1 : 1;
        if (valA > valB) return sort.asc ? 1 : -1;
        return 0;
    });

    const indicator = (col) => sort.col === col ? (sort.asc ? ' ▲' : ' ▼') : '';

    let html = `<div style="overflow-x:auto; margin-top:15px; border-radius:8px; border:1px solid var(--border);">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem; white-space:nowrap;">
        <thead style="background:var(--card2); cursor:pointer; user-select:none;">
            <tr>
                <th style="padding:10px;" onclick="window.setCitySort('name')">Stadt${indicator('name')}</th>
                <th style="padding:10px;" onclick="window.setCitySort('votes')">Pkt${indicator('votes')}</th>
                <th style="padding:10px;" onclick="window.setCitySort('price')">Preis${indicator('price')}</th>
                <th style="padding:10px;" onclick="window.setCitySort('depCh')">Hinflug${indicator('depCh')}</th>
                <th style="padding:10px;" onclick="window.setCitySort('depBack')">Rückflug${indicator('depBack')}</th>
            </tr>
        </thead>
        <tbody>`;

    if(sorted.length === 0) {
        html += `<tr><td colspan="5" style="padding:10px; text-align:center; opacity:0.5;">Keine Städte vorhanden</td></tr>`;
    }

    sorted.forEach(([id, city]) => {
        const isElim = city.status === 'eliminated';
        const rowStyle = isElim ? 'opacity:0.4; text-decoration:line-through;' : '';
        const clickAction = A.isHost ? `onclick="window.openCityEditor('${id}')" style="cursor:pointer;"` : '';

        html += `<tr style="border-top:1px solid var(--border); background:var(--card); transition:background 0.2s;" ${clickAction}>
            <td style="padding:10px; font-weight:bold; ${rowStyle}">${city.name}</td>
            <td style="padding:10px; ${rowStyle}">
                <span class="vote-pill ${city.votes < 0 ? 'neg' : ''}" style="display:inline-block; padding:2px 6px;">${city.votes>0?'+':''}${city.votes||0}</span>
            </td>
            <td style="padding:10px; ${rowStyle}">${city.price || '-'}</td>
            <td style="padding:10px; font-size:0.7rem; ${rowStyle}">${city.depCh || '-'}</td>
            <td style="padding:10px; font-size:0.7rem; ${rowStyle}">${city.depBack || '-'}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    if(A.isHost) {
        html += `<div class="sub" style="text-align:right; margin-top:5px;">💡 Tippe als Host auf eine Zeile zum Bearbeiten</div>`;
    }
    listDiv.innerHTML = html;
}

window.setCitySort = (col) => {
    if (window._citySort.col === col) {
        window._citySort.asc = !window._citySort.asc;
    } else {
        window._citySort.col = col;
        // Preis/Flüge standardmäßig aufsteigend sortieren (günstigste/früheste zuerst)
        window._citySort.asc = (col === 'price' || col === 'depCh' || col === 'depBack') ? true : false;
    }
    renderCitiesTable(Object.entries((A.state.cities||{}).list||{}));
};

function renderVoteAction(aa,round,list,entries){
  const myV=(round.votes||{})[A.user];
  const me=A.players[A.user]||{};
  // Sortiere für die Voting-Buttons rein alphabetisch (ist übersichtlicher)
  const activeOnly=entries.filter(e=>e[1].status==="active").sort((a,b) => a[1].name.localeCompare(b[1].name));

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
        <div style="text-align:center;font-weight:bold;flex:2;">${city.name} <span class="vote-pill">${cnt}</span></div>
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
    const elimOnly=entries.filter(e=>e[1].status==="eliminated").sort((a,b) => a[1].name.localeCompare(b[1].name));
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
    <input id="edDepCh" value="${city.depCh||''}" placeholder="z.B. 12. 14:30 (Tag. Zeit)">
    <label class="sub">Abflug zurueck:</label>
    <input id="edDepBack" value="${city.depBack||''}" placeholder="z.B. 14. 18:00 (Tag. Zeit)">
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
