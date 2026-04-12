// === solo.js - Solo-Spiele (Casual-Punkte) ===
const A=window.App, {$,toast,awardScore,shuffle}=A;

const SCHAETZ_FAKTEN = [
  {q:"Einwohner Mallorca gesamt?",a:920000},
  {q:"Anzahl Strände auf Mallorca?",a:262},
  {q:"Hoechster Berg (Puig Major) in Metern?",a:1445},
  {q:"Laenge der Insel (Nord-Sued) in km?",a:100},
  {q:"Breite der Insel (Ost-West) in km?",a:75},
  {q:"Kueste Mallorcas in km?",a:550},
  {q:"Anzahl Inseln der Balearen?",a:151},
  {q:"Durchschnittliche Wassertemperatur Mai (C)?",a:19},
  {q:"Durchschnittliche Tagestemperatur Mai (C)?",a:24},
  {q:"Sonnenstunden pro Jahr Mallorca?",a:2800},

  {q:"Flughafen Palma Passagiere pro Jahr (Mio)?",a:31},
  {q:"Anzahl Fluege pro Tag Hochsaison?",a:1000},
  {q:"Einwohner Palma?",a:416000},
  {q:"Hoehe Kathedrale La Seu (m)?",a:44},
  {q:"Baujahr Beginn Kathedrale?",a:1229},

  {q:"Laenge Playa de Palma in km?",a:6},
  {q:"Anzahl Balnearios (Strandabschnitte)?",a:15},
  {q:"Liter in einem Sangria-Eimer?",a:3},
  {q:"Kalorien in 1 Liter Bier?",a:430},
  {q:"Durchschnittspreis Bier am Ballermann (Euro)?",a:5},

  {q:"Wie viele Deutsche leben auf Mallorca (ca.)?",a:20000},
  {q:"Touristen pro Jahr Mallorca (Mio)?",a:14},
  {q:"Groesse Mallorca in km²?",a:3640},
  {q:"Hoechste Klippe Mallorcas (m)?",a:384},
  {q:"Durchschnittliche Niederschlagstage pro Jahr?",a:60},

  {q:"Distanz Palma–Barcelona (km Luftlinie)?",a:230},
  {q:"Anzahl Yachthae fen auf Mallorca?",a:46},
  {q:"Anzahl Golfplaetze auf Mallorca?",a:24},
  {q:"Durchschnittliche Hotelauslastung Sommer (%)?",a:85},
  {q:"Durchschnittliche Biermenge pro Tourist/Woche (Liter, geschätzt)?",a:15}
];
// Exportiere fuer andere Module
A.SCHAETZ=SCHAETZ;

const prevReady=A.listeners.onReady;
A.listeners.onReady=()=>{
  if(prevReady) prevReady();
  document.querySelectorAll("[data-solo]").forEach(b=>{
    b.onclick=()=>startSolo(b.dataset.solo);
  });
};

function startSolo(type){
  const area=$("soloArea");
  area.classList.remove("hidden");
  if(type==="math") soloMath(area);
  else if(type==="estimate") soloEstimate(area);
  else if(type==="reaction") soloReaction(area);
}

