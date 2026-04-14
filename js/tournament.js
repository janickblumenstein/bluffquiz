// === tournament.js - Turniere: Reaktion, Schiffe, TicTacToe-3 ===
import { runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
const A=window.App;
// Destructuring wird zur Laufzeit gemacht (nicht bei Import-Zeit)
// damit core.js sicher schon initialisiert ist.
let db,ref,set,onValue,update,get,remove,$,toast,awardScore,shuffle;
function initRefs(){
  ({db,ref,set,onValue,update,get,remove,$,toast,awardScore,shuffle}=A);
}

const BS_SIZE=6, BS_SHIPS=[{name:"Estrella-Frachter",len:3},{name:"Mahou-Boot",len:2},{name:"Cana-Kahn",len:2},{name:"Shot-Glas",len:1}];

// === BIER-DUELL Konstanten ===
const BIERE = [
  // Favorit (Stark: schlägt 3 Biere + Wasser)
  {id:"amsterdam", name:"Amsterdam", type:"IPA",    emoji:"🌿", beats:["berlin","zofingen","edinburgh","wasser"]},
  
  // Normal (schlagen 2 Biere + Wasser)
  {id:"berlin",    name:"Berlin",    type:"Pils",   emoji:"🟠", beats:["zofingen","krakau","wasser"]},
  {id:"zofingen",  name:"Zofingen",  type:"Lager",  emoji:"🍺", beats:["edinburgh","wien","wasser"]},
  {id:"edinburgh", name:"Edinburgh", type:"Stout",  emoji:"🍫", beats:["krakau","damaskus","wasser"]},
  {id:"wien",      name:"Wien",      type:"Vienna", emoji:"🥨", beats:["damaskus","palma","wasser"]},
  {id:"damaskus",  name:"Damaskus",  type:"Amber",  emoji:"💣", beats:["palma","amsterdam","wasser"]},
  {id:"palma",     name:"Palma",     type:"Weizen", emoji:"🍌", beats:["berlin","amsterdam","wasser"]},
  
  // Schwach (schlägt nur 1 Bier + Wasser)
  {id:"krakau",    name:"Krakau",    type:"Sauer",  emoji:"🐷", beats:["wien","wasser"]},
  
  // SPECIALS
  {id:"schnaps",   name:"Kraueterschnaps",   type:"Schnaps",emoji:"🥃", beats:["amsterdam","berlin","zofingen","edinburgh","krakau","wien","damaskus","palma"]},
  {id:"wasser",    name:"Wasser",    type:"Stilles",emoji:"💧", beats:["schnaps"]}
];
const BIER_MAP=Object.fromEntries(BIERE.map(b=>[b.id,b]));
function bierWinner(idA,idB){
  if(idA===idB) return null; // Draw
  const a=BIER_MAP[idA], b=BIER_MAP[idB];
  if(a.beats.includes(b.id)) return idA;
  if(b.beats.includes(a.id)) return idB;
  return null; // Wenn keine Dominanz → Draw
}

const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  initRefs();
  if(prevReady) prevReady();
  onValue(ref(db,`rooms/${A.room}/tournamentSetup`),snap=>{
    A.state.tournamentSetup=snap.val();
    if(A.state.tournamentSetup){ A.switchTab("Games"); renderOfficialPanel(); }
    else renderOfficialPanel();
  });
  onValue(ref(db,`rooms/${A.room}/tournament`),snap=>{
    const wasActive=A.state.tournament&&A.state.tournament.active;
    A.state.tournament=snap.val();
    if(A.state.tournament&&A.state.tournament.active){
      if(!wasActive){ A.switchTab("Games"); toast("⚔️ Turnier gestartet!"); }
      renderOfficialPanel();
    } else renderOfficialPanel();
  });
  // Turnier-Start-Buttons
  document.querySelectorAll("[data-start]").forEach(b=>{
    const t=b.dataset.start;
    if(t==="reaction-tournament") b.onclick=()=>startSetup("reaction");
    else if(t==="battleship-tournament") b.onclick=()=>startSetup("battleship");
    else if(t==="tictactoe-tournament") b.onclick=()=>startSetup("tictactoe");
    else if(t==="bierduel-tournament") b.onclick=()=>startSetup("bierduel");
    else if(t==="memory-tournament") b.onclick=()=>startSetup("memory");
    else if(t==="roulette-tournament") b.onclick=()=>startSetup("roulette");
    else if(t==="stopwatch-tournament") b.onclick=()=>startSetup("stopwatch");
  });
};

function renderOfficialPanel(){
  const setup=A.state.tournamentSetup;
  const t=A.state.tournament;
  const panel=$("officialPanel");
  
  if(setup){ panel.classList.remove("hidden"); renderSetup(); return; }
  if(t&&t.active){
    panel.classList.remove("hidden");
    renderTournament(t);
    return;
  }
}

async function startSetup(gameType){
  if(!A.isHost) return;
  await remove(ref(db,`rooms/${A.room}/official`));
  await remove(ref(db,`rooms/${A.room}/tournament`));
  await remove(ref(db,`rooms/${A.room}/quizMulti`));
  await remove(ref(db,`rooms/${A.room}/duelSession`));
  await remove(ref(db,`rooms/${A.room}/duelSetup`));
  await set(ref(db,`rooms/${A.room}/tournamentSetup`),{gameType,picks:{},startedAt:Date.now()});
  A.switchTab("Games");
}

function renderSetup(){
  const setup=A.state.tournamentSetup; if(!setup) return;
  
  // HIER FEHLTEN DIE NEUEN SPIELE!
  const labels={
    reaction: "⚡ Reaktions-Test",
    battleship: "⚓ Schiffeversenken",
    tictactoe: "⭕ TicTacToe-3",
    bierduel: "🍺 Bier-Duell",
    memory: "🧠 Bier-Memory",           // NEU
    roulette: "💥 Bier-Roulette",      // NEU
    stopwatch: "⏱️ 5-Sekunden-Stoppuhr" // NEU
  };
  
  const body=$("officialBody");
  const picks=setup.picks||{};
  let html=`<div class="q-big">${labels[setup.gameType]} Turnier</div>`;
  html+=`<h3>Teilnehmer waehlen:</h3><div class="sub">${A.isHost?'Tippe Spieler an die mitmachen':'Host waehlt...'}</div>`;
  Object.keys(A.players).forEach(p=>{
    const sel=picks[p];
    html+=`<button class="${sel?'btn-green':'btn-ghost'}" style="text-align:left" data-pick="${p}" ${A.isHost?'':'disabled'}>${sel?'✓ ':''}${p}</button>`;
  });
  const cnt=Object.values(picks).filter(Boolean).length;
  html+=`<div class="sub">${cnt} Teilnehmer ausgewaehlt</div>`;
  if(A.isHost){
    html+=`<button class="btn-green" id="bracketGo" ${cnt<2?'disabled':''}>Turnier starten!</button>`;
    html+=`<button class="btn-red" id="bracketCancel">Abbrechen</button>`;
  }
  body.innerHTML=html;
  document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=async()=>{
    const p=b.dataset.pick;
    await set(ref(db,`rooms/${A.room}/tournamentSetup/picks/${p}`),!(setup.picks||{})[p]);
  });
  const bg=$("bracketGo"); if(bg) bg.onclick=actuallyStart;
  const bc=$("bracketCancel"); if(bc) bc.onclick=()=>remove(ref(db,`rooms/${A.room}/tournamentSetup`));
}

function buildBracketRound(players, alreadyByed){
  // Paare bilden. Bei ungerader Anzahl: Bye an Spieler der noch nie Bye hatte.
  const shuffled=shuffle([...players]);
  const matches=[];
  let working=shuffled;
  if(working.length%2===1){
    const candidates=working.filter(p=>!alreadyByed.includes(p));
    const pool=candidates.length?candidates:working;
    const byeP=pool[Math.floor(Math.random()*pool.length)];
    working=working.filter(p=>p!==byeP);
    matches.push({p1:byeP,p2:null,winner:byeP,bye:true});
  }
  for(let i=0;i<working.length;i+=2){
    matches.push({p1:working[i],p2:working[i+1],winner:null});
  }
  return matches;
}

function buildBracket(participants){
  // Speichere als flaches Array mit round-Property, und eine Liste alreadyByed
  return { matches: buildBracketRound(participants,[]).map(m=>({...m,round:1})), byedHistory:[] };
}

async function actuallyStart(){
  if(!A.isHost) return;
  
  // Nutzt den verlässlichen lokalen State
  const setup = A.state.tournamentSetup;
  if(!setup || !setup.gameType) {
      toast("Fehler: Turnier-Typ nicht gefunden. Bitte neu starten.");
      return;
  }
  
  const participants=Object.keys(setup.picks||{}).filter(p=>setup.picks[p]);
  if(participants.length<2) return alert("Mindestens 2 Teilnehmer waehlen!");
  
  const bracket=buildBracket(participants);
  const safeGameType = String(setup.gameType);

  // ATOMARES UPDATE: Verhindert Ladefehler beim Turnierstart
  const updates = {};
  updates[`rooms/${A.room}/tournamentSetup`] = null;
  updates[`rooms/${A.room}/tournament`] = {
    active:true, 
    gameType: safeGameType, 
    matches:bracket.matches,
    byedHistory:bracket.byedHistory,
    currentRound:1,
    currentMatchIdx:findFirstUnplayed(bracket.matches),
    startedAt:Date.now()
  };

  await update(ref(db), updates);
}

