// === official.js - Offizielle Runden mit Quiz-Multi, Duell, Gruppe ===
const A=window.App, {db,ref,set,onValue,update,get,remove,$,toast,awardScore}=A;

const QUIZ_WHO=[
  "Wer eskaliert heute als Erster?",
  "Wer hat morgen den schlimmsten Kater?",
  "Wer verschlaeft das Fruehstueck?",
  "Wer flirtet am meisten auf dem Trip?",
  "Wer bezahlt am oeftesten die Runde?",
  "Wer verliert zuerst sein Handy?",
  "Wer hat den schlimmsten Sonnenbrand?",
  "Wer rauscht als Erster ab?",
  "Wer traegt die schraegste Badehose?",
  "Wer faellt als Erster ins Wasser angezogen?",
  "Wer ist der heimliche Chef der Truppe?",
  "Wer schnarcht am lautesten?",
  "Wer verliert die Wette als Erster?",
  "Wer macht die meisten Selfies?",
  "Wer wird von Kellnerinnen am meisten angeflirtet?"
];
const QUIZ_TEXT=[
  "Was ist das Motto des Trips in 3 Woertern?",
  "Beschreibe Mallorca mit einem Emoji-Kombo",
  "Was ist der beste Drink auf der Insel?",
  "Welcher Song beschreibt diesen Trip?",
  "Worueber wurde heute am meisten gelacht?"
];
const NUM_QS_PER_DUEL=3; // Mehrere Fragen pro Duell/Gruppe

const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
  onValue(ref(db,`rooms/${A.room}/official`),snap=>{
    const newO=snap.val();
    if(newO&&newO.startedAt&&newO.startedAt!==A._lastOfficialId){
      A._lastOfficialId=newO.startedAt;
      A.switchTab("Games");
      toast("⭐ Offizielle Runde gestartet!");
    }
    if(!newO) A._lastOfficialId=null;
    A.state.official=newO;
    renderOfficial();
    updateTabPulse();
  });
  // Nur Start-Buttons binden die zu diesem Modul gehoeren
  document.querySelectorAll("[data-start]").forEach(b=>{
    const t=b.dataset.start;
    if(t.startsWith("quiz-multi-")||t.startsWith("duel-")||t==="group-estimate"){
      b.onclick=()=>startOfficial(t);
    }
  });
};

function updateTabPulse(){
  const games=document.querySelector('[data-tab="Games"]');
  const old=games.querySelector(".pulse");
  if(old) old.remove();
  if(A.state.official&&A.state.official.phase!=="done"){
    const p=document.createElement("span");
    p.className="pulse"; games.appendChild(p);
  }
}

async function startOfficial(type){
  if(!A.isHost) return;
  if(type.startsWith("quiz-multi-")){
    const total=parseInt(type.split("-")[2]);
    await remove(ref(db,`rooms/${A.room}/tournament`));
    await set(ref(db,`rooms/${A.room}/quizMulti`),{total,current:0,scores:{},startedAt:Date.now()});
    return nextQuizQuestion();
  }
  // Duell / Gruppe - startet Multi-Question-Session
  if(type==="duel-math"||type==="duel-estimate"||type==="group-estimate"){
    await remove(ref(db,`rooms/${A.room}/tournament`));
    await set(ref(db,`rooms/${A.room}/duelSession`),{
      type,total:NUM_QS_PER_DUEL,current:0,scores:{},teams:{},startedAt:Date.now()
    });
    return nextDuelQuestion();
  }
}

