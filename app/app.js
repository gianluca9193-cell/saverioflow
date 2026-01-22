/* SaverIoFlow — app.js (Premium Offline OS)
   ✅ Offline-first (LocalStorage)
   ✅ Today Plan + Plan B + Minimum Day
   ✅ Week Plan (3 Wins)
   ✅ Year Map (Theme → Quarters → Months)
   ✅ Compass (Ziel-Findung + Philosophie)
   ✅ Review (Daily/Weekly/Monthly/Yearly)
   ✅ Works even if your HTML still only has the old Today UI.
   ------------------------------------------------------------
   IMPORTANT:
   - If your /app/index.html already has the old IDs (goalTitle, goalCat, etc.), this will work immediately.
   - If you add optional views later (#viewYear, #viewWeek, #viewCompass, #viewReview), this script will auto-render them too.
*/

const LS_KEY = "saverioflow_os_v2";

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function nowISO() {
  return new Date().toISOString();
}

// ISO week id like "2026-W04"
function getISOWeekId(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

function monthName(m) {
  const names = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  return names[m - 1] || String(m);
}

// ---------- State ----------
function freshState() {
  const year = new Date().getFullYear();
  return {
    ui: {
      view: "today" // "today" | "week" | "year" | "compass" | "review"
    },

    // Goals
    goals: [
      // {id, title, cat, why, createdAt}
    ],

    // Today engine
    today: {
      date: isoDate(),
      tasks: [], // {id,title,minutes,planB,planBMinutes,done}
      meta: {}   // {goalTitle, cat, energy, minutes, styleMode, focus}
    },

    // Plans
    weekPlan: {
      weekId: getISOWeekId(),
      wins: [],  // ["Win 1", "Win 2", "Win 3"]
      notes: ""
    },

    yearPlan: {
      year,
      theme: "",
      quarters: [
        { title: "Q1", focus: "Grundlagen", milestones: [] },
        { title: "Q2", focus: "Aufbau", milestones: [] },
        { title: "Q3", focus: "Vertiefung", milestones: [] },
        { title: "Q4", focus: "Ernte & Ordnung", milestones: [] }
      ],
      months: Array.from({ length: 12 }).map((_, i) => ({
        month: i + 1,
        checkpoint: ""
      }))
    },

    // Philosophy / Compass
    compass: {
      lastMode: "socratic", // socratic|stoic|existential|eco|peace
      wizard: {
        step: 0,
        answers: ["", "", ""], // three prompts
        draftGoalTitle: "",
        draftWhy: "",
        draftCat: "A"
      }
    },

    // Tracking
    impactUnits: 0,
    streak: 0,
    lastCheckin: null,

    reflections: [
      // {date, scope:"daily|weekly|monthly|yearly", question, answer}
    ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);

    // merge shallowly with defaults (keeps new fields)
    const base = freshState();
    return {
      ...base,
      ...parsed,
      ui: { ...base.ui, ...(parsed.ui || {}) },
      today: { ...base.today, ...(parsed.today || {}) },
      weekPlan: { ...base.weekPlan, ...(parsed.weekPlan || {}) },
      yearPlan: { ...base.yearPlan, ...(parsed.yearPlan || {}) },
      compass: { ...base.compass, ...(parsed.compass || {}) }
    };
  } catch {
    return freshState();
  }
}

const state = loadState();

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  renderAll();
}

// ---------- Ensure rolling periods ----------
function ensureToday() {
  const d = isoDate();
  if (state.today.date !== d) {
    state.today = { date: d, tasks: [], meta: {} };
  }
}

function ensureWeek() {
  const w = getISOWeekId();
  if (state.weekPlan.weekId !== w) {
    state.weekPlan = { weekId: w, wins: [], notes: "" };
  }
}

function ensureYear() {
  const y = new Date().getFullYear();
  if (state.yearPlan.year !== y) {
    state.yearPlan.year = y;
    // keep theme optional, reset checkpoints if empty
    if (!state.yearPlan.months || state.yearPlan.months.length !== 12) {
      state.yearPlan.months = Array.from({ length: 12 }).map((_, i) => ({ month: i + 1, checkpoint: "" }));
    }
  }
}

// ---------- Philosophy ----------
const PHILO = {
  socratic: [
    "Was meinst du genau – in einem Satz?",
    "Was wäre die kleinste ehrliche Handlung heute?",
    "Was ist gerade nur Lärm, nicht Wahrheit?"
  ],
  stoic: [
    "Was liegt heute in deiner Kontrolle – und was nicht?",
    "Welche Version davon ist machbar, selbst wenn es schwer wird?",
    "Was wäre Mut ohne Drama?"
  ],
  existential: [
    "Was würdest du tun, wenn niemand zusieht?",
    "Wofür willst du stehen – im Kleinen?",
    "Was verdient deine Zeit wirklich?"
  ],
  eco: [
    "Wie kann dein Fortschritt weniger Schaden machen?",
    "Was kannst du heute bewahren statt verbrauchen?",
    "Welche kleine Handlung respektiert Erde & Tiere?"
  ],
  peace: [
    "Wo kannst du heute deeskalieren statt gewinnen?",
    "Was wäre ein empathischer Satz statt eine Reaktion?",
    "Wie sieht Hilfe im Kleinen aus?"
  ]
};