function findFirstUnplayed(matches){
  for(let i=0;i<matches.length;i++) if(!matches[i].winner) return i;
  return -1;
}

function findMatchForUser(t){
  // 1. Manuell gewaehltes Spectator-Match hat HOECHSTE Prioritaet (wenn gesetzt)
  const spectIdx=A._spectIdx;
  if(spectIdx!==undefined && spectIdx!==null && t.matches[spectIdx] && !t.matches[spectIdx].winner) return spectIdx;
  // 2. Eigenes aktives Match
  for(let i=0;i<t.matches.length;i++){
    const m=t.matches[i];
    if(m.winner||m.bye) continue;
    if(m.p1===A.user||m.p2===A.user) return i;
  }
  // 3. Erstes laufendes Match
  let minRound=Infinity;
  for(const m of t.matches) if(!m.winner && !m.bye && m.p1 && m.p2 && m.round<minRound) minRound=m.round;
  for(let i=0;i<t.matches.length;i++){
    const m=t.matches[i];
    if(!m.winner && !m.bye && m.round===minRound && m.p1 && m.p2) return i;
  }
  return findFirstUnplayed(t.matches);
}

function renderMatchPicker(t,bh){
  // Liste aller laufenden Matches in der aktuellen Runde
  let minRound=Infinity;
  for(const m of t.matches) if(!m.winner && !m.bye && m.p1 && m.p2 && m.round<minRound) minRound=m.round;
  const live=t.matches.map((m,i)=>({m,i})).filter(x=>!x.m.winner && !x.m.bye && x.m.p1 && x.m.p2 && x.m.round===minRound);
  if(live.length<=1) return "";
  let html=`<hr><div class="sub">Mehrere Matches laufen parallel - waehle was du sehen willst:</div>`;
  live.forEach(({m,i})=>{
    const sel=A._spectIdx===i?"btn-gold":"btn-ghost";
    html+=`<button class="${sel} btn-sm" data-spect="${i}">${m.p1} vs ${m.p2}</button> `;
  });
  if(A._spectIdx!==undefined && A._spectIdx!==null){
    html+=`<button class="btn-red btn-sm" data-spect-clear="1">🚪 Zu meinem Match</button>`;
  }
  return html;
}

async function advanceTournament(idx,winner){
  const t=(await get(ref(db,`rooms/${A.room}/tournament`))).val();
  if(!t) return;
  const updated=t.matches.map(m=>({...m}));
  const wasAlreadyDone=updated[idx].winner&&!updated[idx].bye;
  if(!updated[idx].winner) updated[idx].winner=winner;

  // Punkte fuer gewonnenen Match (nicht Byes)
  if(!wasAlreadyDone && winner && !updated[idx].bye && !updated[idx].pointsAwarded){
    await awardScore(winner,5);
    updated[idx].pointsAwarded=true;
    toast(`+5 Pkt fuer ${winner}`);
  }

  // Pruefen ob aktuelle Runde komplett fertig
  const currentRound=updated[idx].round;
  const roundMatches=updated.filter(m=>m.round===currentRound);
  const allDone=roundMatches.every(m=>m.winner);
  const winnersOfRound=roundMatches.map(m=>m.winner).filter(w=>w);
  const byedHistory=(t.byedHistory||[]).slice();
  // Bye-Spieler in Runde tracken
  roundMatches.forEach(m=>{if(m.bye&&m.p1&&!byedHistory.includes(m.p1)) byedHistory.push(m.p1);});

  let updates={matches:updated,byedHistory};
  if(allDone && winnersOfRound.length>1){
    // Naechste Runde dynamisch bauen
    const nextRoundMatches=buildBracketRound(winnersOfRound,byedHistory).map(m=>({...m,round:currentRound+1}));
    // Bye-Player in der neuen Runde auch in history
    nextRoundMatches.forEach(m=>{if(m.bye&&m.p1&&!byedHistory.includes(m.p1)) byedHistory.push(m.p1);});
    updates.matches=[...updated,...nextRoundMatches];
    updates.byedHistory=byedHistory;
    updates.currentRound=currentRound+1;
    // Bye-Punkte in neuen Runden: NULL Punkte (damit sich keiner mit Byes hochspielt)
  }
  updates.currentMatchIdx=findFirstUnplayed(updates.matches);
  await update(ref(db,`rooms/${A.room}/tournament`),updates);

  // Turnier beendet?
  if(winnersOfRound.length===1){
    // Das war das Finale
    if(!t.finalAwarded){
      await awardScore(winnersOfRound[0],5);
      await update(ref(db,`rooms/${A.room}/tournament`),{finalAwarded:true});
      toast(`🏆 ${winnersOfRound[0]} gewinnt das Turnier! +5 Bonus`);
    }
  }
}

function bracketHtml(t){
  let html='<hr><h3>🏆 Turnierbaum</h3><div class="bracket">';
  const byRound={};
  t.matches.forEach((m,i)=>{(byRound[m.round]=byRound[m.round]||[]).push({...m,idx:i})});
  Object.keys(byRound).sort().forEach(r=>{
    html+=`<div style="font-size:.7rem;opacity:.6;margin-top:6px">Runde ${r}</div>`;
    byRound[r].forEach(m=>{
      html+=`<div class="match"><span class="${m.winner===m.p1?'winner':''}">${m.p1||'?'}</span><span>vs</span><span class="${m.winner===m.p2?'winner':''}">${m.p2||(m.bye?'(Freilos)':'?')}</span></div>`;
    });
  });
  return html+'</div>';
}

function renderTournament(t){
  const body=$("officialBody");
  const parallelMode=(t.gameType==="battleship"||t.gameType==="tictactoe"||t.gameType==="bierduel"||t.gameType==="roulette"||t.gameType==="stopwatch"||t.gameType==="memory");
  const idx=parallelMode?findMatchForUser(t):t.currentMatchIdx;
  const bh=bracketHtml(t);
  const picker=parallelMode?renderMatchPicker(t,bh):"";

  if(idx<0){
    const winner=t.matches[t.matches.length-1].winner;
    let html=`<div class="q-big">🏆 ${winner} gewinnt das Turnier!</div>
      <div class="flash gold">Punkte automatisch verteilt: <br>+5 pro gewonnenem Match · +5 Bonus fuer Turniersieger</div>${bh}`;
    if(A.isHost) html+='<button class="btn-ghost" id="closeTour">Schliessen</button>';
    body.innerHTML=html;
    const cl=$("closeTour"); if(cl) cl.onclick=()=>remove(ref(db,`rooms/${A.room}/tournament`));
    return;
  }

  const m=t.matches[idx];
  if(m.bye){
    setTimeout(()=>advanceTournament(idx,m.p1),800);
    body.innerHTML=`<div class="q-big">${m.p1} hat Freilos!</div>${bh}`;
    return;
  }

  // === HIER WAR DER FEHLER: Dieser Block fehlte! ===
  if(t.gameType==="reaction") renderReaction(t,idx,m,bh);
  else if(t.gameType==="battleship") renderBattleship(t,idx,m,bh+picker);
  else if(t.gameType==="tictactoe") renderTicTacToe(t,idx,m,bh+picker);
  else if(t.gameType==="bierduel") renderBierDuel(t,idx,m,bh+picker);
  else if(t.gameType==="memory") renderMemory(t,idx,m,bh+picker);
  else if(t.gameType==="roulette") renderRoulette(t,idx,m,bh+picker);
  else if(t.gameType==="stopwatch") renderStopwatch(t,idx,m,bh+picker);

  // FIX: Zuschauer-Buttons IMMER neu verknüpfen, nachdem das HTML aktualisiert wurde
  setTimeout(()=>{
    document.querySelectorAll("[data-spect]").forEach(b=>b.onclick=()=>{
      A._spectIdx=parseInt(b.dataset.spect);
      renderTournament(A.state.tournament);
    });
    document.querySelectorAll("[data-spect-clear]").forEach(b=>b.onclick=()=>{
      A._spectIdx=null;
      renderTournament(A.state.tournament);
    });
  },0);
}

// === REACTION (First-Click-Wins via Transaction) ===