// === QUIZ MULTI (gemischt) ===
async function nextQuizQuestion(){
  if(!A.isHost) return;
  const qm=(await get(ref(db,`rooms/${A.room}/quizMulti`))).val();
  if(!qm) return;
  if(qm.current>=qm.total) return finalizeQuizMulti();
  const types=["quiz-who","duel-estimate"];
  if(qm.current===0||qm.current===qm.total-1) types.push("quiz-text");
  const type=types[Math.floor(Math.random()*types.length)];
  let data={type,startedAt:Date.now(),answers:{},votes:{},phase:"answer",endTime:Date.now()+30000,quizMulti:true,qNum:qm.current+1,qTotal:qm.total};
  if(type==="quiz-who") data.q=`Frage ${qm.current+1}/${qm.total}: ${QUIZ_WHO[Math.floor(Math.random()*QUIZ_WHO.length)]}`;
  else if(type==="quiz-text") data.q=`Frage ${qm.current+1}/${qm.total}: ${QUIZ_TEXT[Math.floor(Math.random()*QUIZ_TEXT.length)]}`;
  else if(type==="duel-estimate"){
    const s=(A.SCHAETZ||[])[Math.floor(Math.random()*A.SCHAETZ.length)];
    if(!s) return toast("Keine Schaetzfragen geladen!");
    data.q=`Frage ${qm.current+1}/${qm.total}: ${s.q}`; data.target=s.a;
    data.endTime=Date.now()+45000;
  }
  await update(ref(db,`rooms/${A.room}/quizMulti`),{current:qm.current+1});
  await set(ref(db,`rooms/${A.room}/official`),data);
}

async function awardQuizPoints(player,pts){
  const r=ref(db,`rooms/${A.room}/quizMulti/scores/${player}`);
  const cur=(await get(r)).val()||0;
  await set(r,cur+pts);
}

async function finalizeQuizMulti(){
  const qm=(await get(ref(db,`rooms/${A.room}/quizMulti`))).val();
  if(!qm) return;
  const scores=qm.scores||{};
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const awarded={};
  sorted.forEach(([p,s],i)=>{
    let pts=0;
    if(i===0) pts=20;
    else if(i===1) pts=12;
    else if(i===2) pts=8;
    else if(s>0) pts=3;
    if(pts>0){ awardScore(p,pts); awarded[p]=pts; }
  });
  let html='<div class="flash gold"><b>🏆 Quiz beendet!</b></div>';
  sorted.forEach(([p,s],i)=>{
    const medal=['🥇','🥈','🥉'][i]||((i+1)+'.');
    const pts=awarded[p]||0;
    html+=`<div class="result-row ${i===0?'winner':''}"><span>${medal} ${p}</span><span>${s} intern</span><strong class="plus">${pts?'+'+pts:''}</strong></div>`;
  });
  html+='<div class="sub">Quiz-Punkte umgerechnet: 20/12/8/3</div>';
  await set(ref(db,`rooms/${A.room}/official`),{type:"quiz-done",q:"Quiz Endergebnis",phase:"done",resultHtml:html,startedAt:Date.now()});
  await remove(ref(db,`rooms/${A.room}/quizMulti`));
}

// === DUEL/GROUP SESSION (mehrere Fragen) ===
async function nextDuelQuestion(){
  if(!A.isHost) return;
  const ds=(await get(ref(db,`rooms/${A.room}/duelSession`))).val();
  if(!ds) return;
  if(ds.current>=ds.total) return finalizeDuelSession();
  let q,target,endTime,qTxt;
  if(ds.type==="duel-math"){
    const a=Math.floor(Math.random()*40+10),b=Math.floor(Math.random()*20+5),op=["+","-","*"][Math.floor(Math.random()*3)];
    qTxt=`${a} ${op} ${b} = ?`;
    target=eval(`${a}${op}${b}`);
    endTime=Date.now()+25000;
  } else {
    const s=(A.SCHAETZ||[])[Math.floor(Math.random()*A.SCHAETZ.length)];
    if(!s) return toast("Keine Schaetzfragen!");
    qTxt=s.q; target=s.a; endTime=Date.now()+45000;
  }
  const data={
    type:ds.type, sessionMode:true, qNum:ds.current+1, qTotal:ds.total,
    q:`Frage ${ds.current+1}/${ds.total}: ${qTxt}`,
    target, startedAt:Date.now(), answers:{}, phase:"answer", endTime
  };
  if(ds.type==="group-estimate") data.teams=ds.teams||{};
  await update(ref(db,`rooms/${A.room}/duelSession`),{current:ds.current+1});
  await set(ref(db,`rooms/${A.room}/official`),data);
}