function pickPhiloQuestion(mode) {
  const arr = PHILO[mode] || PHILO.socratic;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- “AI-feeling” Plan Engine ----------
function normalize(str) {
  return (str || "").trim().toLowerCase();
}

function energyToIntensity(energy, styleMode) {
  let n = energy === "low" ? 0.7 : energy === "high" ? 1.15 : 1.0;
  if (styleMode === "calm") n *= 0.9;
  if (styleMode === "push") n *= 1.1;
  return n;
}

function pickFocus(base, cat) {
  if (cat === "C") return "earth";
  if (cat === "B") {
    if (base.includes("frieden") || base.includes("krieg") || base.includes("peace")) return "peace";
    return "community";
  }
  if (base.includes("fit") || base.includes("sport") || base.includes("gesund")) return "health";
  if (base.includes("lernen") || base.includes("study") || base.includes("sprache")) return "learning";
  if (base.includes("karriere") || base.includes("job") || base.includes("bewerb")) return "career";
  if (base.includes("kreativ") || base.includes("musik") || base.includes("zeichnen")) return "creative";
  if (base.includes("mind") || base.includes("medit") || base.includes("ruhe")) return "mind";
  return "general";
}

function getTemplates(focus, cat) {
  const common = [
    { title: "5 Minuten sortieren: Was ist heute wirklich wichtig?", planB: "1 Satz: 'Heute zählt nur…'" },
    { title: "Eine kleine Handlung starten (ohne perfekt zu sein)", planB: "2 Minuten: nur anfangen" },
    { title: "Kurzer Abschluss: 1 Sache abhaken & speichern", planB: "1 Sache notieren" },
  ];

  const A = {
    health: [
      { title: "Bewegung: 12–20 Min Walk / Mobility", planB: "3 Min: Dehnen / Mini-Mobility" },
      { title: "Ernährung: 1 kleine Verbesserung planen", planB: "1 Wasser + 1 bessere Snack-Option" },
      { title: "Schlaf: Abendroutine 10 Min vorbereiten", planB: "Handy 5 Min weglegen" },
    ],
    learning: [
      { title: "Lernen: 20–30 Min Fokus-Session", planB: "5 Min: nur Überblick lesen" },
      { title: "Notizen: 5 Key Points extrahieren", planB: "1 Key Point aufschreiben" },
      { title: "Üben: 10 Min aktive Wiederholung", planB: "2 Min: 3 Flashcards" },
    ],
    career: [
      { title: "Karriere: 1 konkreter nächster Schritt", planB: "2 Min: Schritt definieren" },
      { title: "Projekt/Bewerbung: 25 Min Deep Work", planB: "5 Min: öffnen + 1 Satz" },
      { title: "Skill: 15 Min gezielt üben", planB: "3 Min: 1 Mini-Übung" },
    ],
    creative: [
      { title: "Kreativ: 20 Min ohne Bewertung erstellen", planB: "5 Min: nur Skizze/Loop starten" },
      { title: "Ideen: 10 Varianten sammeln", planB: "3 Varianten reichen" },
      { title: "Finish: 1 kleine Sache finalisieren", planB: "Nur speichern & aufräumen" },
    ],
    mind: [
      { title: "Atem/Stillness: 10 Min runterfahren", planB: "2 Min: 4-4-6 Atmung" },
      { title: "Mind: 1 Auslöser erkennen & benennen", planB: "1 Wort für den Zustand" },
      { title: "Körper-Scan: 8–12 Min", planB: "30 Sek: Schultern entspannen" },
    ],
    general: [
      { title: "Fokus: 25 Min auf 1 Sache", planB: "5 Min: Start & Struktur" },
      { title: "Organisation: 10 Min aufräumen/sortieren", planB: "2 Min: nur Fläche frei" },
      { title: "Planung: morgen 1 Sache leichter machen", planB: "1 Sache streichen" },
    ]
  };

  const B = {
    community: [
      { title: "Hilfe: 1 Person kontaktieren (kurz & ehrlich)", planB: "1 Satz Nachricht schreiben" },
      { title: "Gemeinwohl: 15–30 Min Micro-Volunteer Schritt", planB: "5 Min: Termin/Info setzen" },
      { title: "Community: 1 kleine Verbesserung im Umfeld", planB: "1 kleine Sache vorbereiten" },
    ],
    peace: [
      { title: "Peace Practice: 1 Deeskalations-Handlung heute", planB: "10 Sek Pause vor der Antwort" },
      { title: "Zuhören: 10 Min echtes Zuhören (ohne Urteil)", planB: "1 empathischer Satz" },
      { title: "Stress-Feed reduzieren: 1 Trigger weniger", planB: "1 Quelle stummschalten" },
    ]
  };

  const C = {
    earth: [
      { title: "Nachhaltig: 1 Konsum-Änderung planen", planB: "1 Sache heute nicht kaufen" },
      { title: "Erde & Tiere: 20 Min kleine Umwelt-Handlung", planB: "5 Min Müll trennen/sammeln" },
      { title: "Tierschutz: 1 Support-Aktion (Info/Plan)", planB: "1 seriöse Orga bookmarken" },
    ]
  };

  if (cat === "A") return (A[focus] || A.general).concat(common);
  if (cat === "B") return (B[focus] || B.community).concat(common);
  if (cat === "C") return C.earth.concat(common);
  return common;
}

function genTodayPlan({ goalTitle, cat, energy, minutes, styleMode }) {
  const base = normalize(goalTitle);
  const focus = pickFocus(base, cat);
  const intensity = energyToIntensity(energy, styleMode);

  const taskCount = minutes <= 15 ? 2 : minutes <= 30 ? 3 : minutes <= 60 ? 4 : 5;
  const perTask = Math.max(5, Math.round(minutes / taskCount));

  const templates = getTemplates(focus, cat);
  const tasks = Array.from({ length: taskCount }).map((_, idx) => {
    const temp = templates[idx % templates.length];
    const min = clamp(Math.round(perTask * intensity), 5, 60);
    const planBMinutes = clamp(Math.round(min * 0.45), 3, 20);

    return {
      id: crypto.randomUUID(),
      title: temp.title,
      minutes: min,
      planB: temp.planB,
      planBMinutes,
      done: false
    };
  });

  return {
    meta: { goalTitle, cat, energy, minutes, styleMode, focus },
    tasks
  };
}

// ---------- Year Plan Generator ----------
function pickYearTheme(goals) {
  if (!goals?.length) return "Klarheit vor Tempo";
  if (goals.some(g => g.cat === "C")) return "Weniger nehmen, mehr bewahren";
  if (goals.some(g => g.cat === "B")) return "Verbunden leben";
  return "Ruhige Disziplin";
}

function miniMilestoneForGoal(g) {
  if (g.cat === "A") return `A: ${g.title} — 1 Routine stabilisieren`;
  if (g.cat === "B") return `B: ${g.title} — 1 konkreter Beitrag pro Woche`;
  if (g.cat === "C") return `C: ${g.title} — 1 Verhalten ändern, 1 Support-Action`;
  return `${g.title} — kleinster Schritt`;
}

function monthCheckpoint(theme, m) {
  const map = [
    "Start: minimal & ehrlich",
    "Stabilisieren: weniger, aber täglich",
    "Ordnung: Dinge vereinfachen",
    "Aufbau: kleine Intensivierung",
    "Vertiefung: Qualität statt Menge",
    "Halbjahres-Review: Kurs korrigieren",
    "Sommer: Energie schützen",
    "Wiederaufnahme: sanft erhöhen",
    "Fokus: eine Sache abschließen",
    "Ernte: Ergebnisse sammeln",
    "Aufräumen: Ballast reduzieren",
    "Jahresabschluss: Sinn & Richtung"
  ];
  return `${map[m - 1]} • Theme: ${theme}`;
}

function regenYearPlanFromGoals() {
  const year = new Date().getFullYear();
  const theme = pickYearTheme(state.goals);
  state.yearPlan.year = year;
  state.yearPlan.theme = theme;

  // Reset quarters (keep focus labels)
  if (!state.yearPlan.quarters || state.yearPlan.quarters.length !== 4) {
    state.yearPlan.quarters = [
      { title: "Q1", focus: "Grundlagen", milestones: [] },
      { title: "Q2", focus: "Aufbau", milestones: [] },
      { title: "Q3", focus: "Vertiefung", milestones: [] },
      { title: "Q4", focus: "Ernte & Ordnung", milestones: [] }
    ];
  } else {
    state.yearPlan.quarters.forEach(q => q.milestones = []);
  }

  state.goals.slice(0, 6).forEach((g, i) => {
    const q = state.yearPlan.quarters[i % 4];
    q.milestones.push(miniMilestoneForGoal(g));
    q.milestones.push("Plan B Version definieren (leicht & ehrlich)");
  });

  state.yearPlan.months = Array.from({ length: 12 }).map((_, idx) => ({
    month: idx + 1,
    checkpoint: monthCheckpoint(theme, idx + 1)
  }));
}

// ---------- Week plan ----------
function regenWeekWins() {
  // 3 quiet wins based on goals + year theme
  const theme = state.yearPlan.theme || pickYearTheme(state.goals);
  const goals = state.goals.slice(0, 3);

  const wins = [];
  if (goals[0]) wins.push(`1 Schritt für: ${goals[0].title}`);
  if (goals[1]) wins.push(`Plan B absichern für: ${goals[1].title}`);
  if (goals[2]) wins.push(`Ordnungsschritt für: ${goals[2].title}`);

  while (wins.length < 3) {
    wins.push(`Theme leben: ${theme}`);
  }
  state.weekPlan.wins = wins.slice(0, 3);
}

// ---------- Reviews ----------
function setReflection(scope, question, answer) {
  const date = isoDate();
  const idx = state.reflections.findIndex(r => r.date === date && r.scope === scope);
  const entry = { date, scope, question, answer };
  if (idx >= 0) state.reflections[idx] = entry;
  else state.reflections.push(entry);
}

// ---------- UI Wiring (works with old HTML OR optional multi-view HTML) ----------

function bindIfExists(id, event, handler) {
  const el = $(id);
  if (!el) return;
  el.addEventListener(event, handler);
}

// Tabs (optional): buttons with data-view="today|week|year|compass|review"
function bindNavTabs() {
  const tabs = document.querySelectorAll("[data-view]");
  if (!tabs.length) return;
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      state.ui.view = btn.dataset.view;
      saveState();
    });
  });
}