function renderReaction(t,idx,m,bh){
  const body=$("officialBody");
  const rd = (t.reaction && t.reaction[idx]) || { phase: "waiting", ready: {}, scores: { [m.p1]: 0, [m.p2]: 0 }, round: 1, history: [] };
  const isPlayer=A.user===m.p1||A.user===m.p2;
  const opp = A.user === m.p1 ? m.p2 : m.p1;
  
  let html=`<div class="q-big">⚡ ${m.p1} vs ${m.p2}</div>`;

  // Scoreboard
  html += `<div class="card" style="background:rgba(52,152,219,0.1); border:1px solid var(--blue); margin-bottom:15px; padding:10px;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div style="text-align:left; flex:1;"><b>${m.p1}</b></div>
      <div style="font-size:1.5rem; font-weight:900; color:var(--blue);">${rd.scores[m.p1]}:${rd.scores[m.p2]}</div>
      <div style="text-align:right; flex:1;"><b>${m.p2}</b></div>
    </div>
    <div class="sub" style="text-align:center;">Best of 3 · Runde ${rd.round}</div>
  </div>`;

  if(rd.phase==="waiting"){
    if(isPlayer){
      const rdy=rd.ready && rd.ready[A.user];
      html+=`<button class="${rdy?'btn-green':'btn-blue'}" id="reactReady">${rdy?'✓ Bereit':'BEREIT DRÜCKEN'}</button>`;
    } else html+=`<div class="sub" style="text-align:center">Warte auf Spieler...</div>`;
  } else if(rd.phase==="countdown"){
    html+=`<div id="reactBox" style="background:var(--red);height:180px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:bold;margin:10px 0">WARTEN...</div>`;
  } else if(rd.phase==="go"){
    html+=`<div id="reactBox" style="background:var(--green);height:180px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:bold;color:#000;margin:10px 0;cursor:pointer;">JETZT!</div>`;
  } else if(rd.phase==="round_done" || rd.phase==="done"){
    const last = rd.history ? rd.history[rd.history.length-1] : null;
    if(last){
      const early = last.winTime === "FRUEH";
      html += `<div class="flash ${early?'warn':''}" style="text-align:center;">
        <div style="font-size:1.2rem;">${early ? '🚫 Zu früh gedrückt!' : '⏱️ Zeit-Check'}</div>
        <div style="margin-top:5px;"><b>${last.winner}</b> war schneller!</div>
        ${!early ? `<div class="sub">Reaktionszeit: ${(last.winTime/1000).toFixed(3)}s</div>` : ''}
      </div>`;
    }

    if(rd.phase==="done"){
      html += `<div class="flash gold" style="text-align:center; font-weight:bold;">🏆 MATCH-SIEG: ${rd.winner}</div>`;
      if(A.isHost) html+=`<button class="btn-green" id="nextMatch">Turnier fortsetzen</button>`;
    } else if(A.isHost) {
      html += `<button class="btn-orange" id="nextReactRound">Nächste Runde starten</button>`;
    }
  }

  body.innerHTML=html+bh;

  // Event Bindings
  const rdBtn = $("reactReady"); if(rdBtn) rdBtn.onclick = async () => {
    await set(ref(db,`rooms/${A.room}/tournament/reaction/${idx}/ready/${A.user}`),true);
    const snap = await get(ref(db,`rooms/${A.room}/tournament/reaction/${idx}/ready`));
    const r = snap.val() || {};
    if(r[m.p1] && r[m.p2]) {
      const wait = 2000 + Math.random() * 4000;
      await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`), { phase: "countdown", goAt: Date.now() + wait });
    }
  };

  const nrBtn = $("nextReactRound"); if(nrBtn) nrBtn.onclick = async () => {
    await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`), { phase: "waiting", ready: {}, goAt: null });
  };

  const nmBtn = $("nextMatch"); if(nmBtn) nmBtn.onclick = () => advanceTournament(idx, rd.winner);

  // Countdown Logic
  if(rd.phase==="countdown" && rd.goAt){
    const diff = rd.goAt - Date.now();
    if(diff <= 0) update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`), { phase: "go", goAt: Date.now() });
    else A.timers.push(setTimeout(() => update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`), { phase: "go", goAt: Date.now() }), diff));
  }

  // Click Logic
  const rb = $("reactBox"); if(rb && isPlayer){
    rb.onclick = async () => {
      if(A._reactClicking) return;
      A._reactClicking = true;
      const tap = Date.now();
      const current = (await get(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`))).val();
      if(!current || (current.phase !== "countdown" && current.phase !== "go")) { A._reactClicking=false; return; }

      const winTime = current.phase === "countdown" ? "FRUEH" : tap - current.goAt;
      const roundWinner = (winTime === "FRUEH") ? opp : A.user;
      
      const newScores = { ...rd.scores };
      newScores[roundWinner]++;
      const newHistory = [...(rd.history || []), { winner: roundWinner, winTime }];
      const matchWinner = newScores[roundWinner] >= 2 ? roundWinner : null;

      await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`), {
        phase: matchWinner ? "done" : "round_done",
        scores: newScores,
        history: newHistory,
        winner: matchWinner,
        round: rd.round + 1
      });
      A._reactClicking = false;
    };
  }
}

// === BATTLESHIP ===
function placeShipsRandom(){
  const grid=Array(BS_SIZE*BS_SIZE).fill(null);
  const ships=[];
  const isOccupiedOrAdjacent=(r,c)=>{
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      const rr=r+dr,cc=c+dc;
      if(rr<0||cc<0||rr>=BS_SIZE||cc>=BS_SIZE) continue;
      if(grid[rr*BS_SIZE+cc]!==null) return true;
    }
    return false;
  };
  for(const s of BS_SHIPS){
    let placed=false,tries=0;
    const tryPlace=(useBuffer)=>{
      const horiz=Math.random()<0.5;
      const r=Math.floor(Math.random()*BS_SIZE), c=Math.floor(Math.random()*BS_SIZE);
      const cells=[]; let ok=true;
      for(let i=0;i<s.len;i++){
        const rr=horiz?r:r+i, cc=horiz?c+i:c;
        if(rr>=BS_SIZE||cc>=BS_SIZE){ok=false;break}
        if(useBuffer){ if(isOccupiedOrAdjacent(rr,cc)){ok=false;break} }
        else { if(grid[rr*BS_SIZE+cc]!==null){ok=false;break} }
        cells.push(rr*BS_SIZE+cc);
      }
      if(ok){ cells.forEach(ix=>grid[ix]=ships.length); ships.push({name:s.name,cells,hits:[]}); return true; }
      return false;
    };
    while(!placed&&tries<500){ tries++; placed=tryPlace(true); }
    while(!placed&&tries<700){ tries++; placed=tryPlace(false); }
  }
  return {ships,shotsAt:[]};
}

// === BIERDECKEL-ROULETTE ===
function generateRouletteBoard() {
    const board = new Array(9).fill(0); // 0 = Safe
    const bombIndex = Math.floor(Math.random() * 9);
    board[bombIndex] = 1; // 1 = Kater/Bombe
    return board;
}

async function initRoulette(idx, m) {
  if (!A.isHost) return;
  const t = (await get(ref(db, `rooms/${A.room}/tournament`))).val();
  if (!t) return;
  const myRound = t.matches[idx].round;
  const updates = {};

  t.matches.forEach((mt, i) => {
    if (mt.round === myRound && !mt.winner && !mt.bye && mt.p1 && mt.p2) {
      if (!(t.roulette && t.roulette[i])) {
        updates[i] = {
          board: generateRouletteBoard(),
          revealed: [], // Welche Indices wurden schon geklickt?
          turn: mt.p1,
          phase: "play",
          round: 1,
          scores: { [mt.p1]: 0, [mt.p2]: 0 },
          startedAt: Date.now()
        };
      }
    }
  });
  await update(ref(db, `rooms/${A.room}/tournament/roulette`), updates);
  toast(`${Object.keys(updates).length} Match(es) gestartet`);
}

async function rlFlip(idx, cellIdx, m) {
  const r = ref(db, `rooms/${A.room}/tournament/roulette/${idx}`);
  const d = (await get(r)).val();
  if (!d || d.phase !== "play" || d.turn !== A.user) return;

  const revealed = d.revealed || [];
  if (revealed.includes(cellIdx)) return; // Schon aufgedeckt

  const isBomb = d.board[cellIdx] === 1;
  const updates = {};
  
  if (isBomb) {
      // BUMM! Der Gegner kriegt den Punkt
      const roundWinner = A.user === m.p1 ? m.p2 : m.p1;
      const newScores = { ...d.scores };
      newScores[roundWinner] = (newScores[roundWinner] || 0) + 1;
      
      updates.scores = newScores;
      updates.revealed = [...revealed, cellIdx]; // Bombe zeigen
      
      if (newScores[roundWinner] >= 2) {
          // Match vorbei! (Zuerst 2 Siege)
          updates.phase = "done";
          updates.winner = roundWinner;
          await update(r, updates);
          setTimeout(() => advanceTournament(idx, roundWinner), 3000);
      } else {
          // Runde vorbei, kurze Pause, dann neues Board
          updates.phase = "show_bomb";
          await update(r, updates);
          
          setTimeout(async () => {
              const freshBoardUpdates = {
                  phase: "play",
                  board: generateRouletteBoard(),
                  revealed: [],
                  turn: roundWinner, // Gewinner der Runde darf als Zweites ziehen (Vorteil) -> Verlierer fängt an!
                  round: (d.round || 1) + 1
              };
              await update(r, freshBoardUpdates);
          }, 2000); // 2 Sekunden die Bombe zeigen
      }
  } else {
      // Puh, Glück gehabt! Nächster ist dran.
      updates.revealed = [...revealed, cellIdx];
      updates.turn = A.user === m.p1 ? m.p2 : m.p1;
      await update(r, updates);
  }
}