async function evalDuelQuestion(){
  const o=(await get(ref(db,`rooms/${A.room}/official`))).val();
  if(!o||!o.sessionMode) return;
  const ds=(await get(ref(db,`rooms/${A.room}/duelSession`))).val();
  if(!ds) return;
  const isRechnen=o.type==="duel-math";
  const answers=o.answers||{};
  // Sort: isRechnen -> exact match first, then by timestamp
  //       isSchaetzen -> smallest diff first, tie by timestamp
  const entries=Object.entries(answers).map(([p,a])=>({
    p, val:a.val, ts:a.ts,
    diff:Math.abs((a.val||0)-o.target),
    correct:Number(a.val)===Number(o.target)
  }));
  let sorted;
  if(isRechnen){
    // Nur korrekte zaehlen, sortiert nach Zeit
    sorted=entries.filter(e=>e.correct).sort((a,b)=>a.ts-b.ts);
  } else {
    // Schaetzen: naechste Antwort zuerst, bei Gleichstand Zeit
    sorted=[...entries].sort((a,b)=>a.diff-b.diff||a.ts-b.ts);
  }

  // Points per question (internal session score)
  const sessionScoreUpdate={};
  const sessionScores=ds.scores||{};
  if(o.type==="group-estimate"){
    // Team-Aggregation
    const teams={A:[],B:[]};
    for(const e of entries){
      const t=(o.teams||{})[e.p]; if(t&&teams[t]) teams[t].push(e);
    }
    const avgDiff=team=>{
      if(!team.length) return Infinity;
      const avg=team.reduce((s,e)=>s+e.val,0)/team.length;
      return Math.abs(avg-o.target);
    };
    const dA=avgDiff(teams.A), dB=avgDiff(teams.B);
    const winTeam=dA<dB?"A":(dB<dA?"B":null);
    if(winTeam){
      for(const e of teams[winTeam]){
        sessionScoreUpdate[e.p]=(sessionScores[e.p]||0)+3;
      }
    }
    for(const e of entries){
      if(!sessionScoreUpdate[e.p]) sessionScoreUpdate[e.p]=(sessionScores[e.p]||0);
    }
  } else {
    // Einzelduell: Top 1 = 3, Top 2 = 2, Top 3 = 1
    sorted.forEach((e,i)=>{
      let p=0; if(i===0) p=3; else if(i===1) p=2; else if(i===2) p=1;
      sessionScoreUpdate[e.p]=(sessionScores[e.p]||0)+p;
    });
    for(const e of entries){
      if(sessionScoreUpdate[e.p]===undefined) sessionScoreUpdate[e.p]=(sessionScores[e.p]||0);
    }
  }
  await update(ref(db,`rooms/${A.room}/duelSession/scores`),sessionScoreUpdate);
  // Store teams persistently (first question sets them)
  if(o.type==="group-estimate" && o.teams) await update(ref(db,`rooms/${A.room}/duelSession/teams`),o.teams);

  let html=`<div class="flash gold">Richtige Antwort: <b>${o.target}</b></div>`;
  sorted.forEach((e,i)=>{
    const medal=['🥇','🥈','🥉'][i]||((i+1)+'.');
    html+=`<div class="result-row ${i===0?'winner':''}"><span>${medal} ${e.p}</span><span>${e.val} (Δ ${e.diff})</span></div>`;
  });
  if(!sorted.length) html+='<div class="sub">Niemand korrekt / keine Antworten</div>';
  html+=`<hr><button class="btn-gold" id="nextDuelQ">Naechste Frage</button>`;
  await update(ref(db,`rooms/${A.room}/official`),{phase:"done",resultHtml:html});
}