function showViewIfExists() {
  // optional: containers with IDs viewToday/viewWeek/viewYear/viewCompass/viewReview
  const map = {
    today: "viewToday",
    week: "viewWeek",
    year: "viewYear",
    compass: "viewCompass",
    review: "viewReview"
  };
  const all = Object.values(map).map(id => $(id)).filter(Boolean);
  if (!all.length) return; // old UI only
  Object.entries(map).forEach(([key, id]) => {
    const el = $(id);
    if (!el) return;
    el.style.display = (state.ui.view === key) ? "block" : "none";
  });
}

// ---------- Render: Today (old UI compatible) ----------
function renderToday() {
  ensureToday();

  const meta = state.today.meta || {};
  const metaText = meta.goalTitle
    ? `Ziel: "${meta.goalTitle}" • Kategorie ${meta.cat} • ${meta.minutes || ""} Min • Energie: ${meta.energy || ""} • Modus: ${meta.styleMode || ""}`
    : "Noch kein Plan für heute. Erzeuge einen Today-Plan.";

  if ($("todayMeta")) $("todayMeta").textContent = metaText;

  const list = $("taskList");
  if (list) {
    list.innerHTML = "";
    state.today.tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="itemTop">
          <div class="itemTitle">${escapeHtml(t.title)}</div>
          <span class="badge badge-turq">${t.minutes} min</span>
        </div>
        <div class="itemSub">
          Plan B: ${escapeHtml(t.planB)}
          <span class="badge badge-gold" style="margin-left:8px">${t.planBMinutes} min</span>
        </div>
        <div class="mini-actions">
          <button class="btn ${t.done ? "btn-primary" : ""}" data-action="done" data-id="${t.id}">
            ${t.done ? "✅ Erledigt" : "Erledigt"}
          </button>
          <button class="btn btn-ghost" data-action="swap" data-id="${t.id}">Plan B nutzen</button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  if ($("impactUnits")) $("impactUnits").textContent = String(state.impactUnits || 0);
  if ($("streak")) $("streak").textContent = String(state.streak || 0);
  if ($("lastCheckin")) $("lastCheckin").textContent = state.lastCheckin ? state.lastCheckin : "—";

  // question / reflection (daily)
  const qEl = $("question");
  if (qEl && !qEl.textContent) {
    // default daily question from lastMode
    qEl.textContent = pickPhiloQuestion(state.compass.lastMode || "socratic");
  }
  const todayDaily = state.reflections.find(r => r.date === isoDate() && r.scope === "daily");
  if ($("answer")) $("answer").value = todayDaily?.answer || "";
}

// ---------- Render: Week / Year / Compass / Review (optional containers) ----------
function renderWeek() {
  ensureWeek();
  const wrap = $("weekWrap");
  if (!wrap) return;

  const wins = state.weekPlan.wins || [];
  wrap.innerHTML = `
    <div class="card">
      <h2>Woche ${escapeHtml(state.weekPlan.weekId)}</h2>
      <div class="meta">3 ruhige Wins. Keine Overload-Woche.</div>
      <ol class="list" style="margin-top:12px;">
        ${wins.map((w, i) => `
          <li class="item">
            <div class="itemTop">
              <div class="itemTitle">${escapeHtml(w || `Win ${i+1}`)}</div>
              <span class="badge">Win</span>
            </div>
            <div class="itemSub">Plan B: kleinster Schritt, wenn es schwer wird.</div>
          </li>
        `).join("")}
      </ol>
      <div class="row" style="margin-top:12px;">
        <button class="btn btn-primary" id="regenWeekBtn">Wins generieren</button>
        <button class="btn btn-ghost" id="weekToTodayBtn">Heute planen</button>
      </div>
    </div>
  `;

  // bind inside
  const regen = $("regenWeekBtn");
  if (regen) regen.onclick = () => { regenWeekWins(); saveState(); };

  const toToday = $("weekToTodayBtn");
  if (toToday) toToday.onclick = () => { state.ui.view = "today"; saveState(); };
}

function renderYear() {
  ensureYear();
  const wrap = $("yearWrap");
  if (!wrap) return;

  const yp = state.yearPlan;
  const theme = yp.theme || "(noch kein Theme)";
  const quarters = (yp.quarters || []);
  const months = (yp.months || []);

  wrap.innerHTML = `
    <div class="card">
      <div class="itemTop" style="margin-bottom:10px;">
        <div class="itemTitle">Jahreskarte ${escapeHtml(String(yp.year))}</div>
        <span class="badge badge-gold">Theme</span>
      </div>

      <div class="item" style="margin-top:0;">
        <div class="itemTop">
          <div class="itemTitle">${escapeHtml(theme)}</div>
          <span class="badge badge-turq">Year</span>
        </div>
        <div class="itemSub">Ein Satz, der dein Jahr leitet. Klarheit vor Tempo.</div>
      </div>

      <div class="row" style="margin-top:12px;">
        <button class="btn btn-primary" id="regenYearBtn">Aus Zielen generieren</button>
        <button class="btn btn-ghost" id="yearToWeekBtn">In Woche übersetzen</button>
      </div>

      <div style="margin-top:16px;">
        <h2>Quartale</h2>
        <div class="row" style="margin-top:10px;">
          ${quarters.map(q => `
            <div class="card" style="padding:14px;">
              <div class="itemTop">
                <div class="itemTitle">${escapeHtml(q.title)}</div>
                <span class="badge">${escapeHtml(q.focus || "")}</span>
              </div>
              <div class="meta" style="margin-top:8px;">
                ${(q.milestones || []).slice(0,4).map(m => `• ${escapeHtml(m)}`).join("<br>") || "• (noch leer)"}
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div style="margin-top:16px;">
        <h2>Monats-Checkpoints</h2>
        <div class="meta">Kurz & praktisch – ohne Kalender-Zwang.</div>
        <div class="row" style="margin-top:10px; flex-wrap:wrap;">
          ${months.map(m => `
            <div class="kpi" style="min-width:190px;">
              <div class="k">${escapeHtml(monthName(m.month))}</div>
              <div class="v" style="font-size:12px; font-weight:700; color: rgba(234,242,251,.92); margin-top:6px;">
                ${escapeHtml(m.checkpoint || "")}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  const regen = $("regenYearBtn");
  if (regen) regen.onclick = () => {
    regenYearPlanFromGoals();
    saveState();
  };

  const toWeek = $("yearToWeekBtn");
  if (toWeek) toWeek.onclick = () => {
    regenWeekWins();
    state.ui.view = "week";
    saveState();
  };
}

function renderCompass() {
  const wrap = $("compassWrap");
  if (!wrap) return;

  const wiz = state.compass.wizard;
  const step = wiz.step || 0;
  const modes = [
    ["socratic", "Sokratisch"],
    ["stoic", "Stoisch"],
    ["existential", "Existentiell"],
    ["eco", "Öko"],
    ["peace", "Peace"]
  ];

  const wizardPrompts = [
    "Was schmerzt, fehlt oder ruft gerade?",
    "Was wäre die kleinste ehrliche Veränderung, die du 14 Tage durchhalten könntest?",
    "Warum ist dir das wichtig (in einem Satz)?"
  ];

  wrap.innerHTML = `
    <div class="card">
      <div class="itemTop" style="margin-bottom:10px;">
        <div class="itemTitle">Compass</div>
        <span class="badge badge-turq">Ziel-Findung</span>
      </div>

      <div class="meta">Weniger Ziele. Mehr Richtung. Ruhe statt Druck.</div>

      <div class="row" style="margin-top:12px; flex-wrap:wrap;">
        ${modes.map(([k, label]) => `
          <button class="btn ${state.compass.lastMode === k ? "btn-primary" : "btn-ghost"}" data-mode="${k}" style="width:auto;">
            ${label}
          </button>
        `).join("")}
      </div>

      <div class="item" style="margin-top:14px;">
        <div class="itemTop">
          <div class="itemTitle">Philosophie-Frage</div>
          <span class="badge">${escapeHtml(state.compass.lastMode)}</span>
        </div>
        <div class="itemSub" id="philoQ" style="font-size:13px; color: rgba(234,242,251,.92); margin-top:10px;">
          ${escapeHtml(pickPhiloQuestion(state.compass.lastMode))}
        </div>
        <div class="row" style="margin-top:10px;">
          <textarea id="philoA" class="textarea" placeholder="1–3 Sätze reichen…"></textarea>
        </div>
        <div class="row" style="margin-top:10px;">
          <button id="savePhiloBtn" class="btn">Speichern</button>
          <button id="newPhiloBtn" class="btn btn-ghost">Neue Frage</button>
        </div>
      </div>

      <div class="item" style="margin-top:14px;">
        <div class="itemTop">
          <div class="itemTitle">Goal Discovery Wizard</div>
          <span class="badge badge-gold">3 Schritte</span>
        </div>

        <div class="meta" style="margin-top:8px;">${escapeHtml(wizardPrompts[step] || "Fertig!")}</div>

        <textarea id="wizAnswer" class="textarea" placeholder="Schreib frei…">${escapeHtml(wiz.answers?.[step] || "")}</textarea>

        <div class="row" style="margin-top:10px;">
          <button id="wizBack" class="btn btn-ghost">Zurück</button>
          <button id="wizNext" class="btn btn-primary">${step < 2 ? "Weiter" : "Ziel erstellen"}</button>
        </div>

        <div style="margin-top:12px;">
          <div class="label">Kategorie</div>
          <select id="wizCat" class="select">
            <option value="A" ${wiz.draftCat==="A"?"selected":""}>A — Persönlich</option>
            <option value="B" ${wiz.draftCat==="B"?"selected":""}>B — Gemeinwohl</option>
            <option value="C" ${wiz.draftCat==="C"?"selected":""}>C — Erde & Tiere</option>
          </select>
        </div>

        <div class="hint">
          <strong>Regel:</strong> Ein gutes Ziel respektiert dich. Wenn es dich zerstört, ist es kein Ziel – es ist Lärm.
        </div>
      </div>
    </div>
  `;

  // bind mode buttons
  wrap.querySelectorAll("[data-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.compass.lastMode = btn.dataset.mode;
      saveState();
    });
  });

  // philosophy save/new
  const saveBtn = $("savePhiloBtn");
  if (saveBtn) saveBtn.onclick = () => {
    const q = $("philoQ")?.textContent || "";
    const a = $("philoA")?.value?.trim() || "";
    setReflection("daily", q, a);
    saveState();
    alert("Gespeichert ✅");
  };

  const newBtn = $("newPhiloBtn");
  if (newBtn) newBtn.onclick = () => {
    const qEl = $("philoQ");
    if (qEl) qEl.textContent = pickPhiloQuestion(state.compass.lastMode);
  };

  // wizard
  const ans = $("wizAnswer");
  const cat = $("wizCat");
  if (cat) cat.onchange = () => {
    state.compass.wizard.draftCat = cat.value;
    saveState();
  };

  const back = $("wizBack");
  if (back) back.onclick = () => {
    // save current
    if (ans) state.compass.wizard.answers[step] = ans.value;
    state.compass.wizard.step = Math.max(0, step - 1);
    saveState();
  };

  const next = $("wizNext");
  if (next) next.onclick = () => {
    if (ans) state.compass.wizard.answers[step] = ans.value;

    if (step < 2) {
      state.compass.wizard.step = step + 1;
      saveState();
      return;
    }

    // create goal
    const a0 = (state.compass.wizard.answers[0] || "").trim();
    const a1 = (state.compass.wizard.answers[1] || "").trim();
    const a2 = (state.compass.wizard.answers[2] || "").trim();

    const title = a1 ? a1 : (a0 ? a0 : "Ein kleines ehrliches Ziel");
    const why = a2 ? a2 : "Weil es zählt.";

    const goal = {
      id: crypto.randomUUID(),
      title,
      cat: state.compass.wizard.draftCat || "A",
      why,
      createdAt: nowISO()
    };
    state.goals.unshift(goal);

    // regenerate year + week suggestions
    regenYearPlanFromGoals();
    ensureWeek();
    regenWeekWins();

    // reset wizard
    state.compass.wizard = { step: 0, answers: ["", "", ""], draftGoalTitle: "", draftWhy: "", draftCat: goal.cat };

    saveState();
    alert("Ziel erstellt ✅ (Year Map & Week Wins aktualisiert)");
  };
}

function renderReview() {
  const wrap = $("reviewWrap");
  if (!wrap) return;

  const weeklyQ = "Was war diese Woche wichtig – und was war nur Lärm?";
  const monthlyQ = "Welche Richtung war richtig, welche war nur Gewohnheit?";
  const yearlyQ = "Wofür willst du stehen – wenn du zurückblickst?";

  const todayWeekly = state.reflections.find(r => r.date === isoDate() && r.scope === "weekly");
  const todayMonthly = state.reflections.find(r => r.date === isoDate() && r.scope === "monthly");
  const todayYearly = state.reflections.find(r => r.date === isoDate() && r.scope === "yearly");

  wrap.innerHTML = `
    <div class="card">
      <h2>Review</h2>
      <div class="meta">Kurskorrektur ohne Selbsthass. Kleine Wahrheit → bessere Pläne.</div>

      <div class="item" style="margin-top:12px;">
        <div class="itemTop"><div class="itemTitle">Weekly Review</div><span class="badge">5 min</span></div>
        <div class="itemSub">${escapeHtml(weeklyQ)}</div>
        <textarea id="weeklyA" class="textarea" placeholder="Kurz reicht…">${escapeHtml(todayWeekly?.answer || "")}</textarea>
        <div class="row" style="margin-top:10px;">
          <button id="saveWeekly" class="btn btn-primary">Speichern</button>
        </div>
      </div>

      <div class="item">
        <div class="itemTop"><div class="itemTitle">Monthly Review</div><span class="badge">10 min</span></div>
        <div class="itemSub">${escapeHtml(monthlyQ)}</div>
        <textarea id="monthlyA" class="textarea" placeholder="Kurz reicht…">${escapeHtml(todayMonthly?.answer || "")}</textarea>
        <div class="row" style="margin-top:10px;">
          <button id="saveMonthly" class="btn">Speichern</button>
        </div>
      </div>

      <div class="item">
        <div class="itemTop"><div class="itemTitle">Year Review</div><span class="badge badge-gold">20 min</span></div>
        <div class="itemSub">${escapeHtml(yearlyQ)}</div>
        <textarea id="yearlyA" class="textarea" placeholder="Kurz reicht…">${escapeHtml(todayYearly?.answer || "")}</textarea>
        <div class="row" style="margin-top:10px;">
          <button id="saveYearly" class="btn">Speichern</button>
          <button id="toYearMap" class="btn btn-ghost">Year Map ansehen</button>
        </div>
      </div>
    </div>
  `;

  $("saveWeekly").onclick = () => {
    setReflection("weekly", weeklyQ, $("weeklyA").value.trim());
    saveState();
    alert("Weekly Review gespeichert ✅");
  };
  $("saveMonthly").onclick = () => {
    setReflection("monthly", monthlyQ, $("monthlyA").value.trim());
    saveState();
    alert("Monthly Review gespeichert ✅");
  };
  $("saveYearly").onclick = () => {
    setReflection("yearly", yearlyQ, $("yearlyA").value.trim());
    saveState();
    alert("Year Review gespeichert ✅");
  };
  $("toYearMap").onclick = () => {
    state.ui.view = "year";
    saveState();
  };
}

// ---------- Event bindings for old Today UI ----------
function bindOldTodayUI() {
  // Generate plan
  bindIfExists("genPlanBtn", "click", () => {
    const goalTitle = $("goalTitle")?.value?.trim() || "";
    const cat = $("goalCat")?.value || "A";
    const energy = $("energy")?.value || "med";
    const minutes = Number($("timeBudget")?.value || 30);
    const styleMode = $("styleMode")?.value || "calm";

    if (!goalTitle) {
      alert("Bitte gib ein Ziel ein (1 Satz).");
      return;
    }

    const plan = genTodayPlan({ goalTitle, cat, energy, minutes, styleMode });
    state.today = { date: isoDate(), tasks: plan.tasks, meta: plan.meta };
    saveState();
  });

  // Save goal
  bindIfExists("saveGoalBtn", "click", () => {
    const title = $("goalTitle")?.value?.trim() || "";
    const cat = $("goalCat")?.value || "A";
    if (!title) {
      alert("Bitte gib ein Ziel ein.");
      return;
    }
    const goal = { id: crypto.randomUUID(), title, cat, why: "", createdAt: nowISO() };
    state.goals.unshift(goal);

    // keep year & week aligned
    regenYearPlanFromGoals();
    ensureWeek();
    regenWeekWins();

    saveState();
    alert("Ziel gespeichert ✅ (Year Map & Week aktualisiert)");
  });

  // Task list actions
  const list = $("taskList");
  if (list) {
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const t = state.today.tasks.find(x => x.id === id);
      if (!t) return;

      if (action === "done") {
        t.done = !t.done;
        saveState();
        return;
      }
      if (action === "swap") {
        t.title = t.planB;
        t.minutes = t.planBMinutes;
        t.planB = "Schon im Plan-B Modus.";
        t.planBMinutes = t.minutes;
        t.done = false;
        saveState();
      }
    });
  }

  // Minimum day
  bindIfExists("minDayBtn", "click", () => {
    if (state.today.tasks.length === 0) return;
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

  // Check-in
  bindIfExists("checkinBtn", "click", () => {
    const doneCount = state.today.tasks.filter(t => t.done).length;
    const today = isoDate();

    if (doneCount >= 1) {
      state.streak = (state.streak || 0) + 1;
      state.impactUnits = (state.impactUnits || 0) + 1;
    } else {
      state.streak = state.streak || 0;
    }
    state.lastCheckin = today;
    saveState();

    alert(doneCount >= 1
      ? "Check-in gespeichert ✅ (Streak +1, Impact Units +1)"
      : "Check-in gespeichert ✅ (Tipp: morgen kleiner planen)"
    );
  });

  // Reset
  bindIfExists("resetBtn", "click", () => {
    if (confirm("Heute zurücksetzen? (Plan wird gelöscht)")) {
      state.today = { date: isoDate(), tasks: [], meta: {} };
      saveState();
    }
  });

  // Micro-impact
  bindIfExists("addImpactBtn", "click", () => {
    const opts = [
      "1 Sache reparieren statt neu kaufen",
      "1 unnötigen Kauf heute vermeiden",
      "5 Minuten Müll trennen/sammeln",
      "1 Person unterstützen (Nachricht / Hilfe)",
      "1 Trigger weniger (Feed/Quelle stummschalten)"
    ];
    const pick = opts[Math.floor(Math.random() * opts.length)];
    state.impactUnits = (state.impactUnits || 0) + 1;
    saveState();
    alert(`Micro-Impact ✅\nHeute: ${pick}`);
  });

  // Daily reflection (existing fields)
  bindIfExists("saveReflectionBtn", "click", () => {
    const q = $("question")?.textContent || pickPhiloQuestion(state.compass.lastMode || "socratic");
    const a = $("answer")?.value?.trim() || "";
    setReflection("daily", q, a);
    saveState();
    alert("Reflexion gespeichert ✅");
  });

  bindIfExists("newQuestionBtn", "click", () => {
    const qEl = $("question");
    if (qEl) qEl.textContent = pickPhiloQuestion(state.compass.lastMode || "socratic");
  });
}

// ---------- PWA install + SW ----------
function setupPWA() {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = $("installBtn");
    if (btn) btn.style.display = "inline-block";
  });

  bindIfExists("installBtn", "click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    const btn = $("installBtn");
    if (btn) btn.style.display = "none";
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

// ---------- Master render ----------
function renderAll() {
  ensureToday();
  ensureWeek();
  ensureYear();

  // if year theme empty, infer softly (no overwrite if user set)
  if (!state.yearPlan.theme) {
    state.yearPlan.theme = pickYearTheme(state.goals);
  }
  // if week wins empty, infer softly
  if (!state.weekPlan.wins || state.weekPlan.wins.length === 0) {
    regenWeekWins();
  }

  showViewIfExists();
  renderToday();
  renderWeek();
  renderYear();
  renderCompass();
  renderReview();
}

// For naming consistency
function renderAllAlias(){ renderAll(); }
function renderAll(){ renderAllAlias(); } // (avoid accidental rename)

// Actually call the real renderer
function renderAllReal(){
  // prevent recursion
  ensureToday();
  ensureWeek();
  ensureYear();

  if (!state.yearPlan.theme) state.yearPlan.theme = pickYearTheme(state.goals);
  if (!state.weekPlan.wins || state.weekPlan.wins.length === 0) regenWeekWins();

  showViewIfExists();
  renderToday();
  renderWeek();
  renderYear();
  renderCompass();
  renderReview();
}

function renderAll(){ renderAllReal(); }

// ---------- Init ----------
function init() {
  ensureToday();
  ensureWeek();
  ensureYear();

  // If user already has goals but year not generated, generate once
  if (state.goals.length && (!state.yearPlan.theme || state.yearPlan.quarters.every(q => !q.milestones?.length))) {
    regenYearPlanFromGoals();
  }

  bindNavTabs();
  bindOldTodayUI();
  setupPWA();
  renderAll();
}

// run
init();
// =========================
// Language switch wiring
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("langSelect");
  if (!sel || !window.SIF_I18N) return;

  // set initial
  sel.value = window.SIF_I18N.getCurrent();

  // user change
  sel.addEventListener("change", (e) => {
    window.SIF_I18N.set(e.target.value);
  });

  // keep in sync if language is changed elsewhere
  window.addEventListener("sif:lang-changed", (ev) => {
    if (ev?.detail?.lang) sel.value = ev.detail.lang;
  });
});