function renderRoulette(t, idx, m, bh) {
  const body = $("officialBody");
  const md = (t.roulette && t.roulette[idx]);
  
  if (!md) {
    body.innerHTML = `<div class="q-big">💥 ${m.p1} vs ${m.p2}</div>${A.isHost ? '<button class="btn-orange" id="rlInit">Match starten</button>' : '<div class="sub">Warte auf Host...</div>'}${bh}`;
    const btn = $("rlInit"); if (btn) btn.onclick = () => initRoulette(idx, m);
    return;
  }
  
  const isPlayer = A.user === m.p1 || A.user === m.p2;
  const score1 = (md.scores || {})[m.p1] || 0;
  const score2 = (md.scores || {})[m.p2] || 0;

  let html = `<div class="q-big">💥 ${m.p1} vs ${m.p2}</div>`;
  
  // Scoreboard
  html += `<div class="card" style="background:rgba(230,126,34,0.1); border:1px solid var(--orange); margin-bottom:15px;">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 10px;">
      <div style="text-align:left; flex:1;">
        <div style="font-size:0.7rem; opacity:0.6;">Spieler 1</div>
        <b style="${A.user === m.p1 ? 'color:var(--gold)' : ''}">${m.p1}</b>
      </div>
      <div style="font-size:1.8rem; font-weight:900; padding:0 15px; letter-spacing:4px; color:var(--orange);">${score1}:${score2}</div>
      <div style="text-align:right; flex:1;">
        <div style="font-size:0.7rem; opacity:0.6;">Spieler 2</div>
        <b style="${A.user === m.p2 ? 'color:var(--gold)' : ''}">${m.p2}</b>
      </div>
    </div>
    <div style="text-align:center; font-size:0.7rem; opacity:0.7; padding-bottom:5px; border-top:1px solid rgba(230,126,34,0.2);">
      Finde NICHT den Kater! (Zuerst 2 Pkt)
    </div>
  </div>`;

  if (md.phase === "done") {
    html += `<div class="flash" style="background:rgba(46,204,113,0.2); border-left:4px solid var(--green); text-align:center;">
      <div style="font-size:1.2rem;">🏆 <b>${md.winner}</b> gewinnt!</div>
    </div>`;
    if (A.isHost) html += `<button class="btn-green" id="rlNext" style="margin-top:10px;">Nächstes Match</button>`;
  } else if (md.phase === "show_bomb") {
     html += `<div class="flash" style="background:rgba(231,76,60,0.2); border-left:4px solid var(--red); text-align:center;">
      <div style="font-size:1.5rem;">💥 BUMM! 💥</div>
      <div class="sub">Punkt für den Gegner. Nächste Runde startet...</div>
    </div>`;
  } else {
    html += `<div class="flash ${md.turn === A.user ? 'gold' : ''}" style="text-align:center;">
      ${md.turn === A.user ? '<b>DEIN ZUG!</b> Deckel antippen...' : 'Warten auf ' + md.turn + '...'}
    </div>`;
  }

  // 3x3 Grid
  html += `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:20px auto; max-width:300px;">`;
  
  const revealed = md.revealed || [];
  for (let i = 0; i < 9; i++) {
    const isRevealed = revealed.includes(i);
    const isBomb = md.board && md.board[i] === 1;
    
    let bg = "var(--card2)";
    let border = "2px solid #444";
    let content = "";
    let cursor = (md.turn === A.user && md.phase === "play" && isPlayer && !isRevealed) ? "pointer" : "default";

    if (isRevealed) {
        if (isBomb) {
            bg = "rgba(231,76,60,0.2)";
            border = "2px solid var(--red)";
            content = "💥";
        } else {
            bg = "rgba(46,204,113,0.1)";
            border = "2px solid var(--green)";
            content = "🍺";
        }
    }

    html += `<div style="aspect-ratio:1; background:${bg}; border:${border}; border-radius:10px; display:flex; align-items:center; justify-content:center; cursor:${cursor}; font-size:2.5rem; transition:all 0.2s;" onclick="window.rlClick(${i})">${content}</div>`;
  }

  html += `</div>`;
  body.innerHTML = html + bh;

  window.rlClick = (i) => rlFlip(idx, i, m);
  const rn = $("rlNext"); if (rn) rn.onclick = () => advanceTournament(idx, md.winner);
}

// === BIER-STOPPUHR (Initialisierung) ===
async function initStopwatch(idx, m) {
  if (!A.isHost) return;
  const t = (await get(ref(db, `rooms/${A.room}/tournament`))).val();
  if (!t) return;
  const myRound = t.matches[idx].round;
  const updates = {};

  t.matches.forEach((mt, i) => {
    if (mt.round === myRound && !mt.winner && !mt.bye && mt.p1 && mt.p2) {
      if (!(t.stopwatch && t.stopwatch[i])) {
        updates[i] = {
          phase: "waiting",
          times: {},
          ready: {},
          scores: { [mt.p1]: 0, [mt.p2]: 0 },
          round: 1,
          startedAt: Date.now()
        };
      }
    }
  });
  await update(ref(db, `rooms/${A.room}/tournament/stopwatch`), updates);
}

// === BIER-STOPPUHR (Timer-Stopp Logik) ===
async function stopTimer(idx, m) {
  const r = ref(db, `rooms/${A.room}/tournament/stopwatch/${idx}`);
  const d = (await get(r)).val();
  if (!d || d.phase !== "running" || (d.times && d.times[A.user])) return;
  
  if (Date.now() < d.startTime) { toast("Zu früh!"); return; }

  const elapsed = (Date.now() - d.startTime) / 1000;
  await set(ref(db, `rooms/${A.room}/tournament/stopwatch/${idx}/times/${A.user}`), elapsed);

  const fresh = (await get(r)).val();
  if (fresh.times && fresh.times[m.p1] && fresh.times[m.p2]) {
    const diff1 = Math.abs(5 - fresh.times[m.p1]);
    const diff2 = Math.abs(5 - fresh.times[m.p2]);
    const roundWinner = diff1 < diff2 ? m.p1 : m.p2;
    
    const newScores = { ...d.scores };
    newScores[roundWinner]++;
    const matchWinner = newScores[roundWinner] >= 2 ? roundWinner : null;

    if (matchWinner) {
      await update(r, { phase: "done", winner: matchWinner, scores: newScores });
      setTimeout(() => advanceTournament(idx, matchWinner), 3500);
    } else {
      // Nächste Runde vorbereiten
      setTimeout(() => update(r, { phase: "waiting", ready: {}, times: {}, scores: newScores, round: d.round + 1 }), 3000);
    }
  }
}

async function swReady(idx, m) {
  const r = ref(db, `rooms/${A.room}/tournament/stopwatch/${idx}`);
  await set(ref(db, `rooms/${A.room}/tournament/stopwatch/${idx}/ready/${A.user}`), true);
  
  const d = (await get(r)).val();
  if (d && d.ready && d.ready[m.p1] && d.ready[m.p2] && d.phase === "waiting") {
      // Beide sind bereit -> Timer startet in exakt 2 Sekunden
      await update(r, { phase: "running", startTime: Date.now() + 2000 });
  }
}