function soloMath(area){
  let score=0,endTime=Date.now()+30000,current=null;
  const gen=()=>{
    const a=Math.floor(Math.random()*20+2),b=Math.floor(Math.random()*12+2),op=["+","-","*"][Math.floor(Math.random()*3)];
    current={q:`${a} ${op} ${b}`,a:eval(`${a}${op}${b}`)};
  };
  const render=()=>{
    const left=Math.max(0,Math.ceil((endTime-Date.now())/1000));
    if(left<=0){
      A.clearTimers();
      const casualPts=Math.max(1,Math.floor(score/2));
      awardScore(A.user,casualPts,true);
      area.innerHTML=`<h2>Ende!</h2><div class="q-big">${score} richtig</div><div class="flash">+${casualPts} Casual-Punkte</div><button class="btn-ghost" id="soloClose">Schliessen</button>`;
      $("soloClose").onclick=()=>area.classList.add("hidden");
      return;
    }
    area.innerHTML=`<h2>Kopfrechnen Sprint</h2>
      <div class="timer">⏳ ${left}s · ${score} richtig</div>
      <div class="q-big">${current.q} = ?</div>
      <input id="mathAns" type="number" autofocus>
      <button class="btn-green" id="mathOK">OK</button>`;
    const inp=$("mathAns"); inp.focus();
    const submit=()=>{
      if(Number(inp.value)===current.a) score++;
      gen(); render();
    };
    inp.onkeydown=e=>{if(e.key==="Enter")submit()};
    $("mathOK").onclick=submit;
  };
  gen(); render();
  A.clearTimers();
  A.timers.push(setInterval(()=>{
    const left=Math.max(0,Math.ceil((endTime-Date.now())/1000));
    const t=area.querySelector(".timer");
    if(t) t.innerText=`⏳ ${left}s · ${score} richtig`;
    if(left<=0) render();
  },500));
}

function soloEstimate(area){
  const qs=shuffle(SCHAETZ).slice(0,5);
  let i=0,totalDiff=0;
  const next=()=>{
    if(i>=qs.length){
      const avgPct=totalDiff/qs.length;
      const score=Math.max(1,Math.round(30-avgPct/3));
      awardScore(A.user,score,true);
      area.innerHTML=`<h2>Ende!</h2><div class="flash">Durchschnittsabweichung: ${avgPct.toFixed(0)}%<br>+${score} Casual-Punkte</div><button class="btn-ghost" id="soloClose">Schliessen</button>`;
      $("soloClose").onclick=()=>area.classList.add("hidden");
      return;
    }
    const q=qs[i];
    area.innerHTML=`<h2>Schaetzen ${i+1}/5</h2>
      <div class="q-big">${q.q}</div>
      <input id="estAns" type="number">
      <button class="btn-green" id="estOK">Antwort</button>`;
    $("estAns").focus();
    const submit=()=>{
      const v=Number($("estAns").value);
      const pct=Math.abs(v-q.a)/q.a*100;
      totalDiff+=Math.min(200,pct); i++;
      area.innerHTML=`<div class="flash">Richtig: <b>${q.a}</b> · Deine: ${v} · Abweichung: ${pct.toFixed(0)}%</div>
        <button class="btn-blue" id="estNext">Weiter</button>`;
      $("estNext").onclick=next;
    };
    $("estAns").onkeydown=e=>{if(e.key==="Enter")submit()};
    $("estOK").onclick=submit;
  };
  next();
}

function soloReaction(area){
  area.innerHTML=`<h2>Reaktions-Test</h2><div class="sub">Warte bis es gruen wird, dann sofort tippen!</div>
    <div id="reactBox" style="background:var(--red);height:200px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:bold;cursor:pointer">WARTEN...</div>`;
  const box=$("reactBox");
  const wait=1500+Math.random()*3000;
  let started=false,startTs=0;
  const to=setTimeout(()=>{
    box.style.background="var(--green)"; box.innerText="JETZT!";
    started=true; startTs=Date.now();
  },wait);
  box.onclick=()=>{
    if(!started){
      clearTimeout(to);
      area.innerHTML=`<div class="flash warn">Zu frueh! 😅</div><button class="btn-ghost" id="soloClose">Schliessen</button>`;
      $("soloClose").onclick=()=>area.classList.add("hidden");
      return;
    }
    const ms=Date.now()-startTs;
    const pts=Math.max(1,Math.round(50-ms/10));
    awardScore(A.user,pts,true);
    area.innerHTML=`<h2>${ms}ms</h2><div class="flash">+${pts} Casual-Punkte</div><button class="btn-ghost" id="soloClose">Schliessen</button>`;
    $("soloClose").onclick=()=>area.classList.add("hidden");
  };
}

console.log("✅ solo.js loaded");
