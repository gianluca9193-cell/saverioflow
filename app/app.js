// SaverIoFlow — Offline-first mini app (no external services)
// Data stays in LocalStorage.

const LS_KEY = "saverioflow_v1";

const $ = (id) => document.getElementById(id);

const state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return freshState();
    const parsed = JSON.parse(raw);
    return { ...freshState(), ...parsed };
  }catch{
    return freshState();
  }
}

function freshState(){
  return {
    goals: [],            // {id,title,cat,createdAt}
    today: { date: isoDate(), tasks: [], meta: {} },
    impactUnits: 0,
    streak: 0,
    lastCheckin: null,
    reflections: []       // {date, question, answer}
  };
}

function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  render();
}

function isoDate(d = new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

// ---------- "AI-feeling" engine (templates + rules) ----------

function genPlan({goalTitle, cat, energy, minutes, styleMode}){
  const base = normalize(goalTitle);

  const focus = pickFocus(base, cat);
  const intensity = energyToIntensity(energy, styleMode);

  // number of tasks based on budget & energy
  const taskCount = minutes <= 15 ? 2 : minutes <= 30 ? 3 : minutes <= 60 ? 4 : 5;

  const tasks = [];
  const total = minutes;
  const perTask = Math.max(5, Math.round(total / taskCount));

  for(let i=0;i<taskCount;i++){
    const t = makeTask(focus, cat, intensity, perTask, i);
    tasks.push(t);
  }

  return {
    meta: { goalTitle, cat, energy, minutes, styleMode, focus },
    tasks
  };
}

function normalize(str){
  return (str || "").trim().toLowerCase();
}

function energyToIntensity(energy, styleMode){
  let n = energy === "low" ? 0.7 : energy === "high" ? 1.15 : 1.0;
  if(styleMode === "calm") n *= 0.9;
  if(styleMode === "push") n *= 1.1;
  return n;
}

function pickFocus(base, cat){
  // Lightweight heuristic
  if(cat === "C") return "earth";
  if(cat === "B"){
    if(base.includes("frieden") || base.includes("krieg") || base.includes("peace")) return "peace";
    return "community";
  }
  // A personal
  if(base.includes("fit") || base.includes("sport") || base.includes("gesund")) return "health";
  if(base.includes("lernen") || base.includes("study") || base.includes("sprache")) return "learning";
  if(base.includes("karriere") || base.includes("job") || base.includes("bewerb")) return "career";
  if(base.includes("kreativ") || base.includes("musik") || base.includes("zeichnen")) return "creative";
  if(base.includes("mind") || base.includes("medit") || base.includes("ruhe")) return "mind";
  return "general";
}

function makeTask(focus, cat, intensity, baseMinutes, idx){
  const id = crypto.randomUUID();
  const min = clamp(Math.round(baseMinutes * intensity), 5, 60);

  const templates = getTemplates(focus, cat);
  const temp = templates[idx % templates.length];

  // Plan-B: always smaller & easier
  const planBMinutes = clamp(Math.round(min * 0.45), 3, 20);

  return {
    id,
    title: temp.title,
    minutes: min,
    planB: temp.planB,
    planBMinutes,
    done: false
  };
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function getTemplates(focus, cat){
  // You can expand this anytime (this is where "pseudo-AI" becomes powerful)
  const common = [
    { title:"5 Minuten sortieren: Was ist heute wirklich wichtig?", planB:"1 Satz: 'Heute zählt nur…'" },
    { title:"Eine kleine Handlung starten (ohne perfekt zu sein)", planB:"2 Minuten: nur anfangen" },
    { title:"Kurzer Abschluss: 1 Sache abhaken & speichern", planB:"1 Sache notieren" },
  ];

  const A = {
    health: [
      { title:"Bewegung: 12–20 Min Walk / Mobility", planB:"3 Min: Dehnen / 30 Kniebeugen" },
      { title:"Ernährung: 1 kleine Verbesserung planen", planB:"1 Wasser + 1 gesunde Snack-Option" },
      { title:"Schlaf: Abendroutine 10 Min vorbereiten", planB:"Handy 5 Min weglegen" },
    ],
    learning: [
      { title:"Lernen: 20–30 Min Fokus-Session", planB:"5 Min: nur Zusammenfassung lesen" },
      { title:"Notizen: 5 Key Points extrahieren", planB:"1 Key Point aufschreiben" },
      { title:"Üben: 10 Min aktive Wiederholung", planB:"2 Min: 3 Flashcards" },
    ],
    career: [
      { title:"Karriere: 1 konkreter nächster Schritt", planB:"2 Min: nur den Schritt definieren" },
      { title:"Bewerbung/Projekt: 25 Min Deep Work", planB:"5 Min: Dokument öffnen & 1 Satz" },
      { title:"Skill: 15 Min gezielt üben", planB:"3 Min: 1 Mini-Übung" },
    ],
    creative: [
      { title:"Kreativ: 20 Min ohne Bewertung erstellen", planB:"5 Min: nur Skizze/Loop anfangen" },
      { title:"Ideen: 10 neue Varianten sammeln", planB:"3 Varianten reichen" },
      { title:"Finish: 1 kleine Sache finalisieren", planB:"Nur aufräumen/speichern" },
    ],
    mind: [
      { title:"Atem/Stillness: 10 Min runterfahren", planB:"2 Min: 4-4-6 Atmung" },
      { title:"Mind: 1 Auslöser erkennen & benennen", planB:"1 Wort für den Zustand" },
      { title:"Körper-Scan: 8–12 Min", planB:"30 Sekunden Schultern entspannen" },
    ],
    general: [
      { title:"Fokus: 25 Min auf 1 Sache", planB:"5 Min: Start & Struktur" },
      { title:"Organisation: 10 Min aufräumen/sortieren", planB:"2 Min: nur Tisch frei" },
      { title:"Planung: morgen 1 Sache leichter machen", planB:"1 Sache streichen" },
    ]
  };

  const B = {
    community: [
      { title:"Hilfe: 1 Person kontaktieren (kurz & ehrlich)", planB:"1 Satz Nachricht schreiben" },
      { title:"Gemeinwohl: 15–30 Min Micro-Volunteer Task", planB:"5 Min: Infos sammeln / Termin setzen" },
      { title:"Community: 1 kleine Verbesserung im Umfeld", planB:"1 kleine Sache vorbereiten" },
    ],
    peace: [
      { title:"Peace Practice: 1 Deeskalations-Handlung heute", planB:"1 Pause vor der Antwort (10 Sek)" },
      { title:"Zuhören: 10 Min echtes Zuhören (ohne Urteil)", planB:"1 empathischer Satz" },
      { title:"Hass/Stress-Feed vermeiden: 1 Trigger weniger", planB:"1 Quelle stummschalten" },
    ]
  };

  const C = {
    earth: [
      { title:"Nachhaltig: 1 Konsum-Änderung planen", planB:"1 Sache nicht kaufen" },
      { title:"Erde & Tiere: 20 Min kleine Umwelt-Handlung", planB:"5 Min Müll sammeln / trennen" },
      { title:"Tierschutz: 1 Support-Aktion (Info/Spende später)", planB:"1 seriöse Orga bookmarken" },
    ]
  };

  if(cat === "A"){
    const bucket = A[focus] || A.general;
    return bucket.concat(common);
  }
  if(cat === "B"){
    const bucket = B[focus] || B.community;
    return bucket.concat(common);
  }
  if(cat === "C"){
    const bucket = C.earth;
    return bucket.concat(common);
  }
  return common;
}

// ---------- UI rendering ----------

function render(){
  // Ensure "today" is for current date
  if(state.today.date !== isoDate()){
    // roll over softly
    state.today = { date: isoDate(), tasks: [], meta: {} };
    // streak doesn't auto-reset here (we do in checkin)
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  // meta
  const meta = state.today.meta || {};
  const metaText = meta.goalTitle
    ? `Ziel: "${meta.goalTitle}" • Kategorie ${meta.cat} • ${meta.minutes||""} Min • Energie: ${meta.energy||""} • Modus: ${meta.styleMode||""}`
    : "Noch kein Plan für heute. Erzeuge einen Today-Plan.";

  $("todayMeta").textContent = metaText;

  // tasks list
  const list = $("taskList");
  list.innerHTML = "";

  state.today.tasks.forEach((t) => {
    const li = document.createElement("li");
    li.className = "task";

    li.innerHTML = `
      <div class="taskTop">
        <div class="taskTitle">${escapeHtml(t.title)}</div>
        <span class="badge">${t.minutes} min</span>
      </div>
      <div class="planB">Plan B: ${escapeHtml(t.planB)} <span class="badge" style="margin-left:8px">${t.planBMinutes} min</span></div>
      <div class="taskActions">
        <button class="smallBtn done" data-id="${t.id}">${t.done ? "✅ Erledigt" : "Erledigt"}</button>
        <button class="smallBtn swap" data-id="${t.id}">Plan B nutzen</button>
      </div>
    `;

    list.appendChild(li);
  });

  // impact/streak/checkin
  $("impactUnits").textContent = String(state.impactUnits || 0);
  $("streak").textContent = String(state.streak || 0);
  $("lastCheckin").textContent = state.lastCheckin ? state.lastCheckin : "—";

  // reflection question
  if(!$("question").textContent) $("question").textContent = pickQuestion();
  const todayReflection = state.reflections.find(r => r.date === isoDate());
  $("answer").value = todayReflection?.answer || "";
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function pickQuestion(){
  const qs = [
    "Was war heute unnötig schwer?",
    "Was kann morgen kleiner sein?",
    "Was war heute in deiner Kontrolle – und was nicht?",
    "Was hast du getan, obwohl es nicht perfekt war?",
    "Womit hast du heute Frieden gemacht (auch nur ein bisschen)?",
    "Was wäre eine freundlichere Version deines Plans?"
  ];
  return qs[Math.floor(Math.random()*qs.length)];
}

// ---------- Events ----------

$("genPlanBtn").addEventListener("click", () => {
  const goalTitle = $("goalTitle").value.trim();
  const cat = $("goalCat").value;
  const energy = $("energy").value;
  const minutes = Number($("timeBudget").value);
  const styleMode = $("styleMode").value;

  if(!goalTitle){
    alert("Bitte gib ein Ziel ein (1 Satz).");
    return;
  }

  const plan = genPlan({goalTitle, cat, energy, minutes, styleMode});
  state.today = { date: isoDate(), tasks: plan.tasks, meta: plan.meta };
  saveState();
});

$("saveGoalBtn").addEventListener("click", () => {
  const title = $("goalTitle").value.trim();
  const cat = $("goalCat").value;
  if(!title){
    alert("Bitte gib ein Ziel ein.");
    return;
  }
  state.goals.unshift({ id: crypto.randomUUID(), title, cat, createdAt: new Date().toISOString() });
  saveState();
  alert("Ziel gespeichert ✅");
});

$("taskList").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if(!btn) return;
  const id = btn.getAttribute("data-id");
  const t = state.today.tasks.find(x => x.id === id);
  if(!t) return;

  if(btn.classList.contains("done")){
    t.done = !t.done;
    saveState();
    return;
  }
  if(btn.classList.contains("swap")){
    // swap to plan B version
    t.title = t.planB;
    t.minutes = t.planBMinutes;
    t.planB = "Schon im Plan-B Modus.";
    t.planBMinutes = t.minutes;
    saveState();
    return;
  }
});

$("minDayBtn").addEventListener("click", () => {
  // Reduce plan to 1 most meaningful task
  if(state.today.tasks.length === 0) return;
  // pick first unfinished else first
  const pick = state.today.tasks.find(t => !t.done) || state.today.tasks[0];
  state.today.tasks = [{
    ...pick,
    minutes: clamp(Math.round(pick.minutes * 0.6), 5, 25),
    planB: "2 Minuten: nur anfangen",
    planBMinutes: 2,
    done: false
  }];
  saveState();
});

$("checkinBtn").addEventListener("click", () => {
  // Simple streak logic: streak increments if at least 1 task done today
  const doneCount = state.today.tasks.filter(t => t.done).length;
  const today = isoDate();

  if(doneCount >= 1){
    state.streak = (state.streak || 0) + 1;
    state.impactUnits = (state.impactUnits || 0) + 1; // small reward
  } else {
    // no guilt: don't punish; but streak pauses (optional)
    state.streak = state.streak || 0;
  }

  state.lastCheckin = today;
  saveState();
  alert(doneCount >= 1
    ? "Check-in gespeichert ✅ (Streak +1, Impact Units +1)"
    : "Check-in gespeichert ✅ (morgen kleiner planen?)"
  );
});

$("resetBtn").addEventListener("click", () => {
  if(confirm("Heute zurücksetzen? (Plan wird gelöscht)")){
    state.today = { date: isoDate(), tasks: [], meta: {} };
    saveState();
  }
});

$("addImpactBtn").addEventListener("click", () => {
  // Micro impact: user chooses quick action (no politics, no claims)
  const opts = [
    "1 Sache reparieren statt neu kaufen",
    "1 unnötigen Kauf heute vermeiden",
    "5 Minuten Müll sammeln / trennen",
    "1 Person unterstützen (Nachricht / Hilfe)",
    "1 stressigen Feed-Trigger weniger"
  ];
  const pick = opts[Math.floor(Math.random()*opts.length)];
  state.impactUnits = (state.impactUnits || 0) + 1;
  saveState();
  alert(`Micro-Impact ✅\nHeute: ${pick}`);
});

$("saveReflectionBtn").addEventListener("click", () => {
  const q = $("question").textContent || pickQuestion();
  const a = $("answer").value.trim();
  const date = isoDate();

  const idx = state.reflections.findIndex(r => r.date === date);
  const entry = { date, question: q, answer: a };

  if(idx >= 0) state.reflections[idx] = entry;
  else state.reflections.push(entry);

  saveState();
  alert("Reflexion gespeichert ✅");
});

$("newQuestionBtn").addEventListener("click", () => {
  $("question").textContent = pickQuestion();
});


// ---------- PWA install ----------

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("installBtn").style.display = "inline-block";
});

$("installBtn").addEventListener("click", async () => {
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").style.display = "none";
});

// register service worker
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(()=>{});
  });
}

// initial render
render();