function renderStopwatch(t, idx, m, bh) {
  const body = $("officialBody");
  const md = (t.stopwatch && t.stopwatch[idx]);
  
  if (!md) {
    body.innerHTML = `<div class="q-big">⏱️ ${m.p1} vs ${m.p2}</div>${A.isHost ? '<button class="btn-orange" id="swInit">Match starten</button>' : '<div class="sub">Warte auf Host...</div>'}${bh}`;
    const btn = $("swInit"); if (btn) btn.onclick = () => initStopwatch(idx, m);
    return;
  }
  
  const isPlayer = A.user === m.p1 || A.user === m.p2;
  const t1 = (md.times || {})[m.p1];
  const t2 = (md.times || {})[m.p2];

  let html = `<div class="q-big">⏱️ ${m.p1} vs ${m.p2}</div>`;
  html += `<div class="sub" style="text-align:center;">Stoppe die Zeit so nah wie möglich bei exakt <b>5.000 Sekunden!</b><br><span style="color:var(--orange)">Tipp: Nach 2 Sekunden wird die Uhr unsichtbar! 🙈</span></div>`;

  if (md.phase === "waiting") {
      html += `<div class="flash" style="text-align:center; margin-top:15px;">`;
      if (isPlayer) {
          const rdy = md.ready && md.ready[A.user];
          html += `<button class="${rdy ? 'btn-ghost' : 'btn-blue'}" id="swRdy" ${rdy ? 'disabled' : ''}>${rdy ? '✅ Du bist bereit' : 'Start drücken!'}</button>`;
          if (!rdy) html += `<div class="sub" style="margin-top:5px;">Sobald beide bereit sind, startet der Countdown.</div>`;
      } else {
          const rdy1 = md.ready && md.ready[m.p1];
          const rdy2 = md.ready && md.ready[m.p2];
          html += `Warte auf Spieler...<br>${m.p1}: ${rdy1 ? '✅' : '⏳'} | ${m.p2}: ${rdy2 ? '✅' : '⏳'}`;
      }
      html += `</div>`;
  } else if (md.phase === "running") {
      const myTime = md.times && md.times[A.user];
      html += `<div id="swBox" style="background:var(--card2); height:150px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:3.5rem; font-weight:bold; cursor:${isPlayer && !myTime ? 'pointer' : 'default'}; margin:15px 0; border:2px solid var(--blue);">`;
      
      if (myTime) {
         html += `<span style="color:var(--green)">✅ Gestoppt!</span>`;
      } else {
         html += `<span id="swDisplay">Bereit machen...</span>`;
      }
      html += `</div>`;
      
      if (isPlayer && !myTime) {
          html += `<button class="btn-red" style="padding:15px; font-size:1.5rem;" id="swStop">🛑 STOPP!</button>`;
      } else if (isPlayer && myTime) {
          html += `<div class="sub" style="text-align:center;">Warte auf Gegner...</div>`;
      }
  } else if (md.phase === "done") {
      const diff1 = Math.abs(5 - t1);
      const diff2 = Math.abs(5 - t2);
      html += `<div class="flash gold" style="text-align:center; margin-top:15px;">
         <div style="font-size:1.2rem;">🏆 <b>${md.winner}</b> gewinnt!</div>
         <hr style="border-color:rgba(0,0,0,0.1);">
         <div style="display:flex; justify-content:space-between; font-size:1.1rem; margin-top:10px;">
             <div style="${md.winner === m.p1 ? 'font-weight:bold; color:var(--gold);' : 'opacity:0.6;'}">
                 <div>${m.p1}</div>
                 <div>${t1 ? t1.toFixed(3) : '---'}s <br><small style="font-size:0.7rem">(Δ ${diff1.toFixed(3)})</small></div>
             </div>
             <div style="${md.winner === m.p2 ? 'font-weight:bold; color:var(--gold);' : 'opacity:0.6;'}">
                 <div>${m.p2}</div>
                 <div>${t2 ? t2.toFixed(3) : '---'}s <br><small style="font-size:0.7rem">(Δ ${diff2.toFixed(3)})</small></div>
             </div>
         </div>
      </div>`;
      if (A.isHost) html += `<button class="btn-green" id="swNext" style="margin-top:10px;">Nächstes Match</button>`;
  }

  body.innerHTML = html + bh;

  // Event Bindings
  const rBtn = $("swRdy"); if (rBtn) rBtn.onclick = () => swReady(idx, m);
  const sBtn = $("swStop"); if (sBtn) sBtn.onclick = () => stopTimer(idx, m);
  const bBtn = $("swBox"); if (bBtn && isPlayer && md.phase==="running" && (!md.times || !md.times[A.user])) bBtn.onclick = () => stopTimer(idx, m);
  const nBtn = $("swNext"); if (nBtn) nBtn.onclick = () => advanceTournament(idx, md.winner);

  // Visueller Live-Timer
  if (md.phase === "running") {
      const display = $("swDisplay");
      if (display) {
         const updateTimer = () => {
             const now = Date.now();
             const diff = now - md.startTime;
             if (diff < 0) {
                 display.innerText = "⏳ " + Math.ceil(Math.abs(diff)/1000) + "s";
             } else if (diff < 2000) {
                 display.innerText = (diff / 1000).toFixed(2) + "s";
             } else {
                 display.innerText = "🙈 ???";
             }
         };
         // Wir fügen das Intervall der App hinzu, damit es sauber aufgeräumt wird
         A.timers.push(setInterval(updateTimer, 50));
      }
  }
}

// === BIER-MEMORY ===
async function initMemory(idx, m) {
  if (!A.isHost) return;
  const t = (await get(ref(db, `rooms/${A.room}/tournament`))).val();
  if (!t) return;
  const myRound = t.matches[idx].round;
  const updates = {};

  // Wir nehmen die 8 Biere + 1 Schnaps = 9 Items -> 18 Karten (Immer ein Sieger!)
  const pool = BIERE.filter(b => b.id !== "wasser"); 
  let deck = [];
  pool.forEach(b => { deck.push(b.id); deck.push(b.id); }); // Jedes Item 2x

  t.matches.forEach((mt, i) => {
    if (mt.round === myRound && !mt.winner && !mt.bye && mt.p1 && mt.p2) {
      if (!(t.memory && t.memory[i])) {
        // Deck für jedes Match individuell mischen
        const shuffledDeck = shuffle([...deck]);
        // State: hidden, flipped, matched
        const board = shuffledDeck.map(id => ({ id, state: "hidden" }));
        
        updates[i] = {
          board: board,
          turn: mt.p1,
          phase: "play",
          scores: { [mt.p1]: 0, [mt.p2]: 0 },
          startedAt: Date.now()
        };
      }
    }
  });
  await update(ref(db, `rooms/${A.room}/tournament/memory`), updates);
  toast(`${Object.keys(updates).length} Match(es) gestartet`);
}

async function memFlip(idx, cardIdx, m) {
  const r = ref(db, `rooms/${A.room}/tournament/memory/${idx}`);
  const d = (await get(r)).val();
  if (!d || d.phase !== "play" || d.turn !== A.user) return;

  const board = [...d.board];
  if (board[cardIdx].state !== "hidden") return; // Bereits aufgedeckt oder gematcht

  // Zähle, wie viele Karten gerade "flipped" (aber noch kein Paar) sind
  const currentlyFlipped = board.map((c, i) => ({...c, i})).filter(c => c.state === "flipped");
  let updates = {};

  // FALL 1: Es liegen noch 2 falsche Karten vom vorherigen Zug offen.
  // Klick versteckt diese beiden und deckt die neue auf.
  if (currentlyFlipped.length === 2) {
      board[currentlyFlipped[0].i].state = "hidden";
      board[currentlyFlipped[1].i].state = "hidden";
      board[cardIdx].state = "flipped";
      updates.board = board;
      await update(r, updates);
      return;
  }

  // FALL 2: Es ist die erste Karte in diesem Zug
  if (currentlyFlipped.length === 0) {
      board[cardIdx].state = "flipped";
      updates.board = board;
      await update(r, updates);
      return;
  }

  // FALL 3: Es ist die zweite Karte in diesem Zug -> MATCH-CHECK!
  if (currentlyFlipped.length === 1) {
      board[cardIdx].state = "flipped";
      const firstCard = currentlyFlipped[0];

      if (firstCard.id === board[cardIdx].id) {
          // 🎉 PAAR GEFUNDEN!
          board[firstCard.i].state = "matched";
          board[cardIdx].state = "matched";
          
          const newScores = { ...d.scores };
          newScores[A.user] = (newScores[A.user] || 0) + 1;
          
          updates.board = board;
          updates.scores = newScores;

          // Win Condition: Wer zuerst 5 Paare hat, gewinnt (von 9 möglichen)
          if (newScores[A.user] >= 5) {
              updates.phase = "done";
              updates.winner = A.user;
          } else {
              // Fair-Play Regel im Turnier: Auch bei einem Treffer wechselt der Zug!
              updates.turn = A.user === m.p1 ? m.p2 : m.p1;
          }
          
          await update(r, updates);
          if (updates.phase === "done") {
              setTimeout(() => advanceTournament(idx, A.user), 2500);
          }
      } else {
          // ❌ KEIN PAAR
          updates.board = board;
          updates.turn = A.user === m.p1 ? m.p2 : m.p1;
          await update(r, updates);
      }
  }
}

