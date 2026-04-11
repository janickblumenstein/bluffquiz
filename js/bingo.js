// === bingo.js - Bier-Bingo ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore,shuffle}=A;

const BIER_POOL=[
  "Estrella Damm","Mahou","San Miguel","Cruzcampo","Alhambra","Rosa Blanca",
  "Moritz","Voll-Damm","Ambar","Estrella Galicia","1906 Reserva","Inedit",
  "Turia","Amstel","Heineken","Feldschloesschen","Calanda","Quoellfrisch",
  "Eichhof","Chopfab","Cardinal","Mueller Braeu","Radler","Sangria-Bier",
  "Clara","Shandy","Tinto de Verano","Cana klein","Doble gross","Cerveza sin"
];

const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
  onValue(ref(db,`rooms/${A.room}/bingo`),snap=>{
    A.state.bingo=snap.val()||{};
    renderBingo();
  });
  $("bingoGetCard").onclick=requestNewCard;
  $("bingoDealAll").onclick=dealAll;
};

function makeCard(){
  const picks=shuffle(BIER_POOL).slice(0,24);
  const grid=[];
  for(let i=0;i<25;i++){
    if(i===12) grid.push({beer:"FREI",free:true,marked:true,confirmedBy:[]});
    else grid.push({beer:picks[i>12?i-1:i],marked:false,confirmedBy:[]});
  }
  return {grid,won:false,dealt:Date.now()};
}

async function dealAll(){
  if(!A.isHost) return;
  if(!confirm("Allen neue Karten austeilen? Aktuelle Spielstaende gehen verloren.")) return;
  const cards={};
  Object.keys(A.players).forEach(p=>{cards[p]=makeCard()});
  await set(ref(db,`rooms/${A.room}/bingo/cards`),cards);
  toast("Neue Karten ausgeteilt");
}

async function requestNewCard(){
  const cards=(A.state.bingo&&A.state.bingo.cards)||{};
  if(cards[A.user]){
    if(!confirm("Aktuelle Karte und alle Bestaetigungen gehen verloren. Sicher?")) return;
  }
  await set(ref(db,`rooms/${A.room}/bingo/cards/${A.user}`),makeCard());
  toast("Neue Karte!");
}

function renderBingo(){
  const cards=(A.state.bingo&&A.state.bingo.cards)||{};
  const myCard=cards[A.user];
  const grid=$("bingoGrid"); grid.innerHTML="";
  if(!myCard){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:20px" class="sub">Noch keine Karte. Tippe unten "Neue Karte holen".</div>';
    $("bingoStatus").innerHTML="";
  } else {
    const winCells=findWinLine(myCard.grid);
    myCard.grid.forEach((cell,i)=>{
      const div=document.createElement("div");
      const conf=(cell.confirmedBy||[]).length;
      const isConfirmed=conf>=2||cell.free;
      div.className="bingo-cell"+(cell.marked?" marked":"")+(isConfirmed?" confirmed":"")+(cell.free?" free":"")+(winCells.includes(i)?" winrow":"");
      div.innerHTML=`<span>${cell.beer}</span>${conf>0&&!cell.free?`<span class="conf">${conf}/2</span>`:""}`;
      div.onclick=()=>toggleCell(i);
      grid.appendChild(div);
    });
    const marked=myCard.grid.filter(c=>c.marked).length;
    if(winCells.length&&!myCard.won){
      $("bingoStatus").innerHTML='<div class="flash">🎉 BINGO! +10 Pkt!</div>';
      update(ref(db,`rooms/${A.room}/bingo/cards/${A.user}`),{won:true});
      awardScore(A.user,10);
      toast("🎉 BINGO! +10 Pkt");
    } else if(winCells.length){
      $("bingoStatus").innerHTML='<div class="flash">🎉 BINGO! Hol dir eine neue Karte fuer noch mehr Punkte.</div>';
    } else {
      $("bingoStatus").innerHTML=`<div class="sub">${marked}/25 markiert</div>`;
    }
  }
  // confirm list
  const list=$("bingoConfirmList");
  list.innerHTML=""; let any=false;
  for(const [p,card] of Object.entries(cards)){
    if(p===A.user) continue;
    const pending=card.grid.map((c,i)=>({...c,i})).filter(c=>c.marked&&!c.free&&(c.confirmedBy||[]).length<2&&!(c.confirmedBy||[]).includes(A.user));
    if(!pending.length) continue;
    any=true;
    const div=document.createElement("div");
    div.style.cssText="background:var(--card2);padding:10px;border-radius:8px;margin:5px 0";
    div.innerHTML=`<b>${p}</b><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${pending.map(c=>`<button class="btn-green btn-sm" data-p="${p}" data-i="${c.i}">✓ ${c.beer}</button>`).join("")}</div>`;
    list.appendChild(div);
  }
  if(!any) list.innerHTML='<div class="sub">Nichts zu bestaetigen</div>';
  list.querySelectorAll("button[data-p]").forEach(b=>b.onclick=async()=>{
    const p=b.dataset.p,i=parseInt(b.dataset.i);
    const r=ref(db,`rooms/${A.room}/bingo/cards/${p}/grid/${i}/confirmedBy`);
    const cur=(await get(r)).val()||[];
    if(!cur.includes(A.user)) cur.push(A.user);
    await set(r,cur);
  });
}

async function toggleCell(i){
  const cards=(A.state.bingo&&A.state.bingo.cards)||{};
  const myCard=cards[A.user]; if(!myCard) return;
  const cell=myCard.grid[i]; if(!cell||cell.free) return;
  const r=ref(db,`rooms/${A.room}/bingo/cards/${A.user}/grid/${i}`);
  await update(r,{marked:!cell.marked,confirmedBy:cell.marked?[]:(cell.confirmedBy||[])});
}

function findWinLine(grid){
  const ok=i=>grid[i].free||(grid[i].marked&&(grid[i].confirmedBy||[]).length>=2);
  const lines=[];
  for(let r=0;r<5;r++) lines.push([0,1,2,3,4].map(c=>r*5+c));
  for(let c=0;c<5;c++) lines.push([0,1,2,3,4].map(r=>r*5+c));
  lines.push([0,6,12,18,24]);
  lines.push([4,8,12,16,20]);
  for(const ln of lines) if(ln.every(ok)) return ln;
  return [];
}

console.log("✅ bingo.js loaded");
