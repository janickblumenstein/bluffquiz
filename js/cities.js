// === cities.js - Staedte-Voting mit Karte, Sticky-Tabelle und Metropolen-Daten ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore}=A;

// Erweiterte Datenbank: Koordinaten, Ø Bierpreis (CHF), Ø Temp Mai (°C), Flugzeit ab Basel (ca.)
const EUROPE_CITIES = {
  "Amsterdam": { coords: [52.3676, 4.9041], beer: 6.5, temp: 13, flight: "1h 25m" },
  "Athen": { coords: [37.9838, 23.7275], beer: 4.5, temp: 21, flight: "2h 40m" },
  "Barcelona": { coords: [41.3851, 2.1734], beer: 3.5, temp: 18, flight: "1h 50m" },
  "Belgrad": { coords: [44.7866, 20.4489], beer: 2.5, temp: 18, flight: "1h 45m" },
  "Berlin": { coords: [52.5200, 13.4050], beer: 4.5, temp: 14, flight: "1h 20m" },
  "Bratislava": { coords: [48.1486, 17.1077], beer: 2.5, temp: 16, flight: "1h 25m" },
  "Budapest": { coords: [47.4979, 19.0402], beer: 2.5, temp: 17, flight: "1h 35m" },
  "Bukarest": { coords: [44.4268, 26.1025], beer: 2.5, temp: 18, flight: "2h 20m" },
  "Dublin": { coords: [53.3498, -6.2603], beer: 6.5, temp: 11, flight: "2h 05m" },
  "Dubrovnik": { coords: [42.6507, 18.0944], beer: 4.0, temp: 18, flight: "1h 45m" },
  "Edinburgh": { coords: [55.9533, -3.1883], beer: 6.0, temp: 11, flight: "2h 00m" },
  "Florenz": { coords: [43.7696, 11.2558], beer: 5.5, temp: 19, flight: "1h 15m" },
  "Hamburg": { coords: [53.5511, 9.9937], beer: 4.5, temp: 13, flight: "1h 15m" },
  "Helsinki": { coords: [60.1695, 24.9354], beer: 7.5, temp: 10, flight: "2h 45m" },
  "Ibiza-Stadt": { coords: [38.9067, 1.4206], beer: 6.0, temp: 19, flight: "1h 55m" },
  "Istanbul": { coords: [41.0082, 28.9784], beer: 3.5, temp: 18, flight: "2h 55m" },
  "Kopenhagen": { coords: [55.6761, 12.5683], beer: 7.0, temp: 12, flight: "1h 40m" },
  "Krakau": { coords: [50.0647, 19.9450], beer: 3.0, temp: 15, flight: "1h 35m" },
  "Lissabon": { coords: [38.7223, -9.1393], beer: 3.0, temp: 18, flight: "2h 40m" },
  "London": { coords: [51.5074, -0.1278], beer: 7.0, temp: 14, flight: "1h 35m" },
  "Madrid": { coords: [40.4168, -3.7038], beer: 3.5, temp: 18, flight: "2h 10m" },
  "Mailand": { coords: [45.4642, 9.1900], beer: 5.5, temp: 18, flight: "0h 55m" },
  "Málaga": { coords: [36.7213, -4.4213], beer: 3.0, temp: 20, flight: "2h 35m" },
  "München": { coords: [48.1351, 11.5820], beer: 5.0, temp: 14, flight: "0h 55m" },
  "Neapel": { coords: [40.8518, 14.2681], beer: 3.5, temp: 20, flight: "1h 45m" },
  "Oslo": { coords: [59.9139, 10.7522], beer: 9.0, temp: 12, flight: "2h 20m" },
  "Palma de Mallorca": { coords: [39.5696, 2.6502], beer: 4.0, temp: 19, flight: "1h 50m" },
  "Paris": { coords: [48.8566, 2.3522], beer: 7.5, temp: 15, flight: "1h 15m" },
  "Porto": { coords: [41.1579, -8.6291], beer: 2.5, temp: 17, flight: "2h 30m" },
  "Prag": { coords: [50.0755, 14.4378], beer: 2.5, temp: 15, flight: "1h 20m" },
  "Reykjavik": { coords: [64.1466, -21.9426], beer: 10.0, temp: 7, flight: "3h 50m" },
  "Riga": { coords: [56.9496, 24.1052], beer: 4.0, temp: 12, flight: "2h 25m" },
  "Rom": { coords: [41.9028, 12.4964], beer: 5.0, temp: 21, flight: "1h 35m" },
  "Sevilla": { coords: [37.3891, -5.9845], beer: 3.0, temp: 22, flight: "2h 35m" },
  "Sofia": { coords: [42.6977, 23.3219], beer: 2.0, temp: 16, flight: "2h 15m" },
  "Split": { coords: [43.5081, 16.4402], beer: 3.5, temp: 20, flight: "1h 35m" },
  "Stockholm": { coords: [59.3293, 18.0686], beer: 7.5, temp: 12, flight: "2h 25m" },
  "Tallinn": { coords: [59.4370, 24.7536], beer: 4.5, temp: 11, flight: "2h 40m" },
  "Valletta": { coords: [35.8989, 14.5146], beer: 4.0, temp: 20, flight: "2h 15m" },
  "Valencia": { coords: [39.4699, -0.3763], beer: 3.0, temp: 19, flight: "2h 05m" },
  "Venedig": { coords: [45.4408, 12.3155], beer: 6.0, temp: 18, flight: "1h 10m" },
  "Warschau": { coords: [52.2297, 21.0122], beer: 3.5, temp: 15, flight: "1h 55m" },
  "Wien": { coords: [48.2082, 16.3738], beer: 4.5, temp: 16, flight: "1h 20m" },
  "Zagreb": { coords: [45.8150, 15.9819], beer: 3.0, temp: 17, flight: "1h 25m" },
  "Zürich": { coords: [47.3769, 8.5417], beer: 8.0, temp: 14, flight: "0h 0m" },
  "Kiew": { coords: [50.4501, 30.5234], beer: 2.0, temp: 16, flight: "2h 40m" },
  "Lyon": { coords: [45.7640, 4.8357], beer: 6.0, temp: 16, flight: "1h 00m" },
  "Marseille": { coords: [43.2965, 5.3698], beer: 5.5, temp: 18, flight: "1h 25m" },
  "Turin": { coords: [45.0703, 7.6869], beer: 5.0, temp: 17, flight: "1h 00m" },
  "Bordeaux": { coords: [44.8378, -0.5792], beer: 6.0, temp: 17, flight: "1h 35m" },
  "Las Vegas": { coords: [36.1691, -115.1499], beer: 8.5, temp: 28, flight: "14h 00m" }
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
    const defaultData = EUROPE_CITIES[city.name] || { coords: [47.3769, 8.5417] }; 
    const coords = defaultData.coords;
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
      <div style="font-size:0.75rem; margin-top:5px; opacity:0.8;">
         ${city.beerPrice ? `🍻 CHF ${city.beerPrice}` : ''} 
         ${city.tempMay ? ` · ☀️ ${city.tempMay}°C` : ''}
      </div>
    </div>`;
    marker.bindPopup(popupHtml);
    markers[id] = marker;
  });
}

window.openCityEditor = openCityEditor;

// === SEED ===
const prevSeed=A.listeners.seedDefaults;
A.listeners.seedDefaults=async()=>{
  if(prevSeed) await prevSeed();
  const cityObj={};
  const startCities = ["Lissabon", "Prag", "Las Vegas", "Budapest", "Valencia"];
  
  startCities.forEach((n,i)=>{
    const data = EUROPE_CITIES[n] || {};
    cityObj["c_"+i]={
      name: n, status: "active", votes: 0, 
      price: "", depCh: "", depBack: "",
      beerPrice: data.beer || "", 
      tempMay: data.temp || "", 
      flightTime: data.flight || ""
    };
  });
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
    if(!str && str !== 0) return Infinity; 
    const num = parseFloat(String(str).replace(/[^\d.-]/g, ''));
    return isNaN(num) ? Infinity : num;
}
function parseDuration(str) {
    if (!str) return Infinity;
    let mins = 0;
    const hMatch = str.match(/(\d+)\s*h/i);
    const mMatch = str.match(/(\d+)\s*m/i);
    if (hMatch) mins += parseInt(hMatch[1]) * 60;
    if (mMatch) mins += parseInt(mMatch[1]);
    if (!hMatch && !mMatch) {
        const num = parseFloat(str);
        if (!isNaN(num)) return num; 
    }
    return mins || Infinity;
}
function parseDateForSort(str) {
    if(!str || str.trim() === "") return Infinity; 
    let day = 0, month = 5, hour = 0, minute = 0; 
    const timeMatch = str.match(/(\d{1,2})[:.](\d{2})/);
    if (timeMatch) { hour = parseInt(timeMatch[1], 10); minute = parseInt(timeMatch[2], 10); }
    const dateMatch = str.match(/(\d{1,2})\.(\d{1,2})?/) || str.match(/(\d{1,2})/);
    if (dateMatch) {
        day = parseInt(dateMatch[1], 10);
        if (dateMatch[2]) month = parseInt(dateMatch[2], 10); 
    }
    return (month * 1000000) + (day * 10000) + (hour * 100) + minute;
}

function renderCitiesTable(entries) {
    const listDiv = $("citiesList");
    if(!listDiv) return;

    window._citySort = window._citySort || { col: 'votes', asc: false };
    const sort = window._citySort;

    let sorted = [...entries];
    sorted.sort((a,b) => {
        const cA = a[1];
        const cB = b[1];

        if (cA.status !== cB.status) return cA.status === 'active' ? -1 : 1;

        let valA, valB;
        if(sort.col === 'name') { valA = cA.name.toLowerCase(); valB = cB.name.toLowerCase(); }
        else if(sort.col === 'votes') { valA = cA.votes || 0; valB = cB.votes || 0; }
        else if(sort.col === 'price') { valA = parsePrice(cA.price); valB = parsePrice(cB.price); }
        else if(sort.col === 'beerPrice') { valA = parsePrice(cA.beerPrice); valB = parsePrice(cB.beerPrice); }
        else if(sort.col === 'tempMay') { valA = parsePrice(cA.tempMay); valB = parsePrice(cB.tempMay); }
        else if(sort.col === 'flightTime') { valA = parseDuration(cA.flightTime); valB = parseDuration(cB.flightTime); }
        else if(sort.col === 'depCh') { valA = parseDateForSort(cA.depCh); valB = parseDateForSort(cB.depCh); }
        else if(sort.col === 'depBack') { valA = parseDateForSort(cA.depBack); valB = parseDateForSort(cB.depBack); }

        if (valA < valB) return sort.asc ? -1 : 1;
        if (valA > valB) return sort.asc ? 1 : -1;
        return 0;
    });

    const indicator = (col) => sort.col === col ? (sort.asc ? ' ▲' : ' ▼') : '';

    let html = `<div style="overflow-x:auto; margin-top:15px; border-radius:8px; border:1px solid var(--border);">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem; white-space:nowrap;">
        <thead style="cursor:pointer; user-select:none;">
            <tr>
                <th style="padding:10px; position:sticky; left:0; background:var(--card2); z-index:2; border-right:1px solid var(--border);" onclick="window.setCitySort('name')">Stadt${indicator('name')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('votes')">Pkt${indicator('votes')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('price')">Budget${indicator('price')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('beerPrice')">0.5l Bier${indicator('beerPrice')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('tempMay')">Temp Mai${indicator('tempMay')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('flightTime')">Flugzeit${indicator('flightTime')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('depCh')">Hinflug${indicator('depCh')}</th>
                <th style="padding:10px; background:var(--card2);" onclick="window.setCitySort('depBack')">Rückflug${indicator('depBack')}</th>
            </tr>
        </thead>
        <tbody>`;

    if(sorted.length === 0) {
        html += `<tr><td colspan="8" style="padding:10px; text-align:center; opacity:0.5;">Keine Städte vorhanden</td></tr>`;
    }

    sorted.forEach(([id, city]) => {
        const isElim = city.status === 'eliminated';
        const rowStyle = isElim ? 'opacity:0.4; text-decoration:line-through;' : '';
        const clickAction = A.isHost ? `onclick="window.openCityEditor('${id}')" style="cursor:pointer;"` : '';

        html += `<tr style="border-top:1px solid var(--border); transition:background 0.2s;" ${clickAction}>
            <td style="padding:10px; font-weight:bold; ${rowStyle} position:sticky; left:0; background:var(--card); z-index:1; border-right:1px solid var(--border);">${city.name}</td>
            <td style="padding:10px; background:var(--card); ${rowStyle}">
                <span class="vote-pill ${city.votes < 0 ? 'neg' : ''}" style="display:inline-block; padding:2px 6px;">${city.votes>0?'+':''}${city.votes||0}</span>
            </td>
            <td style="padding:10px; background:var(--card); ${rowStyle}">${city.price || '-'}</td>
            <td style="padding:10px; background:var(--card); ${rowStyle}">${city.beerPrice ? 'CHF ' + city.beerPrice : '-'}</td>
            <td style="padding:10px; background:var(--card); ${rowStyle}">${city.tempMay ? city.tempMay + ' °C' : '-'}</td>
            <td style="padding:10px; background:var(--card); ${rowStyle}">${city.flightTime || '-'}</td>
            <td style="padding:10px; background:var(--card); font-size:0.7rem; ${rowStyle}">${city.depCh || '-'}</td>
            <td style="padding:10px; background:var(--card); font-size:0.7rem; ${rowStyle}">${city.depBack || '-'}</td>
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
        // Preis/Zeiten standardmäßig aufsteigend (günstigste/schnellste/früheste zuerst). Temperatur standardmäßig absteigend (wärmste zuerst).
        if (col === 'tempMay' || col === 'votes') window._citySort.asc = false;
        else window._citySort.asc = true;
    }
    renderCitiesTable(Object.entries((A.state.cities||{}).list||{}));
};

function renderVoteAction(aa,round,list,entries){
  const myV=(round.votes||{})[A.user];
  const me=A.players[A.user]||{};
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
    <label class="sub">Reisebudget (z.B. CHF 250):</label>
    <input id="edPrice" value="${city.price||''}" placeholder="z.B. CHF 250">
    <div class="grid2">
       <div>
           <label class="sub">Bierpreis (CHF):</label>
           <input id="edBeer" type="number" step="0.5" value="${city.beerPrice||''}" placeholder="z.B. 4.5">
       </div>
       <div>
           <label class="sub">Temp Mai (°C):</label>
           <input id="edTemp" type="number" value="${city.tempMay||''}" placeholder="z.B. 21">
       </div>
    </div>
    <label class="sub">Flugzeit (z.B. 1h 30m):</label>
    <input id="edFlight" value="${city.flightTime||''}" placeholder="z.B. 1h 30m">
    <label class="sub">Hinflug:</label>
    <input id="edDepCh" value="${city.depCh||''}" placeholder="z.B. 12. 14:30">
    <label class="sub">Rückflug:</label>
    <input id="edDepBack" value="${city.depBack||''}" placeholder="z.B. 14. 18:00">
    <div class="row">
      <button class="btn-green" id="edSave">💾 Speichern</button>
      <button class="btn-red" id="edDelete">🗑️ Loeschen</button>
    </div>
    <button class="btn-ghost" id="edClose">Schliessen</button>
  `;
  $("edSave").onclick=async()=>{
    await update(ref(db,`rooms/${A.room}/cities/list/${cid}`),{
      price:$("edPrice").value.trim(),
      beerPrice:$("edBeer").value.trim(),
      tempMay:$("edTemp").value.trim(),
      flightTime:$("edFlight").value.trim(),
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

  const data = EUROPE_CITIES[v] || {};
  await set(ref(db,`rooms/${A.room}/cities/list/c_${Date.now()}`),{
      name: v, 
      status: "active", 
      votes: 0, 
      price: "", 
      depCh: "", 
      depBack: "",
      beerPrice: data.beer || "",
      tempMay: data.temp || "",
      flightTime: data.flight || ""
  });
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