function renderMemory(t, idx, m, bh) {
  const body = $("officialBody");
  const md = (t.memory && t.memory[idx]);
  
  if (!md) {
    body.innerHTML = `<div class="q-big">🧠 ${m.p1} vs ${m.p2}</div>${A.isHost ? '<button class="btn-orange" id="memInit">Match starten</button>' : '<div class="sub">Warte auf Host...</div>'}${bh}`;
    const btn = $("memInit"); if (btn) btn.onclick = () => initMemory(idx, m);
    return;
  }
  
  const isPlayer = A.user === m.p1 || A.user === m.p2;
  const score1 = (md.scores || {})[m.p1] || 0;
  const score2 = (md.scores || {})[m.p2] || 0;

  let html = `<div class="q-big">🧠 ${m.p1} vs ${m.p2}</div>`;
  
  // Scoreboard
  html += `<div class="card" style="background:rgba(155,89,182,0.1); border:1px solid var(--purple); margin-bottom:15px;">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 10px;">
      <div style="text-align:left; flex:1;">
        <div style="font-size:0.7rem; opacity:0.6;">Spieler 1</div>
        <b style="${A.user === m.p1 ? 'color:var(--gold)' : ''}">${m.p1}</b>
      </div>
      <div style="font-size:1.8rem; font-weight:900; padding:0 15px; letter-spacing:4px; color:var(--purple);">${score1}:${score2}</div>
      <div style="text-align:right; flex:1;">
        <div style="font-size:0.7rem; opacity:0.6;">Spieler 2</div>
        <b style="${A.user === m.p2 ? 'color:var(--gold)' : ''}">${m.p2}</b>
      </div>
    </div>
    <div style="text-align:center; font-size:0.7rem; opacity:0.7; padding-bottom:5px; border-top:1px solid rgba(155,89,182,0.2);">
      Finde 5 Paare zum Sieg!
    </div>
  </div>`;

  if (md.phase === "done") {
    html += `<div class="flash" style="background:rgba(46,204,113,0.2); border-left:4px solid var(--green);">
      <div style="font-size:1.2rem; text-align:center;">🏆 <b>${md.winner}</b> gewinnt!</div>
    </div>`;
    if (A.isHost) html += `<button class="btn-green" id="memNext" style="margin-top:10px;">Nächstes Match</button>`;
  } else {
    // Turn Indicator
    html += `<div class="flash ${md.turn === A.user ? 'gold' : ''}" style="text-align:center;">
      ${md.turn === A.user ? '<b>DU BIST DRAN!</b> Karte wählen...' : 'Warten auf ' + md.turn + '...'}
    </div>`;
  }

  // Memory Grid (3 Spalten, 6 Reihen - Perfekt fürs Handy)
  html += `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:20px 0;">`;
  
  (md.board || []).forEach((card, i) => {
    let bg = "var(--card2)";
    let border = "2px solid #444";
    let content = `<span style="font-size:1.5rem; opacity:0.3;">🍻</span>`;
    let cursor = (md.turn === A.user && md.phase === "play" && isPlayer && card.state === "hidden") ? "pointer" : "default";

    if (card.state !== "hidden") {
        const bierInfo = BIER_MAP[card.id];
        content = `<div style="font-size:1.8rem;">${bierInfo.emoji}</div><div style="font-size:0.55rem; line-height:1; margin-top:4px;">${bierInfo.name}</div>`;
        bg = "var(--card)";
    }
    
    if (card.state === "flipped") {
        border = "2px solid var(--gold)";
    } else if (card.state === "matched") {
        border = "2px solid var(--green)";
        bg = "rgba(46,204,113,0.15)";
    }

    html += `<div style="aspect-ratio:1; background:${bg}; border:${border}; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:${cursor}; text-align:center; padding:2px; transition:all 0.3s;" onclick="window.memClick(${i})">${content}</div>`;
  });

  html += `</div>`;
  body.innerHTML = html + bh;

  window.memClick = (i) => memFlip(idx, i, m);
  const mn = $("memNext"); if (mn) mn.onclick = () => advanceTournament(idx, md.winner);
}

async function initBattleship(idx,m){
  if(!A.isHost) return;
  // Initialisiere ALLE laufenden Matches der aktuellen Runde gleichzeitig (parallel mode)
  const t=(await get(ref(db,`rooms/${A.room}/tournament`))).val();
  if(!t) return;
  const myRound=t.matches[idx].round;
  const updates={};
  t.matches.forEach((mt,i)=>{
    if(mt.round===myRound && !mt.winner && !mt.bye && mt.p1 && mt.p2){
      const existing=t.battleship&&t.battleship[i];
      if(!existing){
        updates[i]={
          boards:{[mt.p1]:placeShipsRandom(),[mt.p2]:placeShipsRandom()},
          turn:mt.p1, phase:"play", startedAt:Date.now()
        };
      }
    }
  });
  await update(ref(db,`rooms/${A.room}/tournament/battleship`),updates);
  toast(`${Object.keys(updates).length} Match(es) gestartet`);
}
async function bsFire(idx,target,cellIdx){
  const r=ref(db,`rooms/${A.room}/tournament/battleship/${idx}`);
  const d=(await get(r)).val(); if(!d||d.phase!=="play"||d.turn!==A.user) return;
  const board=d.boards[target]; if(!board) return;
  if((board.shotsAt||[]).includes(cellIdx)) return;
  board.shotsAt=[...(board.shotsAt||[]),cellIdx];
  let hitShip=-1;
  board.ships.forEach((s,si)=>{if(s.cells.includes(cellIdx)) hitShip=si});
  if(hitShip>=0) board.ships[hitShip].hits=[...(board.ships[hitShip].hits||[]),cellIdx];
  const allSunk=board.ships.every(s=>s.cells.every(c=>(s.hits||[]).includes(c)));
  const updates={[`boards/${target}`]:board};
  if(allSunk){ updates.phase="done"; updates.winner=A.user; }
  else if(hitShip<0) updates.turn=target;
  await update(r,updates);
  if(allSunk) setTimeout(()=>advanceTournament(idx,A.user),3000);
}
function renderBattleship(t,idx,m,bh){
  const body=$("officialBody");
  const md=(t.battleship&&t.battleship[idx]);
  if(!md){
    body.innerHTML=`<div class="q-big">⚓ ${m.p1} vs ${m.p2}</div>${A.isHost?'<button class="btn-orange" id="bsInit">Match starten</button>':'<div class="sub">Warte auf Host...</div>'}${bh}`;
    const bi=$("bsInit"); if(bi) bi.onclick=()=>initBattleship(idx,m);
    return;
  }
  const isP1=A.user===m.p1, isP2=A.user===m.p2, isPlayer=isP1||isP2;
  const me=isP1?m.p1:(isP2?m.p2:null);
  const opp=isP1?m.p2:(isP2?m.p1:null);
  let html=`<div class="q-big">⚓ ${m.p1} vs ${m.p2}</div>`;
  if(md.phase==="done"){
    html+=`<div class="flash">🏆 ${md.winner} gewinnt!</div>`;
    if(A.isHost) html+=`<button class="btn-green" id="bsNext">Naechstes Match</button>`;
  } //else html+=`<div class="sub" style="text-align:center">Am Zug: <b>${md.turn}</b></div>`;

  if(isPlayer){
    html+='<div class="bs-label">Deine Schiffe:</div><div class="bs-grid">';
    const myB=md.boards[me];
    const myShipsC={}; myB.ships.forEach((s,si)=>s.cells.forEach(c=>myShipsC[c]=si));
    for(let i=0;i<BS_SIZE*BS_SIZE;i++){
      const isShip=myShipsC[i]!==undefined;
      const wasShot=(myB.shotsAt||[]).includes(i);
      let cls="bs-cell";
      if(isShip&&!wasShot) cls+=" ship";
      else if(isShip&&wasShot){
        const sh=myB.ships[myShipsC[i]];
        cls+=sh.cells.every(c=>(sh.hits||[]).includes(c))?" sunk":" hit";
      } else if(wasShot) cls+=" miss";
      html+=`<div class="${cls}"></div>`;
    } html+='</div>';
    if (md.phase === "play") {
        html += `<div class="flash ${md.turn === A.user ? 'gold' : ''}" style="text-align:center; margin:15px 0 5px 0; padding:8px;">Am Zug: <b>${md.turn}</b></div>`;
    }
    html+='</div><div class="bs-label">Gegner-Feld:</div><div class="bs-grid" id="bsOpp">';
    const oppB=md.boards[opp];
    const myTurn=md.turn===me&&md.phase==="play";
    const oppShipsC={}; oppB.ships.forEach((s,si)=>s.cells.forEach(c=>oppShipsC[c]=si));
    for(let i=0;i<BS_SIZE*BS_SIZE;i++){
      const wasShot=(oppB.shotsAt||[]).includes(i);
      const isShip=oppShipsC[i]!==undefined;
      let cls="bs-cell";
      if(wasShot&&isShip){
        const sh=oppB.ships[oppShipsC[i]];
        cls+=sh.cells.every(c=>(sh.hits||[]).includes(c))?" sunk":" hit";
      } else if(wasShot) cls+=" miss";
      if(!myTurn||wasShot) cls+=" disabled";
      html+=`<div class="${cls}" data-bs="${i}"></div>`;
    }
    html+='</div>';
  } else {
    // Zuschauer-Modus: zeige beide Boards in klein, ohne Schiffe zu verraten
    html+='<div class="bs-label">Zuschauer-Modus:</div>';
    [m.p1,m.p2].forEach(p=>{
      const b=md.boards[p]; if(!b) return;
      html+=`<div class="bs-label" style="margin-top:8px"><b>${p}</b></div><div class="bs-grid">`;
      const sc={};
      b.ships.forEach((s,si)=>s.cells.forEach(c=>sc[c]=si));
      for(let i=0;i<BS_SIZE*BS_SIZE;i++){
        const wasShot=(b.shotsAt||[]).includes(i);
        let cls="bs-cell";
        if(wasShot && sc[i]!==undefined){
          const sh=b.ships[sc[i]];
          cls+=sh.cells.every(c=>(sh.hits||[]).includes(c))?" sunk":" hit";
        } else if(wasShot) cls+=" miss";
        // Schiffe NICHT verraten
        html+=`<div class="${cls}"></div>`;
      }
      html+='</div>';
    });
  }

  html+=bh;
  body.innerHTML=html;
  document.querySelectorAll("#bsOpp .bs-cell[data-bs]").forEach(c=>{
    if(c.classList.contains("disabled")) return;
    c.onclick=()=>bsFire(idx,opp,parseInt(c.dataset.bs));
  });
  const bn=$("bsNext"); if(bn) bn.onclick=()=>advanceTournament(idx,md.winner);
}

