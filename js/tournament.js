// === tournament.js - Turniere: Reaktion, Schiffe, TicTacToe-3 ===
import { runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore,shuffle}=A;

const BS_SIZE=6, BS_SHIPS=[{name:"Estrella-Frachter",len:3},{name:"Mahou-Boot",len:2},{name:"Cana-Kahn",len:2},{name:"Shot-Glas",len:1}];

const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
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
  });
};

function renderOfficialPanel(){
  const setup=A.state.tournamentSetup;
  const t=A.state.tournament;
  const panel=$("officialPanel");
  // Official und quizMulti/duelSession werden von official.js gerendert
  // Hier nur wenn Turnier aktiv
  if(setup){ panel.classList.remove("hidden"); renderSetup(); return; }
  if(t&&t.active){
    panel.classList.remove("hidden");
    renderTournament(t);
    setTimeout(()=>{
      document.querySelectorAll("[data-spect]").forEach(b=>b.onclick=()=>{
        A._spectIdx=parseInt(b.dataset.spect);
        renderTournament(A.state.tournament);
      });
    },0);
    return;
  }
  // else lassen wir official.js uebernehmen
}

async function startSetup(gameType){
  if(!A.isHost) return;
  await remove(ref(db,`rooms/${A.room}/official`));
  await set(ref(db,`rooms/${A.room}/tournamentSetup`),{gameType,picks:{},startedAt:Date.now()});
  A.switchTab("Games");
}

