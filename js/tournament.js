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
  if(t&&t.active){ panel.classList.remove("hidden"); renderTournament(t); return; }
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
  const matches=[];
  let r1=[];
  for(let i=0;i<shuffled.length;i+=2){
    if(i+1<shuffled.length) r1.push({round:1,p1:shuffled[i],p2:shuffled[i+1],winner:null});
    else r1.push({round:1,p1:shuffled[i],p2:null,winner:shuffled[i],bye:true});
  }
  matches.push(...r1);
  let prevCount=r1.length, round=2;
  while(prevCount>1){
    const cnt=Math.ceil(prevCount/2);
    for(let i=0;i<cnt;i++) matches.push({round,p1:null,p2:null,winner:null});
    prevCount=cnt; round++;
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

async function advanceTournament(idx,winner){
  const t=(await get(ref(db,`rooms/${A.room}/tournament`))).val();
  if(!t) return;
  const updated=[...t.matches];
  if(!updated[idx].winner) updated[idx].winner=winner;
  // Position in runde ermitteln fuer promotion
  const myRound=updated[idx].round;
  const sameRound=updated.map((m,i)=>({m,i})).filter(x=>x.m.round===myRound);
  const posInRound=sameRound.findIndex(x=>x.i===idx);
  const nextPosInRound=Math.floor(posInRound/2);
  const nextRoundMatches=updated.map((m,i)=>({m,i})).filter(x=>x.m.round===myRound+1);
  if(nextRoundMatches[nextPosInRound]){
    const nextMatch=nextRoundMatches[nextPosInRound].m;
    if(posInRound%2===0) nextMatch.p1=updated[idx].winner;
    else nextMatch.p2=updated[idx].winner;
  }
  await update(ref(db,`rooms/${A.room}/tournament`),{matches:updated,currentMatchIdx:findFirstUnplayed(updated)});
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
  const idx=t.currentMatchIdx;
  const bh=bracketHtml(t);

  if(idx<0){
    const winner=t.matches[t.matches.length-1].winner;
    let html=`<div class="q-big">🏆 Sieger: ${winner}</div>${bh}`;
    if(A.isHost){
      html+='<hr><button class="btn-green" id="rewardScore">+5 Pkt</button><button class="btn-blue" id="rewardVote">+1 Bonus-Stimme</button><button class="btn-ghost" id="closeTour">Schliessen</button>';
    }
    body.innerHTML=html;
    const rs=$("rewardScore"); if(rs) rs.onclick=async()=>{await awardScore(winner,5);toast(`+5 Pkt fuer ${winner}`);remove(ref(db,`rooms/${A.room}/tournament`));};
    const rv=$("rewardVote"); if(rv) rv.onclick=async()=>{const r=ref(db,`rooms/${A.room}/players/${winner}/bonusVotes`);const c=(await get(r)).val()||0;await set(r,c+1);toast("Bonus-Stimme!");remove(ref(db,`rooms/${A.room}/tournament`));};
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
  if(t.gameType==="battleship") return renderBattleship(t,idx,m,bh);
  if(t.gameType==="tictactoe") return renderTicTacToe(t,idx,m,bh);
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
  for(const s of BS_SHIPS){
    let placed=false,tries=0;
    while(!placed&&tries<200){
      tries++;
      const horiz=Math.random()<0.5;
      const r=Math.floor(Math.random()*BS_SIZE), c=Math.floor(Math.random()*BS_SIZE);
      const cells=[]; let ok=true;
      for(let i=0;i<s.len;i++){
        const rr=horiz?r:r+i, cc=horiz?c+i:c;
        if(rr>=BS_SIZE||cc>=BS_SIZE){ok=false;break}
        const ix=rr*BS_SIZE+cc;
        if(grid[ix]!==null){ok=false;break}
        cells.push(ix);
      }
      if(ok){ cells.forEach(ix=>grid[ix]=ships.length); ships.push({name:s.name,cells,hits:[]}); placed=true; }
    }
  }
  return {ships,shotsAt:[]};
}

async function initBattleship(idx,m){
  if(!A.isHost) return;
  await set(ref(db,`rooms/${A.room}/tournament/battleship/${idx}`),{
    boards:{[m.p1]:placeShipsRandom(),[m.p2]:placeShipsRandom()},
    turn:m.p1, phase:"play", startedAt:Date.now()
  });
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
  } else html+='<div class="sub">Zuschauer-Modus</div>';

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
  await set(ref(db,`rooms/${A.room}/tournament/tictactoe/${idx}`),{
    board:Array(9).fill(null), // jede Zelle: null oder {p:player, seq:number}
    turn:m.p1, phase:"play", moveCounter:0, startedAt:Date.now()
  });
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