// === TIC-TAC-TOE mit 3-Stein-Regel ===
async function initTTT(idx,m){
  if(!A.isHost) return;
  const t=(await get(ref(db,`rooms/${A.room}/tournament`))).val();
  if(!t) return;
  const myRound=t.matches[idx].round;
  const updates={};
  t.matches.forEach((mt,i)=>{
    if(mt.round===myRound && !mt.winner && !mt.bye && mt.p1 && mt.p2){
      const existing=t.tictactoe&&t.tictactoe[i];
      if(!existing){
        // In initTTT suchen und diese Zeile anpassen:
        updates[i] = {
          board: [0, 0, 0, 0, 0, 0, 0, 0, 0], // Benutze Nullen statt null
          turn: mt.p1,
          phase: "play",
          moveCounter: 0,
          startedAt: Date.now()
        };
      }
    }
  });
  await update(ref(db,`rooms/${A.room}/tournament/tictactoe`),updates);
  toast(`${Object.keys(updates).length} Match(es) gestartet`);
}

async function tttMove(idx, cellIdx, m) {
  const r = ref(db, `rooms/${A.room}/tournament/tictactoe/${idx}`);
  const d = (await get(r)).val();
  if (!d || d.phase !== "play" || d.turn !== A.user) return;
  
  // Sicherer Check, falls das Array Lücken hat
  const currentDbBoard = d.board || [];
  if (currentDbBoard[cellIdx] !== 0 && currentDbBoard[cellIdx] !== undefined) return;

  // --- KUGELSICHERES ARRAY BAUEN ---
  const board = [];
  for (let i = 0; i < 9; i++) {
    const cell = currentDbBoard[i] !== undefined ? currentDbBoard[i] : 0;
    board.push(cell === null ? 0 : cell); 
  }
  
  // Hier wird moveCounter exakt EINMAL deklariert
  const moveCounter = (d.moveCounter || 0) + 1;

  // Eigene Steine finden und nach Alter (seq) sortieren
  const myStones = [];
  board.forEach((cell, i) => {
    if (cell && typeof cell === 'object' && cell.p === A.user) {
      myStones.push({ i, seq: cell.seq });
    }
  });
  myStones.sort((a, b) => a.seq - b.seq);

  // Wenn man bereits 3 Steine hat, wird der älteste entfernt
  if (myStones.length >= 3) {
    board[myStones[0].i] = 0;
  }

  // Neuen Stein setzen
  board[cellIdx] = { p: A.user, seq: moveCounter };

  // Gewinnprüfung (3 in einer Reihe)
  const checkWin = (b, p) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return lines.some(ln => ln.every(i => b[i] && b[i].p === p));
  };

  const isWin = checkWin(board, A.user);
  const updates = { board, moveCounter };

  if (isWin) {
    updates.phase = "done";
    updates.winner = A.user;
    await update(r, updates);
    setTimeout(() => advanceTournament(idx, A.user), 2000);
  } else if (moveCounter >= 20) {
    // Unentschieden-Logik nach 20 Zügen
    const winner = Math.random() > 0.5 ? m.p1 : m.p2;
    updates.phase = "done";
    updates.winner = winner;
    updates.isDraw = true; // Markiert es als Unentschieden (keine Punkte)
    await update(r, updates);
    
    setTimeout(async () => {
        const tSnap = await get(ref(db, `rooms/${A.room}/tournament`));
        const t = tSnap.val();
        const updatedMatches = [...t.matches];
        updatedMatches[idx].winner = winner;
        await update(ref(db, `rooms/${A.room}/tournament`), { matches: updatedMatches });
    }, 2000);
  } else {
    // Nächster Spieler ist dran
    updates.turn = A.user === m.p1 ? m.p2 : m.p1;
    await update(r, updates);
  }
}

function renderTicTacToe(t, idx, m, bh) {
  const body = $("officialBody");
  const md = (t.tictactoe && t.tictactoe[idx]);

  if (!md || !md.board) {
    body.innerHTML = `<div class="q-big">⭕ ${m.p1} vs ${m.p2}</div>${A.isHost ? '<button class="btn-orange" id="tttInit">Match starten</button>' : '<div class="sub">Warte auf Host...</div>'}${bh}`;
    const ti = $("tttInit"); if (ti) ti.onclick = () => initTTT(idx, m);
    return;
  }

  const isPlayer = A.user === m.p1 || A.user === m.p2;
  let html = `<div class="q-big">${m.p1} vs ${m.p2}</div>`;
  html += `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:20px auto; max-width:300px;">`;

  // --- IMMER EXAKT 9 BOXEN RENDERN ---
  for (let i = 0; i < 9; i++) {
    const cell = (md.board && md.board[i]) ? md.board[i] : 0;
    const isEmpty = !cell || cell === 0;
    const isMyTurn = md.turn === A.user && md.phase === "play" && isPlayer && isEmpty;
    
    // Optik der Zelle
    let style = `aspect-ratio:1; background:var(--card2); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; border:2px solid #444; transition: all 0.3s;`;
    if (isMyTurn) style += `cursor:pointer; border-color:var(--gold);`;

    let content = "";
    if (!isEmpty) {
        const isP1 = cell.p === m.p1;
        content = isP1 ? "✕" : "◯";
        
        // Finde heraus, ob dieser Stein der älteste des jeweiligen Spielers ist
        const playerStones = [];
        for (let j=0; j<9; j++) {
            const c = md.board && md.board[j];
            if (c && c.p === cell.p) playerStones.push({...c, index: j});
        }
        playerStones.sort((a, b) => a.seq - b.seq);
        
        // NEU: Wenn der Spieler 4 Steine hat, markiere den ältesten (index 0) als blass...
        // ABER NUR, wenn es der Stein des GEGNERS ist!
        if (playerStones.length >= 3 && playerStones[0].seq === cell.seq && cell.p !== A.user) {
            style += "opacity: 0.3; transform: scale(0.9);";
        }
        style += isP1 ? "color:var(--gold);" : "color:var(--blue);";
    }

    html += `<div style="${style}" onclick="window.tttClick(${i})">${content}</div>`;
  }

  html += `</div>`;
  
  if (md.phase === "play") {
    html += `<div class="flash ${md.turn === A.user ? 'gold' : ''}">${md.turn === A.user ? 'DU BIST DRAN!' : 'Warten auf ' + md.turn}</div>`;
    html += `<div class="sub">Zug: ${md.moveCounter} / 20</div>`;
  } else {
    html += `<div class="flash gold">SIEG: ${md.winner} ${md.isDraw ? '(AUSGELOST)' : ''}</div>`;
  }

  body.innerHTML = html + bh;
  
  // Klick-Handler global verfügbar machen für das onclick im String
  window.tttClick = (i) => tttMove(idx, i, m);
}

// === BIER-DUELL ===
async function initBierDuel(idx,m){
  if(!A.isHost) return;
  const t=(await get(ref(db,`rooms/${A.room}/tournament`))).val();
  if(!t) return;
  const myRound=t.matches[idx].round;
  const updates={};
  t.matches.forEach((mt,i)=>{
    if(mt.round===myRound && !mt.winner && !mt.bye && mt.p1 && mt.p2){
      const existing=t.bierduel&&t.bierduel[i];
      if(!existing){
        updates[i]={phase:"play", round:1, scores:{[mt.p1]:0,[mt.p2]:0}, used:{[mt.p1]:[],[mt.p2]:[]}, picks:{}, history:[], startedAt:Date.now()};
      }
    }
  });
  await update(ref(db,`rooms/${A.room}/tournament/bierduel`),updates);
  toast(`${Object.keys(updates).length} Match(es) gestartet`);
}

async function bdPick(idx, bierId) {
  const r = ref(db, `rooms/${A.room}/tournament/bierduel/${idx}`);
  const d = (await get(r)).val(); 
  if (!d || d.phase !== "play") return;

  // SICHERER ZUGRIFF: Falls Firebase 'picks' oder 'used' gelöscht hat,
  // tun wir so, als wären es leere Objekte/Arrays.
  const picks = d.picks || {};
  const used = d.used || {};
  const myUsed = used[A.user] || [];

  // Abbrechen, wenn schon gewählt oder Bier schon verbraucht
  if (picks[A.user]) return;
  if (myUsed.includes(bierId)) return;

  await set(ref(db, `rooms/${A.room}/tournament/bierduel/${idx}/picks/${A.user}`), bierId);
  
  // Pruefen ob beide gewaehlt haben
  const d2 = (await get(r)).val();
  const currentPicks = d2.picks || {};
  if (Object.keys(currentPicks).length >= 2) {
      await bdResolveRound(idx);
  }
}