function renderSetup(){
  const setup=A.state.tournamentSetup; if(!setup) return;
  const labels={reaction:"⚡ Reaktions-Test",battleship:"⚓ Schiffeversenken",tictactoe:"⭕ TicTacToe-3"};
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

function buildBracket(participants){
  const shuffled=shuffle(participants);
  // Round 1
  const matches=[];
  let prevRound=[];
  for(let i=0;i<shuffled.length;i+=2){
    if(i+1<shuffled.length){
      const m={round:1,p1:shuffled[i],p2:shuffled[i+1],winner:null};
      matches.push(m); prevRound.push(m);
    } else {
      const m={round:1,p1:shuffled[i],p2:null,winner:shuffled[i],bye:true};
      matches.push(m); prevRound.push(m);
    }
  }
  // Folgerunden: erstelle leere Slots, propagate Bye-Sieger sofort
  let round=2;
  while(prevRound.length>1){
    const next=[];
    for(let i=0;i<prevRound.length;i+=2){
      const m={round,p1:null,p2:null,winner:null};
      if(prevRound[i] && prevRound[i].winner) m.p1=prevRound[i].winner;
      if(prevRound[i+1] && prevRound[i+1].winner) m.p2=prevRound[i+1].winner;
      else if(!prevRound[i+1]){
        // ungerade Anzahl: kein Gegner → Bye fuer p1 falls schon gesetzt
        if(m.p1){ m.bye=true; m.winner=m.p1; }
      }
      // Wenn beide Slots gefuellt UND beide aus Bye → Match ist nicht Bye, muss gespielt werden
      // (das passiert wenn beide Vorgaenger Bye-Sieger sind)
      matches.push(m); next.push(m);
    }
    prevRound=next; round++;
  }
  return matches;
}

async function actuallyStart(){
  if(!A.isHost) return;
  const setup=(await get(ref(db,`rooms/${A.room}/tournamentSetup`))).val();
  if(!setup) return;
  const participants=Object.keys(setup.picks||{}).filter(p=>setup.picks[p]);
  if(participants.length<2) return alert("Mindestens 2 Teilnehmer waehlen!");
  const matches=buildBracket(participants);
  await remove(ref(db,`rooms/${A.room}/tournamentSetup`));
  await set(ref(db,`rooms/${A.room}/tournament`),{
    active:true, gameType:setup.gameType, matches,
    currentMatchIdx:findFirstUnplayed(matches), startedAt:Date.now()
  });
}

function findFirstUnplayed(matches){
  for(let i=0;i<matches.length;i++) if(!matches[i].winner) return i;
  return -1;
}

function findMatchForUser(t){
  // 1. Eigenes aktives Match (noch nicht gewonnen)
  for(let i=0;i<t.matches.length;i++){
    const m=t.matches[i];
    if(m.winner||m.bye) continue;
    if(m.p1===A.user||m.p2===A.user) return i;
  }
  // 2. Manuell gewaehltes Spectator-Match aus localStorage
  const spectIdx=A._spectIdx;
  if(spectIdx!==undefined && t.matches[spectIdx] && !t.matches[spectIdx].winner) return spectIdx;
  // 3. Erstes laufendes Match in der niedrigsten Runde mit beiden Spielern
  let minRound=Infinity;
  for(const m of t.matches) if(!m.winner && !m.bye && m.p1 && m.p2 && m.round<minRound) minRound=m.round;
  for(let i=0;i<t.matches.length;i++){
    const m=t.matches[i];
    if(!m.winner && !m.bye && m.round===minRound && m.p1 && m.p2) return i;
  }
  // 4. Fallback
  return findFirstUnplayed(t.matches);
}

function renderMatchPicker(t,bh){
  // Liste aller laufenden Matches in der aktuellen Runde
  let minRound=Infinity;
  for(const m of t.matches) if(!m.winner && !m.bye && m.p1 && m.p2 && m.round<minRound) minRound=m.round;
  const live=t.matches.map((m,i)=>({m,i})).filter(x=>!x.m.winner && !x.m.bye && x.m.round===minRound && x.m.p1 && x.m.p2);
  if(live.length<=1) return "";
  let html=`<hr><div class="sub">Mehrere Matches laufen parallel - waehle was du sehen willst:</div>`;
  live.forEach(({m,i})=>{
    html+=`<button class="btn-ghost btn-sm" data-spect="${i}">${m.p1} vs ${m.p2}</button> `;
  });
  return html;
}

async function advanceTournament(idx,winner){
  const t=(await get(ref(db,`rooms/${A.room}/tournament`))).val();
  if(!t) return;
  const updated=t.matches.map(m=>({...m}));
  const wasAlreadyDone=updated[idx].winner&&!updated[idx].bye;
  if(!updated[idx].winner) updated[idx].winner=winner;

  // Punkte fuer gewonnenen Match (nicht fuer Byes!) - nur einmal
  if(!wasAlreadyDone && winner && !updated[idx].bye && !updated[idx].pointsAwarded){
    await awardScore(winner,5);
    updated[idx].pointsAwarded=true;
    if(A._toastedMatchPoints!==idx){
      A._toastedMatchPoints=idx;
      toast(`+5 Pkt fuer ${winner} (Match-Sieg)`);
    }
  }

  // Promotion in naechste Runde via Position innerhalb der Runde
  const myRound=updated[idx].round;
  const sameRoundIdx=updated.map((m,i)=>m.round===myRound?i:-1).filter(i=>i>=0);
  const posInRound=sameRoundIdx.indexOf(idx);
  const nextRoundIdx=updated.map((m,i)=>m.round===myRound+1?i:-1).filter(i=>i>=0);
  const nextPos=Math.floor(posInRound/2);
  const nextMatchGlobalIdx=nextRoundIdx[nextPos];
  if(nextMatchGlobalIdx!==undefined){
    const nm=updated[nextMatchGlobalIdx];
    if(posInRound%2===0) nm.p1=updated[idx].winner;
    else nm.p2=updated[idx].winner;
    // Wenn der naechste Match jetzt nur einen Spieler hat aber kein Gegner mehr kommt → Bye
    const siblingPos=posInRound%2===0?posInRound+1:posInRound-1;
    const siblingExists=sameRoundIdx[siblingPos]!==undefined;
    if(!siblingExists && nm.p1 && !nm.p2 && !nm.winner){
      nm.bye=true; nm.winner=nm.p1;
      // Bye in Runde > 1 verdient KEINE Punkte
      // Rekursiv weiter promoten
      setTimeout(()=>advanceTournament(nextMatchGlobalIdx,nm.p1),100);
    }
  }
  await update(ref(db,`rooms/${A.room}/tournament`),{matches:updated,currentMatchIdx:findFirstUnplayed(updated)});

  // Tournament finished?
  const lastMatch=updated[updated.length-1];
  if(lastMatch.winner && findFirstUnplayed(updated)<0){
    // +5 Bonus fuer Turniersieger (zusaetzlich)
    if(!t.finalAwarded){
      await awardScore(lastMatch.winner,5);
      await update(ref(db,`rooms/${A.room}/tournament`),{finalAwarded:true});
      toast(`🏆 ${lastMatch.winner} gewinnt das Turnier! +5 Bonus`);
    }
  }
}

function bracketHtml(t){
  let html='<h3>Bracket</h3><div class="bracket">';
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
  // Reaktion bleibt seriell. Schiffe + TicTacToe parallel.
  const parallelMode=(t.gameType==="battleship"||t.gameType==="tictactoe");
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
  if(t.gameType==="reaction") return renderReaction(t,idx,m,bh);
  if(t.gameType==="battleship") return renderBattleship(t,idx,m,bh+picker);
  if(t.gameType==="tictactoe") return renderTicTacToe(t,idx,m,bh+picker);
}

// === REACTION (First-Click-Wins via Transaction) ===
function renderReaction(t,idx,m,bh){
  const body=$("officialBody");
  const md=Object.assign({phase:"waiting",ready:{}},(t.reaction&&t.reaction[idx])||{});
  const isPlayer=A.user===m.p1||A.user===m.p2;
  let html=`<div class="q-big">⚡ ${m.p1} vs ${m.p2}</div>`;

  if(md.phase==="waiting"){
    if(isPlayer){
      const rdy=md.ready&&md.ready[A.user];
      html+=`<div class="sub" style="text-align:center">Beide Spieler: Bereit druecken</div>`;
      html+=`<button class="${rdy?'btn-green':'btn-blue'}" id="reactReady">${rdy?'✓ Bereit':'Bereit'}</button>`;
    } else html+=`<div class="sub" style="text-align:center">Warte auf Spieler...</div>`;
    html+=`<div class="sub">Bereit: ${Object.keys(md.ready||{}).join(", ")||'-'}</div>`;
  } else if(md.phase==="countdown"){
    html+=`<div id="reactBox" style="background:var(--red);height:200px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:bold;cursor:pointer;margin:10px 0">WARTEN...</div>`;
  } else if(md.phase==="go"){
    html+=`<div id="reactBox" style="background:var(--green);height:200px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;cursor:pointer;color:#000;margin:10px 0">JETZT!</div>`;
  } else if(md.phase==="done"){
    html+=`<div class="flash">🏆 ${md.winner} gewinnt!</div>`;
    if(A.isHost) html+=`<button class="btn-green" id="nextMatch">Naechstes Match</button>`;
  }
  html+=bh;
  if(A.isHost&&md.phase==="waiting") html+=`<hr><button class="btn-orange" id="forceStart">Jetzt starten (bypass Bereit)</button>`;
  body.innerHTML=html;

  const rd=$("reactReady"); if(rd) rd.onclick=async()=>{
    await set(ref(db,`rooms/${A.room}/tournament/reaction/${idx}/ready/${A.user}`),true);
    const r=(await get(ref(db,`rooms/${A.room}/tournament/reaction/${idx}/ready`))).val()||{};
    if(r[m.p1]&&r[m.p2]){
      const wait=1500+Math.random()*3000;
      await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`),{phase:"countdown",goAt:Date.now()+wait});
    }
  };
  const fs=$("forceStart"); if(fs) fs.onclick=async()=>{
    const wait=1500+Math.random()*3000;
    await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`),{phase:"countdown",goAt:Date.now()+wait});
  };
  // Client-side countdown->go transition
  if(md.phase==="countdown"&&md.goAt){
    const remaining=md.goAt-Date.now();
    const flip=()=>update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`),{phase:"go",goAt:Date.now()});
    if(remaining<=0) flip();
    else A.timers.push(setTimeout(flip,remaining));
  }
  // Box click (FIRST-CLICK-WINS via transaction)
  const rb=$("reactBox"); if(rb&&isPlayer){
    rb.onclick=async()=>{
      const tap=Date.now();
      const fresh=(await get(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`))).val()||{};
      if(fresh.phase==="countdown"){
        // Zu frueh - Gegner gewinnt sofort
        const opp=A.user===m.p1?m.p2:m.p1;
        await runTransaction(ref(db,`rooms/${A.room}/tournament/reaction/${idx}/winner`),c=>c||opp);
        await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`),{phase:"done"});
        setTimeout(()=>advanceTournament(idx,opp),2000);
        return;
      }
      if(fresh.phase==="go"){
        // ATOMIC: Erster der schreibt gewinnt
        const res=await runTransaction(ref(db,`rooms/${A.room}/tournament/reaction/${idx}/winner`),c=>c||A.user);
        if(res.committed&&!res.snapshot.val()){
          // huh shouldn't happen
        }
        const winner=res.snapshot.val();
        await update(ref(db,`rooms/${A.room}/tournament/reaction/${idx}`),{phase:"done",winTime:tap-(fresh.goAt||tap)});
        setTimeout(()=>advanceTournament(idx,winner),2000);
      }
    };
  }
  const nm=$("nextMatch"); if(nm) nm.onclick=()=>advanceTournament(idx,md.winner);
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
    while(!placed&&tries<500){
      tries++;
      const horiz=Math.random()<0.5;
      const r=Math.floor(Math.random()*BS_SIZE), c=Math.floor(Math.random()*BS_SIZE);
      const cells=[]; let ok=true;
      for(let i=0;i<s.len;i++){
        const rr=horiz?r:r+i, cc=horiz?c+i:c;
        if(rr>=BS_SIZE||cc>=BS_SIZE){ok=false;break}
        // Buffer-Zone: kein Schiff darf direkt anliegen (auch diagonal)
        if(isOccupiedOrAdjacent(rr,cc)){ok=false;break}
        cells.push(rr*BS_SIZE+cc);
      }
      if(ok){ cells.forEach(ix=>grid[ix]=ships.length); ships.push({name:s.name,cells,hits:[]}); placed=true; }
    }
  }
  return {ships,shotsAt:[]};
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
  } else html+=`<div class="sub" style="text-align:center">Am Zug: <b>${md.turn}</b></div>`;

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
        updates[i]={
          board:Array(9).fill(null),
          turn:mt.p1, phase:"play", moveCounter:0, startedAt:Date.now()
        };
      }
    }
  });
  await update(ref(db,`rooms/${A.room}/tournament/tictactoe`),updates);
  toast(`${Object.keys(updates).length} Match(es) gestartet`);
}
async function tttMove(idx,cellIdx,m){
  const r=ref(db,`rooms/${A.room}/tournament/tictactoe/${idx}`);
  const d=(await get(r)).val(); if(!d||d.phase!=="play"||d.turn!==A.user) return;
  if(d.board[cellIdx]) return;
  const board=[...d.board];
  const moveCounter=(d.moveCounter||0)+1;
  // Regel: Spieler hat max. 3 Steine. Wenn ich bereits 3 Steine habe, verschwindet mein aeltester
  const myCells=board.map((c,i)=>({c,i})).filter(x=>x.c&&x.c.p===A.user).sort((a,b)=>a.c.seq-b.c.seq);
  if(myCells.length>=3){
    board[myCells[0].i]=null; // aeltesten entfernen
  }
  board[cellIdx]={p:A.user,seq:moveCounter};
  // Win-Check: Nur mit genau 3 eigenen Steinen
  const myStones=board.map((c,i)=>c&&c.p===A.user?i:null).filter(x=>x!==null);
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  let winner=null;
  if(myStones.length===3){
    for(const ln of lines){ if(ln.every(ix=>myStones.includes(ix))){ winner=A.user; break; } }
  }
  const updates={board,moveCounter};
  if(winner){ updates.phase="done"; updates.winner=winner; }
  else updates.turn=A.user===m.p1?m.p2:m.p1;
  await update(r,updates);
  if(winner) setTimeout(()=>advanceTournament(idx,winner),2500);
}
function renderTicTacToe(t,idx,m,bh){
  const body=$("officialBody");
  const md=(t.tictactoe&&t.tictactoe[idx]);
  if(!md){
    body.innerHTML=`<div class="q-big">⭕ ${m.p1} vs ${m.p2}</div>${A.isHost?'<button class="btn-orange" id="tttInit">Match starten</button>':'<div class="sub">Warte auf Host...</div>'}${bh}`;
    const ti=$("tttInit"); if(ti) ti.onclick=()=>initTTT(idx,m);
    return;
  }
  const isPlayer=A.user===m.p1||A.user===m.p2;
  let html=`<div class="q-big">⭕ ${m.p1} vs ${m.p2}</div>`;
  html+=`<div class="sub" style="text-align:center">Regel: Max. 3 Steine pro Spieler. Beim 4. Zug verschwindet dein aeltester Stein. Nur mit 3 in einer Reihe gewinnst du!</div>`;
  if(md.phase==="done"){
    html+=`<div class="flash">🏆 ${md.winner} gewinnt!</div>`;
    if(A.isHost) html+=`<button class="btn-green" id="tttNext">Naechstes Match</button>`;
  } else html+=`<div class="sub" style="text-align:center">Am Zug: <b>${md.turn}</b></div>`;

  // Board 3x3
  html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:280px;margin:15px auto">';
  md.board.forEach((cell,i)=>{
    const isMyTurn=md.turn===A.user&&md.phase==="play"&&isPlayer&&!cell;
    // Alter-Indikator: Zaehle wie alt der aelteste der betreffenden Spieler ist
    let style="aspect-ratio:1;background:var(--card2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:bold;cursor:"+(isMyTurn?"pointer":"default")+";border:2px solid #444";
    let content="";
    if(cell){
      // Zeichen: erster Spieler X, zweiter O
      const symbol=cell.p===m.p1?"✕":"◯";
      // Transparenz je nach Alter (aelteste wird blass, wenn Spieler 3 Steine hat)
      const myOwner=cell.p;
      const ownerStones=md.board.filter(x=>x&&x.p===myOwner).sort((a,b)=>a.seq-b.seq);
      const isOldest=ownerStones.length>=3&&ownerStones[0].seq===cell.seq;
      style+=isOldest?";opacity:.4":"";
      style+=cell.p===m.p1?";color:var(--gold)":";color:var(--blue)";
      content=symbol;
    }
    html+=`<div style="${style}" data-ttt="${i}">${content}</div>`;
  });
  html+='</div>';
  html+=bh;
  body.innerHTML=html;
  if(isPlayer&&md.phase==="play"){
    document.querySelectorAll("[data-ttt]").forEach(c=>{
      const i=parseInt(c.dataset.ttt);
      if(!md.board[i]&&md.turn===A.user) c.onclick=()=>tttMove(idx,i,m);
    });
  }
  const tn=$("tttNext"); if(tn) tn.onclick=()=>advanceTournament(idx,md.winner);
}

console.log("✅ tournament.js loaded");