async function finalizeDuelSession(){
  const ds=(await get(ref(db,`rooms/${A.room}/duelSession`))).val();
  if(!ds) return;
  const scores=ds.scores||{};
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const awarded={};
  sorted.forEach(([p,s],i)=>{
    let pts=0;
    if(i===0) pts=15;
    else if(i===1) pts=8;
    else if(i===2) pts=4;
    else if(s>0) pts=2;
    if(pts>0){ awardScore(p,pts); awarded[p]=pts; }
  });
  let html='<div class="flash gold"><b>🏆 Session beendet!</b></div>';
  sorted.forEach(([p,s],i)=>{
    const medal=['🥇','🥈','🥉'][i]||((i+1)+'.');
    html+=`<div class="result-row ${i===0?'winner':''}"><span>${medal} ${p}</span><span>${s} Pkt intern</span><strong class="plus">${awarded[p]?'+'+awarded[p]:''}</strong></div>`;
  });
  html+='<div class="sub">Session-Punkte umgerechnet: 15/8/4/2</div>';
  await set(ref(db,`rooms/${A.room}/official`),{type:"session-done",q:"Session Endergebnis",phase:"done",resultHtml:html,startedAt:Date.now()});
  await remove(ref(db,`rooms/${A.room}/duelSession`));
}