async function bdResolveRound(idx) {
  const r = ref(db, `rooms/${A.room}/tournament/bierduel/${idx}`);
  const d = (await get(r)).val(); 
  if (!d || d.phase !== "play") return;
  
  const matchRef = (await get(ref(db, `rooms/${A.room}/tournament/matches/${idx}`))).val();
  if (!matchRef) return;
  const p1 = matchRef.p1, p2 = matchRef.p2;
  
  const picks = d.picks || {};
  const pick1 = picks[p1], pick2 = picks[p2];
  if (!pick1 || !pick2) return;
  
  const winningBeer = bierWinner(pick1, pick2);
  let roundWinner = null;
  if (winningBeer === pick1) roundWinner = p1;
  else if (winningBeer === pick2) roundWinner = p2;
  
  const newScores = { ...(d.scores || {}) };
  if (roundWinner) newScores[roundWinner] = (newScores[roundWinner] || 0) + 1;
  
  const newUsed = { ...(d.used || {}) };
  newUsed[p1] = [...(newUsed[p1] || []), pick1];
  newUsed[p2] = [...(newUsed[p2] || []), pick2];
  
  const currentRound = d.round || 1;
  const newHistory = [...(d.history || []), {
      round: currentRound, 
      p1, p2, pick1, pick2, winner: roundWinner
  }];
  
  let matchWinner = null;
  let isDraw = false;

  // --- REGEL: Zuerst 3 Punkte (Max 8 Runden, da 8 Biere) ---
  if (newScores[p1] >= 3) {
      matchWinner = p1;
  } else if (newScores[p2] >= 3) {
      matchWinner = p2;
  } else if (currentRound >= 10) {
      // Nach 8 Runden sind alle Buttons aufgebraucht!
      if (newScores[p1] > newScores[p2]) matchWinner = p1;
      else if (newScores[p2] > newScores[p1]) matchWinner = p2;
      else {
          // Gleichstand nach 8 Runden -> Losentscheid
          matchWinner = Math.random() > 0.5 ? p1 : p2;
          isDraw = true; 
      }
  }
  
  const updates = {
    scores: newScores, 
    used: newUsed, 
    history: newHistory,
    picks: null,
    round: currentRound + 1
  };
  
  if (matchWinner) { 
      updates.phase = "done"; 
      updates.winner = matchWinner;
      updates.isDraw = isDraw; 
  }
  
  await update(r, updates);

  if (matchWinner) {
      if (isDraw) {
          // Keine Punkte vergeben bei Losentscheid
          await update(ref(db, `rooms/${A.room}/tournament/matches/${idx}`), { pointsAwarded: true });
      }
      setTimeout(() => advanceTournament(idx, matchWinner), 3500);
  }
}

function renderBierDuel(t, idx, m, bh) {
  const body = $("officialBody");
  const md = (t.bierduel && t.bierduel[idx]);
  
  if (!md) {
    body.innerHTML = `<div class="q-big">🍺 ${m.p1} vs ${m.p2}</div>${A.isHost ? '<button class="btn-orange" id="bdInit">Match starten</button>' : '<div class="sub">Warte auf Host...</div>'}${bh}`;
    const bi = $("bdInit"); if (bi) bi.onclick = () => initBierDuel(idx, m);
    return;
  }
  
  const isPlayer = A.user === m.p1 || A.user === m.p2;
  const opp = A.user === m.p1 ? m.p2 : m.p1;
  const myPick = (md.picks || {})[A.user];
  const oppPicked = !!(md.picks || {})[opp];
  const used = (md.used || {})[A.user] || [];
  const score1 = (md.scores || {})[m.p1] || 0;
  const score2 = (md.scores || {})[m.p2] || 0;

  let html = `<div class="q-big">🍺 ${m.p1} vs ${m.p2}</div>`;
  
  // Schöner Score-Header
  html += `<div class="card" style="background:rgba(255,204,0,0.1); border:1px solid var(--gold); margin-bottom:15px;">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 10px;">
      <div style="text-align:left; flex:1;">
        <div style="font-size:0.7rem; opacity:0.6;">Spieler 1</div>
        <b style="${A.user === m.p1 ? 'color:var(--gold)' : ''}">${m.p1}</b>
      </div>
      <div style="font-size:1.8rem; font-weight:900; padding:0 15px; letter-spacing:4px;">${score1}:${score2}</div>
      <div style="text-align:right; flex:1;">
        <div style="font-size:0.7rem; opacity:0.6;">Spieler 2</div>
        <b style="${A.user === m.p2 ? 'color:var(--gold)' : ''}">${m.p2}</b>
      </div>
    </div>
    <div style="text-align:center; font-size:0.7rem; opacity:0.7; padding-bottom:5px; border-top:1px solid rgba(255,204,0,0.2);">
      Zuerst 3 Pkt (Max. 10 Runden) · <b>Runde ${Math.min(10, md.round || 1)}</b>
    </div>
  </div>`;

  if (md.phase === "done") {
    const drawText = md.isDraw ? "<br><small style='color:var(--orange)'>⚠️ Losentscheid nach 8 Runden</small>" : "";
    html += `<div class="flash gold" style="text-align:center;">
      <div style="font-size:1.2rem;">🏆 <b>${md.winner}</b> gewinnt das Match!</div>
      ${drawText}
    </div>`;
    
    if (md.history && md.history.length) {
      html += '<h3>Verlauf:</h3><div style="max-height:150px; overflow-y:auto; font-size:0.8rem;">';
      md.history.forEach(h => {
        const b1 = BIER_MAP[h.pick1], b2 = BIER_MAP[h.pick2];
        const winStr = h.winner ? `<span style="color:var(--gold)">🏆 ${h.winner}</span>` : `🍻 Unentschieden`;
        html += `<div class="result-row">
          <span>R${h.round}: ${b1.emoji} vs ${b2.emoji}</span>
          ${winStr}
        </div>`;
      });
      html += '</div>';
    }
    if (A.isHost) html += `<button class="btn-green" id="bdNext" style="margin-top:10px;">Nächstes Match</button>`;
    
  } else if (isPlayer) {
    if (myPick) {
      const mb = BIER_MAP[myPick];
      html += `<div class="flash info">✅ Gesetzt: ${mb.emoji} <b>${mb.name}</b><br><small>Warte auf ${opp}...</small></div>`;
    } else {
      html += `<h3 style="margin-top:0;">Wähle dein Getränk:</h3><div class="grid2">`;
      BIERE.forEach(b => {
        const isUsed = used.includes(b.id);
        
        // Custom Text für unsere Specials
        let beatsStr = "";
        if (b.id === "schnaps") beatsStr = "ALLE Biere 😱";
        else if (b.id === "wasser") beatsStr = "NUR Schnaps";
        else {
            const beatenNames = b.beats.map(targetId => BIER_MAP[targetId].name);
            beatsStr = beatenNames.join(", ");
        }

        // Special Styling für Schnaps & Wasser
        let btnColor = "btn-gold";
        if (b.id === "schnaps") btnColor = "btn-red";
        if (b.id === "wasser") btnColor = "btn-blue";
        if (isUsed) btnColor = "btn-ghost";

        html += `<button class="${btnColor}" ${isUsed ? 'disabled' : ''} data-bier="${b.id}" style="text-align:left; padding:8px; height:auto;">
          <div style="font-size:1rem;">${b.emoji} ${b.name}</div>
          <div style="font-size:0.6rem; opacity:0.8;">Schlägt: ${beatsStr}</div>
        </button>`;
      });
      html += `</div>`;
    }
  } else {
    const p1P = !!(md.picks || {})[m.p1];
    const p2P = !!(md.picks || {})[m.p2];
    html += `<div class="flash">
      <b>Status:</b><br>
      ${m.p1}: ${p1P ? '✅ bereit' : '⏳ wählt...'}<br>
      ${m.p2}: ${p2P ? '✅ bereit' : '⏳ wählt...'}
    </div>`;
  }

  if (md.history && md.history.length && md.phase !== "done") {
    const last = md.history[md.history.length - 1];
    const b1 = BIER_MAP[last.pick1], b2 = BIER_MAP[last.pick2];
    const winStr = last.winner ? ` → Punkt für <b>${last.winner}</b>` : ` → 🍻 Unentschieden`;
    html += `<hr><div class="sub">Letzte Runde: ${last.p1} (${b1.emoji}) vs (${b2.emoji}) ${last.p2}${winStr}</div>`;
  }

  body.innerHTML = html + bh;
  
  document.querySelectorAll("[data-bier]").forEach(b => b.onclick = () => bdPick(idx, b.dataset.bier));
  const bn = $("bdNext"); if (bn) bn.onclick = () => advanceTournament(idx, md.winner);
}

console.log("✅ tournament.js loaded");