// === RENDER ===
function renderOfficial(){
  A.clearTimers();
  const o=A.state.official;
  const panel=$("officialPanel");
  if(!o){ panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");

  if(o.phase==="done"){
    $("officialBody").innerHTML=`
      <div class="q-big">${o.q||""}</div>
      ${o.resultHtml||`<div class="flash">Runde beendet</div>`}
      ${A.isHost?`
        ${o.quizMulti?'<button class="btn-gold" id="nextMultiQ">Naechste Quiz-Frage</button>':''}
        ${o.sessionMode?'<button class="btn-gold" id="nextDuelQ">Naechste Frage</button>':''}
        <button class="btn-ghost" id="closeOff">Schliessen</button>`:''}`;
    const cb=$("closeOff"); if(cb) cb.onclick=async()=>{
      await remove(ref(db,`rooms/${A.room}/official`));
      await remove(ref(db,`rooms/${A.room}/quizMulti`));
      await remove(ref(db,`rooms/${A.room}/duelSession`));
    };
    const nmq=$("nextMultiQ"); if(nmq) nmq.onclick=nextQuizQuestion;
    const ndq=$("nextDuelQ"); if(ndq) ndq.onclick=nextDuelQuestion;
    return;
  }

  const body=$("officialBody");
  let html=`<div class="q-big">${o.q}</div><div class="timer" id="offTimer"></div>`;
  const myAns=(o.answers||{})[A.user];

  if(o.phase==="answer"){
    if(myAns!==undefined){
      html+=`<div class="flash">✅ Deine Antwort: <b>${typeof myAns==='object'?myAns.val:myAns}</b></div>`;
      const answered=Object.keys(o.answers||{}).length;
      html+=`<div class="sub">${answered}/${Object.keys(A.players).length} haben geantwortet</div>`;
    } else {
      if(o.type==="quiz-who"){
        const opts=Object.keys(A.players).map(p=>`<option>${p}</option>`).join("");
        html+=`<select id="offIn"><option value="">-- waehle --</option>${opts}</select>`;
      } else if(o.type==="quiz-text"){
        html+=`<input id="offIn" placeholder="Deine Antwort...">`;
      } else {
        html+=`<input id="offIn" type="number" placeholder="Zahl...">`;
      }
      if(o.type==="group-estimate"){
        const myTeam=(o.teams||{})[A.user];
        html+=`<div class="sub">Team:</div><div class="row">
          <button class="${myTeam==='A'?'btn-green':'btn-ghost'}" data-team="A">Team A</button>
          <button class="${myTeam==='B'?'btn-green':'btn-ghost'}" data-team="B">Team B</button></div>`;
      }
      html+=`<button id="offSend" class="btn-green">Senden</button>`;
    }
  } else if(o.phase==="vote"){
    const unique=[...new Set(Object.values(o.answers||{}))];
    const myVote=(o.votes||{})[A.user];
    html+=`<h3>Bester Vorschlag?</h3>`+unique.map(t=>`<button class="${myVote===t?'btn-green':'btn-ghost'}" style="text-align:left" data-vote="${t.replace(/"/g,'&quot;')}">${t}</button>`).join("");
  }

  if(A.isHost&&o.phase!=="done"){
    html+=`<hr><h3>Host:</h3>`;
    if(o.type==="quiz-text"&&o.phase==="answer") html+=`<button class="btn-orange" id="toVote">Zu Voting wechseln</button>`;
    html+=`<button class="btn-green" id="evalNow">Jetzt auswerten</button>
      <button class="btn-red" id="cancelOff">Abbrechen</button>`;
  }
  body.innerHTML=html;

  const si=$("offSend"); if(si) si.onclick=sendAnswer;
  const ev=$("evalNow"); if(ev) ev.onclick=evalOfficial;
  const tv=$("toVote"); if(tv) tv.onclick=()=>update(ref(db,`rooms/${A.room}/official`),{phase:"vote"});
  const co=$("cancelOff"); if(co) co.onclick=async()=>{
    await remove(ref(db,`rooms/${A.room}/official`));
    await remove(ref(db,`rooms/${A.room}/quizMulti`));
    await remove(ref(db,`rooms/${A.room}/duelSession`));
  };
  document.querySelectorAll("[data-team]").forEach(b=>b.onclick=()=>set(ref(db,`rooms/${A.room}/official/teams/${A.user}`),b.dataset.team));
  document.querySelectorAll("[data-vote]").forEach(b=>b.onclick=()=>set(ref(db,`rooms/${A.room}/official/votes/${A.user}`),b.dataset.vote));

  if(o.endTime){
    const tick=()=>{
      const d=Math.max(0,Math.ceil((o.endTime-Date.now())/1000));
      const tEl=$("offTimer"); if(tEl) tEl.innerText=d>0?("⏳ "+d+"s"):"⏱️ Zeit!";
      if(d<=0) A.clearTimers();
    };
    tick();
    A.timers.push(setInterval(tick,500));
  }
}

async function sendAnswer(){
  const i=$("offIn"); if(!i) return;
  const v=i.value.trim(); if(v==="") return;
  const o=A.state.official; if(!o) return;
  let val=v;
  if(o.type.startsWith("duel")||o.type==="group-estimate") val={val:Number(v),ts:Date.now()};
  await set(ref(db,`rooms/${A.room}/official/answers/${A.user}`),val);
}

// === EVAL ===
async function evalOfficial(){
  const o=(await get(ref(db,`rooms/${A.room}/official`))).val();
  if(!o){ toast("Keine aktive Runde"); return; }
  const award=async(p,pts)=>{
    if(o.quizMulti) await awardQuizPoints(p,Math.max(1,Math.round(pts/2)));
    else await awardScore(p,pts);
  };
  // session mode = eigener Auswertungsflow (merkt sich fuer sich selbst)
  if(o.sessionMode) return evalDuelQuestion();
  let resultHtml="";

  if(o.type==="quiz-who"){
    const counts={};
    for(const who of Object.values(o.answers||{})) counts[who]=(counts[who]||0)+1;
    const max=Math.max(0,...Object.values(counts));
    const winners=Object.keys(counts).filter(k=>counts[k]===max);
    const awarded={};
    for(const [voter,who] of Object.entries(o.answers||{})){
      if(winners.includes(who)){ await award(voter,2); awarded[voter]=(awarded[voter]||0)+2; }
    }
    for(const w of winners){
      if(A.players[w]){ await award(w,1); awarded[w]=(awarded[w]||0)+1; }
    }
    let html='<div class="flash gold"><b>Ergebnis:</b></div>';
    const totalVotes=Object.values(counts).reduce((a,b)=>a+b,0)||1;
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([who,cnt])=>{
      const pct=Math.round(cnt/totalVotes*100);
      const isWin=winners.includes(who);
      html+=`<div class="result-row ${isWin?'winner':''}"><span>${isWin?'👑 ':''}${who}</span><div class="result-bar"><div class="result-bar-fill" style="width:${pct}%"></div></div><strong>${cnt}</strong></div>`;
    });
    html+='<h3>Punkte:</h3>';
    for(const [p,pts] of Object.entries(awarded)) html+=`<div class="result-row"><span>${p}</span><span class="plus">+${pts}</span></div>`;
    resultHtml=html;
  }
  else if(o.type==="quiz-text"){
    if(o.phase==="answer"){ await update(ref(db,`rooms/${A.room}/official`),{phase:"vote"}); return; }
    const counts={};
    Object.values(o.votes||{}).forEach(v=>{counts[v]=(counts[v]||0)+1});
    const max=Math.max(0,...Object.values(counts));
    const winTexts=Object.keys(counts).filter(k=>counts[k]===max);
    const awarded={};
    for(const [author,ans] of Object.entries(o.answers||{})){
      if(winTexts.includes(ans)){ await award(author,3); awarded[author]=(awarded[author]||0)+3; }
    }
    let html='<div class="flash gold"><b>Beste Antwort:</b></div>';
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([txt,cnt])=>{
      const isWin=winTexts.includes(txt);
      const author=Object.entries(o.answers||{}).find(([k,v])=>v===txt);
      html+=`<div class="result-row ${isWin?'winner':''}"><span>${isWin?'👑 ':''}"${txt}" (${author?author[0]:'?'})</span><strong>${cnt}</strong></div>`;
    });
    for(const [p,pts] of Object.entries(awarded)) html+=`<div class="result-row"><span>${p}</span><span class="plus">+${pts}</span></div>`;
    resultHtml=html;
  }
  else if(o.type==="duel-math"||o.type==="duel-estimate"){
    // Fallback fuer direkte Einzeldurchfuehrung (ohne sessionMode) - eigentlich nicht mehr erreichbar
    const entries=Object.entries(o.answers||{}).map(([p,a])=>({p,val:a.val,ts:a.ts,diff:Math.abs((a.val||0)-o.target)})).sort((a,b)=>a.diff-b.diff||a.ts-b.ts);
    if(entries.length){ await award(entries[0].p,3); if(entries[1]) await award(entries[1].p,1); }
    let html=`<div class="flash gold">Richtig: <b>${o.target}</b></div>`;
    entries.forEach((e,i)=>{html+=`<div class="result-row ${i===0?'winner':''}"><span>${['🥇','🥈','🥉'][i]||(i+1+'. ')}${e.p}</span><span>${e.val} (Δ ${e.diff})</span></div>`});
    resultHtml=html;
  }
  else if(o.type==="group-estimate"){
    const teamSums={A:{sum:0,n:0,members:[]},B:{sum:0,n:0,members:[]}};
    for(const [p,a] of Object.entries(o.answers||{})){
      const t=(o.teams||{})[p]; if(!t||!teamSums[t]) continue;
      teamSums[t].sum+=a.val; teamSums[t].n++; teamSums[t].members.push(p);
    }
    const avgA=teamSums.A.n?teamSums.A.sum/teamSums.A.n:Infinity;
    const avgB=teamSums.B.n?teamSums.B.sum/teamSums.B.n:Infinity;
    const dA=Math.abs(avgA-o.target),dB=Math.abs(avgB-o.target);
    const win=dA<dB?"A":"B";
    for(const [p,t] of Object.entries(o.teams||{})){ if(t===win) await award(p,3); }
    let html=`<div class="flash gold">Richtig: <b>${o.target}</b></div>`;
    html+=`<div class="result-row ${win==='A'?'winner':''}"><span>Team A: ${teamSums.A.members.join(", ")||'-'}</span><span>⌀ ${avgA===Infinity?'-':avgA.toFixed(1)}</span></div>`;
    html+=`<div class="result-row ${win==='B'?'winner':''}"><span>Team B: ${teamSums.B.members.join(", ")||'-'}</span><span>⌀ ${avgB===Infinity?'-':avgB.toFixed(1)}</span></div>`;
    resultHtml=html;
  }
  await update(ref(db,`rooms/${A.room}/official`),{phase:"done",resultHtml});
}

console.log("✅ official.js loaded");
