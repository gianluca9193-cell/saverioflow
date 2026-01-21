/* SaverIoFlow — final MVP (offline, vanilla SPA)
   STORE_KEY: "saverioflow_final_v1"
*/
const STORE_KEY = "saverioflow_final_v1";

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (d=new Date()) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseISO = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const fmtShort = (s) => {
  const d = parseISO(s);
  return d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
};
const weekStartMonday = (d=new Date()) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay()+6)%7; // Mon=0
  x.setDate(x.getDate()-day);
  return x;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const minutesToHHMM = (mins) => {
  const m = Math.max(0, Math.floor(mins));
  const h = Math.floor(m/60);
  const mm = m%60;
  return `${h}h ${mm}m`;
};
const safeText = (s) => (s||"").toString().trim();

function defaultStore(){
  const today = isoDate();
  return {
    version: 1,
    createdAt: Date.now(),
    today: {
      date: today,
      doneBy: "17:00",
      focusStyle: "Deep",
      tasks: [
        { id: uid(), text: "Flow block — 25 min", done: false, createdAt: Date.now(), source: "template" },
        { id: uid(), text: "Small step — 10 min", done: false, createdAt: Date.now(), source: "template" }
      ],
      distractions: [],
      streak: { count: 0, lastCompleteDate: null }
    },
    week: {
      startDate: isoDate(weekStartMonday()),
      days: {} // key: YYYY-MM-DD -> { tasks:[{id,text,done,createdAt}] }
    },
    goals: [],
    settings: {
      pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 }
    },
    ui: {
      lastRoute: "#/start",
      goalsSelectedId: null
    }
  };
}

function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defaultStore();
    const s = JSON.parse(raw);
    if(!s || typeof s !== "object") return defaultStore();
    return migrateStore(s);
  }catch(e){
    return defaultStore();
  }
}

function migrateStore(s){
  // minimal migration guard
  if(!s.today) s.today = defaultStore().today;
  if(!s.week) s.week = defaultStore().week;
  if(!s.settings) s.settings = defaultStore().settings;
  if(!s.ui) s.ui = defaultStore().ui;

  // date rollover: if stored "today.date" is not current day, create new day but keep streak logic
  const now = isoDate();
  if(s.today.date !== now){
    // preserve tasks? We keep them (MVP). But streak is computed when full completion happened on a day.
    s.today.date = now;
    s.today.distractions = [];
  }
  if(!s.week.startDate) s.week.startDate = isoDate(weekStartMonday());
  if(!s.week.days) s.week.days = {};
  if(!Array.isArray(s.goals)) s.goals = [];
  if(!s.today.tasks) s.today.tasks = [];
  return s;
}

function saveStore(){
  localStorage.setItem(STORE_KEY, JSON.stringify(STORE, null, 0));
}

let STORE = loadStore();

/* ---------------------------
   Modal
----------------------------*/
const modalRoot = $("#modalRoot");
function closeModal(){
  modalRoot.classList.remove("open");
  modalRoot.innerHTML = "";
  modalRoot.setAttribute("aria-hidden", "true");
}
function openModal(title, bodyHTML, { onMount } = {}){
  modalRoot.setAttribute("aria-hidden", "false");
  modalRoot.classList.add("open");
  modalRoot.innerHTML = `
    <div class="modalBackdrop" data-close="1"></div>
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modalHead">
        <div class="modalTitle">${title}</div>
        <button class="btn ghost" data-close="1">Close</button>
      </div>
      <div class="modalBody">${bodyHTML}</div>
    </div>
  `;
  modalRoot.addEventListener("click", (e) => {
    const el = e.target;
    if(el && el.getAttribute && el.getAttribute("data-close") === "1") closeModal();
  }, { once:true });

  if(typeof onMount === "function") onMount(modalRoot);
}

/* ---------------------------
   Sidebar & Topbar indicators
----------------------------*/
function computeTodayProgress(){
  const tasks = STORE.today.tasks || [];
  const total = tasks.length;
  const done = tasks.filter(t => !!t.done).length;
  const pct = total === 0 ? 0 : Math.round((done/total)*100);
  return { total, done, pct };
}

function recomputeStreakIfCompleted(){
  const { total, done } = computeTodayProgress();
  if(total === 0) return;
  if(done !== total) return;

  const today = STORE.today.date;
  if(STORE.today.streak.lastCompleteDate === today) return;

  // if lastCompleteDate was yesterday, increment; otherwise reset to 1
  const last = STORE.today.streak.lastCompleteDate;
  if(last){
    const dLast = parseISO(last);
    const dNow = parseISO(today);
    const diffDays = Math.round((dNow - dLast) / (1000*60*60*24));
    STORE.today.streak.count = (diffDays === 1) ? (STORE.today.streak.count + 1) : 1;
  }else{
    STORE.today.streak.count = 1;
  }
  STORE.today.streak.lastCompleteDate = today;
}

function updateChrome(){
  const { total, done, pct } = computeTodayProgress();

  $("#pillDate").textContent = fmtShort(STORE.today.date);
  $("#pillStreak").textContent = `Streak ${STORE.today.streak.count || 0}`;

  $("#sideProgress").textContent = `${pct}% (${done}/${total})`;
  $("#sideDoneBy").textContent = STORE.today.doneBy || "—";
  $("#sideFocusStyle").textContent = STORE.today.focusStyle || "—";

  // also mark active route in sidebar
  const r = (location.hash || "#/start").split("?")[0];
  $$(".navItem").forEach(a => a.classList.toggle("active", a.getAttribute("href") === r));
}

/* ---------------------------
   Templates & offline generators
----------------------------*/
const TODAY_TEMPLATES = [
  { name:"Calm Start", lines:["Flow block — 25 min","Inbox zero — 10 min","Small step — 10 min"] },
  { name:"Deep Work", lines:["Flow block — 45 min","Break — 5 min","Flow block — 25 min"] },
  { name:"Admin Reset", lines:["Plan the day — 5 min","Email sweep — 15 min","Follow-ups — 15 min"] },
];

const MILESTONE_TEMPLATES = {
  clarity: (title) => [
    { t:`Define “done” for ${title}`, a:["Write the outcome statement","List constraints","Pick a success metric"] },
    { t:"Plan the path", a:["Break into 3–5 milestones","Estimate hours per milestone","Decide weekly rhythm"] }
  ],
  skill: (title) => [
    { t:"Build fundamentals", a:["Choose resource","Practice 20 min","Take notes"] },
    { t:"Ship small outputs", a:["Create 3 tiny projects","Get feedback","Iterate"] },
    { t:"Consolidate", a:["Review mistakes","Create checklist","Repeat core drills"] }
  ],
  build: (title) => [
    { t:"MVP scope", a:["Define core loop","List must-haves","Pick constraints"] },
    { t:"Implement", a:["Create skeleton","Build feature 1","Build feature 2"] },
    { t:"Polish & ship", a:["Fix rough edges","Write onboarding copy","Release v1"] }
  ],
  health: (title) => [
    { t:"Baseline", a:["Define weekly target","Choose simple routine","Track 7 days"] },
    { t:"Consistency", a:["Schedule blocks","Prepare environment","Reduce friction"] },
    { t:"Progress", a:["Increase difficulty","Measure weekly","Adjust"] }
  ],
  income: (title) => [
    { t:"Offer", a:["Define problem + audience","Write one-page offer","Choose pricing"] },
    { t:"Distribution", a:["Pick 1 channel","Create 5 posts","Start outreach"] },
    { t:"Conversion", a:["Run 10 conversations","Collect objections","Refine pitch"] }
  ]
};

function scaleMilestonesByMinutes(minPerDay, ms){
  // Simple scaling: fewer minutes/day => more, smaller actions
  const m = clamp(Number(minPerDay)||30, 10, 180);
  const factor = m >= 60 ? 0.85 : (m >= 30 ? 1 : 1.25);
  return ms.map(x => ({
    title: x.t,
    done: false,
    actions: x.a.map(a => ({
      id: uid(),
      text: a,
      done: false,
      weight: factor
    }))
  }));
}

/* ---------------------------
   Views (SPA)
----------------------------*/
const view = $("#view");

const Routes = {
  "#/start": renderStart,
  "#/today": renderToday,
  "#/week": renderWeek,
  "#/goals": renderGoals,
  "#/discover": renderDiscover,
  "#/flow": renderFlow // overlay-based but route exists
};

function navigate(hash){
  location.hash = hash;
}

function mount(){
  const hash = location.hash || STORE.ui.lastRoute || "#/start";
  if(!location.hash) location.hash = hash;
  render();
}

window.addEventListener("hashchange", render);

function render(){
  const hash = (location.hash || "#/start").split("?")[0];
  STORE.ui.lastRoute = hash;
  saveStore();

  // If FLOW is open, we render overlay and keep main behind unchanged
  if(hash === "#/flow"){
    // keep behind content as Today (feels logical)
    renderToday(true);
    openFlowOverlay();
    updateChrome();
    return;
  }else{
    closeFlowOverlay();
  }

  const fn = Routes[hash] || renderStart;
  fn(false);
  updateChrome();
}

function cardHead(title, subtitle){
  return `
    <div class="row">
      <div>
        <div class="h1">${title}</div>
        ${subtitle ? `<div class="sub">${subtitle}</div>` : ``}
      </div>
    </div>
  `;
}

/* ---------------------------
   Start
----------------------------*/
function renderStart(){
  view.innerHTML = `
    <div class="sectionCard">
      ${cardHead("Start", "Pick a direction. Keep it calm.")}
      <div class="sep"></div>

      <div class="grid3">
        <div class="sectionCard">
          <div class="row">
            <div>
              <div class="badge blue">Today</div>
              <div class="sub">Plan tasks, done-by, focus style.</div>
            </div>
          </div>
          <div class="sep"></div>
          <button class="btn primary" data-go="#/today">Open Today</button>
        </div>

        <div class="sectionCard">
          <div class="row">
            <div>
              <div class="badge">Goals</div>
              <div class="sub">Effort, milestones, actions, scenarios.</div>
            </div>
          </div>
          <div class="sep"></div>
          <button class="btn primary" data-go="#/goals">Open Goals</button>
        </div>

        <div class="sectionCard">
          <div class="row">
            <div>
              <div class="badge gold">Flow</div>
              <div class="sub">Fullscreen focus + queue + timer.</div>
            </div>
          </div>
          <div class="sep"></div>
          <button class="btn primary" data-go="#/flow">Enter Flow</button>
        </div>
      </div>

      <div class="sep"></div>
      <div class="muted">
        SaverIoFlow is a flow-system. Keep your plan light. Execute in blocks. Forecast the rest.
      </div>
    </div>
  `;

  $$("[data-go]").forEach(b => b.addEventListener("click", () => navigate(b.getAttribute("data-go"))));
}

/* ---------------------------
   Today
----------------------------*/
function renderToday(isBehindFlow=false){
  const { total, done, pct } = computeTodayProgress();

  const tasks = STORE.today.tasks || [];
  const listHTML = tasks.length ? tasks.map(t => `
    <div class="item">
      <div>
        <div class="t">${escapeHTML(t.text)}</div>
        <div class="m">${t.source ? escapeHTML(t.source) : "task"} · ${t.done ? "done" : "open"}</div>
      </div>
      <div class="inlineBtns">
        <button class="btn soft" data-toggle="${t.id}">${t.done ? "Undo" : "Done"}</button>
        <button class="btn ghost" data-del="${t.id}">✕</button>
      </div>
    </div>
  `).join("") : `<div class="muted">No tasks yet. Add a simple block and one small step.</div>`;

  view.innerHTML = `
    <div class="sectionCard">
      ${cardHead("Today", "A clean queue you can actually finish.")}
      <div class="sep"></div>

      <div class="grid2">
        <div class="sectionCard">
          <div class="kpi">
            <div class="box">
              <div class="k">Completion</div>
              <div class="v">${pct}%</div>
            </div>
            <div class="box">
              <div class="k">Tasks</div>
              <div class="v">${done}/${total}</div>
            </div>
            <div class="box">
              <div class="k">Streak</div>
              <div class="v">${STORE.today.streak.count || 0}</div>
            </div>
          </div>

          <div class="sep"></div>

          <div class="grid2">
            <div>
              <label>Done-by</label>
              <input id="doneBy" value="${escapeAttr(STORE.today.doneBy||"")}" placeholder="17:00" />
            </div>
            <div>
              <label>Focus style</label>
              <select id="focusStyle">
                ${["Deep","Calm","Fast","Creative","Admin"].map(x => `<option ${x===STORE.today.focusStyle?"selected":""}>${x}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="sep"></div>

          <div class="inlineBtns">
            <button class="btn primary" id="btnRecommend">Recommendation</button>
            <button class="btn soft" id="btnTemplates">Templates</button>
            <button class="btn soft" id="btnFlow">Enter Flow</button>
          </div>

          <div class="help">
            Recommendation is intentionally calm: it suggests one focus block + one small step.
          </div>
        </div>

        <div class="sectionCard">
          <label>Quick add (multi-line)</label>
          <textarea id="quickAdd" placeholder="One task per line…"></textarea>
          <div class="inlineBtns" style="margin-top:10px;">
            <button class="btn primary" id="btnAddLines">Add</button>
            <button class="btn ghost" id="btnClearDone">Clear done</button>
          </div>
          <div class="help">Keep it short. A queue is not a wishlist.</div>
        </div>
      </div>

      <div class="sep"></div>

      <div class="sectionCard">
        <div class="row">
          <div class="rowL">
            <div class="badge ${pct>=70?"ok":""}">Queue</div>
            <div class="muted">${tasks.length ? "Tap Done to keep momentum." : "Add your first block."}</div>
          </div>
          <div class="inlineBtns">
            <button class="btn soft" id="btnAddOne">Add task</button>
          </div>
        </div>
        <div class="sep"></div>
        <div class="list">${listHTML}</div>
      </div>
    </div>
  `;

  // bindings
  $("#doneBy").addEventListener("change", (e) => {
    STORE.today.doneBy = safeText(e.target.value) || "17:00";
    saveStore(); updateChrome();
  });
  $("#focusStyle").addEventListener("change", (e) => {
    STORE.today.focusStyle = e.target.value;
    saveStore(); updateChrome();
  });

  $("#btnAddLines").addEventListener("click", () => {
    const lines = ($("#quickAdd").value || "").split("\n").map(safeText).filter(Boolean);
    if(!lines.length) return;
    lines.forEach(line => STORE.today.tasks.push({ id: uid(), text: line, done:false, createdAt: Date.now(), source:"manual" }));
    $("#quickAdd").value = "";
    saveStore(); render();
  });

  $("#btnAddOne").addEventListener("click", () => {
    openModal("Add task", `
      <label>Task</label>
      <input id="tText" placeholder="e.g., Flow block — 25 min" />
      <div class="help">Tip: keep tasks block-sized and specific.</div>
      <div class="modalFoot">
        <button class="btn soft" data-close="1">Cancel</button>
        <button class="btn primary" id="tAdd">Add</button>
      </div>
    `, {
      onMount(root){
        $("#tAdd", root).addEventListener("click", () => {
          const text = safeText($("#tText", root).value);
          if(!text) return;
          STORE.today.tasks.push({ id: uid(), text, done:false, createdAt: Date.now(), source:"manual" });
          saveStore(); closeModal(); render();
        });
      }
    });
  });

  $("#btnClearDone").addEventListener("click", () => {
    STORE.today.tasks = (STORE.today.tasks || []).filter(t => !t.done);
    saveStore(); render();
  });

  $("#btnTemplates").addEventListener("click", openTemplatesModal);
  $("#btnRecommend").addEventListener("click", openRecommendationModal);
  $("#btnFlow").addEventListener("click", () => navigate("#/flow"));

  $$("[data-toggle]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-toggle");
    const t = STORE.today.tasks.find(x => x.id === id);
    if(!t) return;
    t.done = !t.done;
    if(t.done) t.doneAt = Date.now();
    recomputeStreakIfCompleted();
    saveStore(); render();
  }));

  $$("[data-del]").forEach(b => b.addEventListener("click", () => {
    const id = b.getAttribute("data-del");
    STORE.today.tasks = STORE.today.tasks.filter(x => x.id !== id);
    saveStore(); render();
  }));

  if(isBehindFlow){
    // no-op; view stays as background
  }
}

function openTemplatesModal(){
  const list = TODAY_TEMPLATES.map((t,i) => `
    <div class="item">
      <div>
        <div class="t">${escapeHTML(t.name)}</div>
        <div class="m">${escapeHTML(t.lines.join(" · "))}</div>
      </div>
      <div class="inlineBtns">
        <button class="btn soft" data-apply="${i}">Add</button>
        <button class="btn ghost" data-replace="${i}">Replace</button>
      </div>
    </div>
  `).join("");

  openModal("Templates", `
    <div class="muted">Pick a calm starting shape. You can edit after.</div>
    <div class="sep"></div>
    <div class="list">${list}</div>
  `, {
    onMount(root){
      $$("[data-apply]", root).forEach(btn => btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-apply"));
        const tpl = TODAY_TEMPLATES[idx];
        tpl.lines.forEach(line => STORE.today.tasks.push({ id: uid(), text: line, done:false, createdAt: Date.now(), source:`template:${tpl.name}` }));
        saveStore(); closeModal(); render();
      }));
      $$("[data-replace]", root).forEach(btn => btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-replace"));
        const tpl = TODAY_TEMPLATES[idx];
        STORE.today.tasks = tpl.lines.map(line => ({ id: uid(), text: line, done:false, createdAt: Date.now(), source:`template:${tpl.name}` }));
        saveStore(); closeModal(); render();
      }));
    }
  });
}

function openRecommendationModal(){
  // calm heuristic: suggest one focus block + one small step
  const open = STORE.today.tasks.filter(t => !t.done);
  const focus = STORE.today.focusStyle || "Deep";
  const hasBlock = open.some(t => /flow block|pomodoro|focus/i.test(t.text));
  const hasSmall = open.some(t => /small step|10 min|micro/i.test(t.text));
  const recs = [];
  if(!hasBlock) recs.push(`Add: "Flow block — ${STORE.settings.pomodoro.focusMin} min"`);
  if(!hasSmall) recs.push(`Add: "Small step — 10 min"`);
  if(!recs.length) recs.push("Your queue already has a good shape. Enter Flow Mode and execute.");

  openModal("Recommendation", `
    <div class="kpi">
      <div class="box"><div class="k">Focus style</div><div class="v">${escapeHTML(focus)}</div></div>
      <div class="box"><div class="k">Open tasks</div><div class="v">${open.length}</div></div>
      <div class="box"><div class="k">Done-by</div><div class="v">${escapeHTML(STORE.today.doneBy||"—")}</div></div>
    </div>
    <div class="sep"></div>
    <div class="muted">${recs.map(r => `• ${escapeHTML(r)}`).join("<br/>")}</div>
    <div class="sep"></div>
    <div class="inlineBtns">
      <button class="btn primary" id="recApply">Apply</button>
      <button class="btn soft" id="recFlow">Enter Flow</button>
    </div>
  `, {
    onMount(root){
      $("#recApply", root).addEventListener("click", () => {
        if(!hasBlock) STORE.today.tasks.push({ id: uid(), text:`Flow block — ${STORE.settings.pomodoro.focusMin} min`, done:false, createdAt: Date.now(), source:"recommendation" });
        if(!hasSmall) STORE.today.tasks.push({ id: uid(), text:`Small step — 10 min`, done:false, createdAt: Date.now(), source:"recommendation" });
        saveStore(); closeModal(); render();
      });
      $("#recFlow", root).addEventListener("click", () => navigate("#/flow"));
    }
  });
}

/* ---------------------------
   Week
----------------------------*/
function getWeekDays(){
  const start = parseISO(STORE.week.startDate);
  return Array.from({length:7}, (_,i) => isoDate(addDays(start, i)));
}
function ensureWeekDay(dateStr){
  if(!STORE.week.days[dateStr]) STORE.week.days[dateStr] = { tasks: [] };
  if(!Array.isArray(STORE.week.days[dateStr].tasks)) STORE.week.days[dateStr].tasks = [];
  return STORE.week.days[dateStr];
}

function autoPlanWeek(){
  const days = getWeekDays();
  const defaults = [
    "Focus block — 25 min",
    "Small step — 10 min"
  ];
  days.forEach((d, idx) => {
    // weekdays only (Mon-Fri)
    if(idx > 4) return;
    const day = ensureWeekDay(d);
    if(day.tasks.length === 0){
      defaults.forEach(line => day.tasks.push({ id: uid(), text: line, done:false, createdAt: Date.now() }));
    }
  });
  saveStore();
}

function renderWeek(){
  // keep week start aligned to current week if needed
  const currentWS = isoDate(weekStartMonday());
  if(STORE.week.startDate !== currentWS){
    STORE.week.startDate = currentWS;
    saveStore();
  }

  const days = getWeekDays();
  const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const grid = days.map((d, i) => {
    const day = ensureWeekDay(d);
    const open = day.tasks.filter(t => !t.done).length;
    return `
      <div class="dayCell" data-day="${d}">
        <div class="d">${names[i]} · ${fmtShort(d).split(", ").slice(1).join(", ")}</div>
        <div class="n">${day.tasks.length} tasks · ${open} open</div>
      </div>
    `;
  }).join("");

  view.innerHTML = `
    <div class="sectionCard">
      ${cardHead("Week", "A light overview. Tap a day to edit.")}
      <div class="sep"></div>
      <div class="inlineBtns">
        <button class="btn primary" id="btnAutoWeek">Auto-plan</button>
      </div>
      <div class="sep"></div>
      <div class="weekGrid">${grid}</div>
      <div class="help">Auto-plan fills weekdays with a focus block + small step if empty.</div>
    </div>
  `;

  $("#btnAutoWeek").addEventListener("click", () => { autoPlanWeek(); render(); });

  $$(".dayCell").forEach(cell => cell.addEventListener("click", () => {
    const d = cell.getAttribute("data-day");
    openDayModal(d);
  }));
}

function openDayModal(dateStr){
  const day = ensureWeekDay(dateStr);

  const list = day.tasks.length ? day.tasks.map(t => `
    <div class="item">
      <div>
        <div class="t">${escapeHTML(t.text)}</div>
        <div class="m">${t.done ? "done" : "open"}</div>
      </div>
      <div class="inlineBtns">
        <button class="btn soft" data-toggle="${t.id}">${t.done ? "Undo" : "Done"}</button>
        <button class="btn ghost" data-del="${t.id}">✕</button>
        <button class="btn ghost" data-to-today="${t.id}">→ Today</button>
      </div>
    </div>
  `).join("") : `<div class="muted">No tasks for this day.</div>`;

  openModal(`Day · ${fmtShort(dateStr)}`, `
    <div class="grid2">
      <div>
        <label>Add task</label>
        <input id="dText" placeholder="One focused item…" />
      </div>
      <div>
        <label>Quick</label>
        <button class="btn soft" id="dAdd">Add</button>
      </div>
    </div>
    <div class="sep"></div>
    <div class="list">${list}</div>
  `, {
    onMount(root){
      $("#dAdd", root).addEventListener("click", () => {
        const text = safeText($("#dText", root).value);
        if(!text) return;
        day.tasks.push({ id: uid(), text, done:false, createdAt: Date.now() });
        saveStore();
        closeModal();
        openDayModal(dateStr);
      });

      $$("[data-toggle]", root).forEach(btn => btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle");
        const t = day.tasks.find(x => x.id === id);
        if(!t) return;
        t.done = !t.done;
        saveStore();
        closeModal();
        openDayModal(dateStr);
      }));

      $$("[data-del]", root).forEach(btn => btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        day.tasks = day.tasks.filter(x => x.id !== id);
        saveStore();
        closeModal();
        openDayModal(dateStr);
      }));

      $$("[data-to-today]", root).forEach(btn => btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-to-today");
        const t = day.tasks.find(x => x.id === id);
        if(!t) return;
        STORE.today.tasks.push({ id: uid(), text: t.text, done:false, createdAt: Date.now(), source:`week:${dateStr}` });
        saveStore();
        closeModal();
        render();
      }));
    }
  });
}

/* ---------------------------
   Goals
----------------------------*/
function createGoal({ title, category="build", totalEffortHours=20, minutesPerDay=30 }){
  const g = {
    id: uid(),
    title: safeText(title) || "Untitled goal",
    category,
    totalEffortHours: Number(totalEffortHours) || 20,
    minutesPerDay: Number(minutesPerDay) || 30,
    createdAt: Date.now(),
    milestones: []
  };
  STORE.goals.push(g);
  STORE.ui.goalsSelectedId = g.id;
  saveStore();
  return g;
}

function renderGoals(){
  const selected = STORE.ui.goalsSelectedId;
  const goals = STORE.goals || [];
  const activeId = selected || (goals[0]?.id || null);
  STORE.ui.goalsSelectedId = activeId;
  saveStore();

  const left = goals.length ? goals.map(g => `
    <div class="item ${g.id===activeId?"active":""}" data-gsel="${g.id}">
      <div>
        <div class="t">${escapeHTML(g.title)}</div>
        <div class="m">${escapeHTML(g.category)} · ${g.totalEffortHours}h · ${g.minutesPerDay} min/day</div>
      </div>
      <div class="badge ${g.category==="income"?"gold":"blue"}">${escapeHTML(g.category)}</div>
    </div>
  `).join("") : `<div class="muted">No goals yet. Create one and generate milestones.</div>`;

  const g = goals.find(x => x.id === activeId) || null;
  const right = g ? goalDetailHTML(g) : `
    <div class="sectionCard">
      <div class="h1">Goals</div>
      <div class="sub">Create your first goal.</div>
      <div class="sep"></div>
      <button class="btn primary" id="newGoal">New goal</button>
    </div>
  `;

  view.innerHTML = `
    <div class="goalLayout">
      <div class="sectionCard goalList">
        <div class="row">
          <div>
            <div class="h1">Goals</div>
            <div class="sub">Effort, milestones, actions, forecast.</div>
          </div>
          <button class="btn primary" id="newGoal">New</button>
        </div>
        <div class="sep"></div>
        <div class="list">${left}</div>
      </div>
      <div class="sectionCard goalDetail">${right}</div>
    </div>
  `;

  $("#newGoal")?.addEventListener("click", openNewGoalModal);
  $$("[data-gsel]").forEach(el => el.addEventListener("click", () => {
    STORE.ui.goalsSelectedId = el.getAttribute("data-gsel");
    saveStore(); render();
  }));

  if(g) bindGoalDetail(g);
}

function goalDetailHTML(g){
  const ms = g.milestones || [];
  const actionsOpen = ms.flatMap(m => (m.actions||[])).filter(a => !a.done).length;
  const actionsTotal = ms.flatMap(m => (m.actions||[])).length;

  return `
    <div class="row">
      <div>
        <h2>${escapeHTML(g.title)}</h2>
        <div class="sub">${escapeHTML(g.category)} · ${g.totalEffortHours}h total · ${g.minutesPerDay} min/day</div>
      </div>
      <div class="inlineBtns">
        <button class="btn soft" id="btnGoalGraph">Graph</button>
        <button class="btn soft" id="btnScenarios">Scenarios</button>
        <button class="btn danger" id="btnDelGoal">Delete</button>
      </div>
    </div>

    <div class="sep"></div>

    <div class="grid2">
      <div>
        <label>Total effort (hours)</label>
        <input id="gEffort" type="number" min="1" step="1" value="${escapeAttr(g.totalEffortHours)}" />
      </div>
      <div>
        <label>Minutes / day</label>
        <input id="gMinDay" type="number" min="10" step="5" value="${escapeAttr(g.minutesPerDay)}" />
      </div>
    </div>

    <div class="sep"></div>

    <div class="kpi">
      <div class="box"><div class="k">Actions</div><div class="v">${actionsTotal}</div></div>
      <div class="box"><div class="k">Open</div><div class="v">${actionsOpen}</div></div>
      <div class="box"><div class="k">Forecast (base)</div><div class="v">${escapeHTML(baseEtaString(g))}</div></div>
    </div>

    <div class="sep"></div>

    <div class="inlineBtns">
      <button class="btn primary" id="btnAutoMs">Auto milestones</button>
      <button class="btn soft" id="btnAddMs">Add milestone</button>
      <button class="btn soft" id="btnAddFocusToday">Add focus to Today</button>
    </div>

    <div class="sep"></div>

    <div class="list">
      ${ms.length ? ms.map(m => milestoneHTML(g, m)).join("") : `<div class="muted">No milestones yet. Generate a clean path.</div>`}
    </div>
  `;
}

function milestoneHTML(g, m){
  const actions = m.actions || [];
  const doneCount = actions.filter(a=>a.done).length;
  return `
    <div class="sectionCard" style="padding:14px;">
      <div class="row">
        <div>
          <div class="rowL">
            <span class="badge ${m.done?"ok":"blue"}">${m.done ? "done" : "active"}</span>
            <div class="t" style="font-size:14px;">${escapeHTML(m.title)}</div>
          </div>
          <div class="m" style="margin-top:6px;color:rgba(255,255,255,.55);font-size:12px;">
            ${doneCount}/${actions.length} actions done
          </div>
        </div>
        <div class="inlineBtns">
          <button class="btn soft" data-msadd="${m.id}">Add action</button>
          <button class="btn ghost" data-msdel="${m.id}">Delete</button>
        </div>
      </div>
      <div class="sep"></div>
      <div class="list">
        ${actions.length ? actions.map(a => `
          <div class="item">
            <div>
              <div class="t">${escapeHTML(a.text)}</div>
              <div class="m">${a.done ? "done" : "open"}</div>
            </div>
            <div class="inlineBtns">
              <button class="btn soft" data-atog="${m.id}:${a.id}">${a.done ? "Undo" : "Done"}</button>
              <button class="btn ghost" data-adel="${m.id}:${a.id}">✕</button>
              <button class="btn ghost" data-a2t="${m.id}:${a.id}">→ Today</button>
            </div>
          </div>
        `).join("") : `<div class="muted">No actions yet.</div>`}
      </div>
    </div>
  `;
}

function bindGoalDetail(g){
  $("#gEffort").addEventListener("change", (e) => {
    g.totalEffortHours = clamp(Number(e.target.value)||1, 1, 5000);
    saveStore(); render();
  });
  $("#gMinDay").addEventListener("change", (e) => {
    g.minutesPerDay = clamp(Number(e.target.value)||10, 10, 300);
    saveStore(); render();
  });

  $("#btnAddMs").addEventListener("click", () => {
    openModal("Add milestone", `
      <label>Milestone title</label>
      <input id="msTitle" placeholder="e.g., MVP scope" />
      <div class="modalFoot">
        <button class="btn soft" data-close="1">Cancel</button>
        <button class="btn primary" id="msAdd">Add</button>
      </div>
    `, {
      onMount(root){
        $("#msAdd", root).addEventListener("click", () => {
          const title = safeText($("#msTitle", root).value);
          if(!title) return;
          g.milestones.push({ id: uid(), title, done:false, actions: [] });
          saveStore(); closeModal(); render();
        });
      }
    });
  });

  $("#btnAddFocusToday").addEventListener("click", () => {
    STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${STORE.settings.pomodoro.focusMin} min`, done:false, createdAt: Date.now(), source:`goal:${g.id}` });
    saveStore(); render();
  });

  $("#btnDelGoal").addEventListener("click", () => {
    openModal("Delete goal", `
      <div class="muted">This will remove the goal and all milestones/actions.</div>
      <div class="modalFoot">
        <button class="btn soft" data-close="1">Cancel</button>
        <button class="btn danger" id="delYes">Delete</button>
      </div>
    `, {
      onMount(root){
        $("#delYes", root).addEventListener("click", () => {
          STORE.goals = STORE.goals.filter(x => x.id !== g.id);
          STORE.ui.goalsSelectedId = STORE.goals[0]?.id || null;
          saveStore(); closeModal(); render();
        });
      }
    });
  });

  $("#btnAutoMs").addEventListener("click", () => openAutoMilestonesModal(g));
  $("#btnGoalGraph").addEventListener("click", () => openGoalGraphModal(g));
  $("#btnScenarios").addEventListener("click", () => openScenariosModal(g));

  $$("[data-msadd]").forEach(b => b.addEventListener("click", () => {
    const msId = b.getAttribute("data-msadd");
    const m = g.milestones.find(x => x.id === msId);
    if(!m) return;
    openModal("Add action", `
      <label>Action</label>
      <input id="aText" placeholder="Specific, block-sized…" />
      <div class="modalFoot">
        <button class="btn soft" data-close="1">Cancel</button>
        <button class="btn primary" id="aAdd">Add</button>
      </div>
    `, {
      onMount(root){
        $("#aAdd", root).addEventListener("click", () => {
          const text = safeText($("#aText", root).value);
          if(!text) return;
          m.actions.push({ id: uid(), text, done:false });
          saveStore(); closeModal(); render();
        });
      }
    });
  }));

  $$("[data-msdel]").forEach(b => b.addEventListener("click", () => {
    const msId = b.getAttribute("data-msdel");
    g.milestones = g.milestones.filter(x => x.id !== msId);
    saveStore(); render();
  }));

  $$("[data-atog]").forEach(b => b.addEventListener("click", () => {
    const [msId, aId] = b.getAttribute("data-atog").split(":");
    const m = g.milestones.find(x => x.id === msId);
    if(!m) return;
    const a = (m.actions||[]).find(x => x.id === aId);
    if(!a) return;
    a.done = !a.done;
    // milestone done if all actions done and has actions
    m.done = (m.actions.length > 0 && m.actions.every(x=>x.done));
    saveStore(); render();
  }));

  $$("[data-adel]").forEach(b => b.addEventListener("click", () => {
    const [msId, aId] = b.getAttribute("data-adel").split(":");
    const m = g.milestones.find(x => x.id === msId);
    if(!m) return;
    m.actions = (m.actions||[]).filter(x => x.id !== aId);
    m.done = (m.actions.length > 0 && m.actions.every(x=>x.done));
    saveStore(); render();
  }));

  $$("[data-a2t]").forEach(b => b.addEventListener("click", () => {
    const [msId, aId] = b.getAttribute("data-a2t").split(":");
    const m = g.milestones.find(x => x.id === msId);
    if(!m) return;
    const a = (m.actions||[]).find(x => x.id === aId);
    if(!a) return;
    STORE.today.tasks.push({ id: uid(), text:`${g.title}: ${a.text}`, done:false, createdAt: Date.now(), source:`goal-action:${g.id}` });
    saveStore(); render();
  }));
}

function openNewGoalModal(){
  openModal("New goal", `
    <div class="grid2">
      <div>
        <label>Goal title</label>
        <input id="ngTitle" placeholder="e.g., Launch MVP" />
      </div>
      <div>
        <label>Category</label>
        <select id="ngCat">
          ${["clarity","skill","build","health","income"].map(x=>`<option>${x}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="grid2" style="margin-top:12px;">
      <div>
        <label>Total effort (hours)</label>
        <input id="ngEffort" type="number" min="1" step="1" value="20" />
      </div>
      <div>
        <label>Minutes / day</label>
        <input id="ngMin" type="number" min="10" step="5" value="30" />
      </div>
    </div>
    <div class="modalFoot">
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="ngCreate">Create</button>
    </div>
  `, {
    onMount(root){
      $("#ngCreate", root).addEventListener("click", () => {
        const title = safeText($("#ngTitle", root).value);
        const category = $("#ngCat", root).value;
        const effort = Number($("#ngEffort", root).value)||20;
        const min = Number($("#ngMin", root).value)||30;
        createGoal({ title, category, totalEffortHours: effort, minutesPerDay: min });
        saveStore(); closeModal(); render();
      });
    }
  });
}

function openAutoMilestonesModal(g){
  openModal("Auto milestones", `
    <div class="muted">Choose a template. You can replace or append. Minutes/day scales the plan.</div>
    <div class="sep"></div>

    <div class="grid2">
      <div>
        <label>Template</label>
        <select id="amType">
          ${["clarity","skill","build","health","income"].map(x=>`<option ${x===g.category?"selected":""}>${x}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Mode</label>
        <select id="amMode">
          <option value="replace">Replace milestones</option>
          <option value="append">Append milestones</option>
        </select>
      </div>
    </div>

    <div style="margin-top:12px;">
      <label><input type="checkbox" id="amAddToday" /> Add focus to Today after generating</label>
    </div>

    <div class="modalFoot">
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="amApply">Generate</button>
    </div>
  `, {
    onMount(root){
      $("#amApply", root).addEventListener("click", () => {
        const type = $("#amType", root).value;
        const mode = $("#amMode", root).value;
        const addToday = $("#amAddToday", root).checked;

        const tpl = MILESTONE_TEMPLATES[type] ? MILESTONE_TEMPLATES[type](g.title) : MILESTONE_TEMPLATES.build(g.title);
        const ms = scaleMilestonesByMinutes(g.minutesPerDay, tpl).map(m => ({
          id: uid(),
          title: m.title,
          done:false,
          actions: (m.actions||[]).map(a => ({ id: a.id || uid(), text: a.text || a, done:false }))
        }));

        if(mode === "replace") g.milestones = ms;
        else g.milestones = (g.milestones||[]).concat(ms);

        if(addToday){
          STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${STORE.settings.pomodoro.focusMin} min`, done:false, createdAt: Date.now(), source:`goal:${g.id}` });
        }

        saveStore(); closeModal(); render();
      });
    }
  });
}

function openGoalGraphModal(g){
  // Simple vertical SVG nodes: done=gold, active=blue, upcoming=dark
  const ms = g.milestones || [];
  const h = 90 + ms.length * 72;
  const nodes = ms.map((m, i) => {
    const y = 50 + i*72;
    const isDone = !!m.done;
    const isActive = !isDone && (i === ms.findIndex(x => !x.done));
    const fill = isDone ? "rgba(205,160,60,.85)" : (isActive ? "rgba(80,140,255,.85)" : "rgba(255,255,255,.14)");
    const stroke = isDone ? "rgba(205,160,60,.95)" : (isActive ? "rgba(80,140,255,.95)" : "rgba(255,255,255,.18)");
    return `
      ${i>0 ? `<line x1="70" y1="${y-72}" x2="70" y2="${y-14}" stroke="rgba(255,255,255,.12)" stroke-width="2"/>` : ``}
      <circle cx="70" cy="${y}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="98" y="${y+4}" fill="rgba(255,255,255,.86)" font-size="12">${escapeXML(m.title)}</text>
    `;
  }).join("");

  openModal("Goal graph", `
    <div class="muted">Progress in one vertical line. Done = gold. Active = blue.</div>
    <div class="sep"></div>
    <div class="sectionCard" style="padding:14px; background: rgba(0,0,0,.22);">
      <svg width="100%" height="${h}" viewBox="0 0 760 ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${nodes || `<text x="20" y="40" fill="rgba(255,255,255,.62)" font-size="12">No milestones yet.</text>`}
      </svg>
    </div>
  `);
}

function baseEtaString(g){
  // base: 5 days/week, 100% efficiency
  const daysPerWeek = 5;
  const eff = 1;
  const minutesDay = clamp(Number(g.minutesPerDay)||30, 10, 300);
  const weeklyHours = (minutesDay * daysPerWeek / 60) * eff;
  if(weeklyHours <= 0.01) return "—";
  const weeks = (Number(g.totalEffortHours)||1) / weeklyHours;
  return `${weeks.toFixed(1)} w`;
}

function scenarioEta(g, minutesPerDay, daysPerWeek, efficiencyPct){
  const eff = clamp(Number(efficiencyPct)||100, 50, 100) / 100;
  const mpd = clamp(Number(minutesPerDay)||30, 10, 300);
  const dpw = clamp(Number(daysPerWeek)||5, 1, 7);
  const weeklyHours = (mpd * dpw / 60) * eff;
  if(weeklyHours <= 0.001) return { weeks: Infinity, date: null };
  const weeks = (Number(g.totalEffortHours)||1) / weeklyHours;
  const days = Math.ceil(weeks * 7);
  const target = addDays(new Date(), days);
  const date = isoDate(target);
  return { weeks, date, weeklyHours };
}

function openScenariosModal(g){
  openModal("Forecast scenarios", `
    <div class="muted">Adjust rhythm and efficiency. Compare minutes/day scenarios. Apply best as a Today task.</div>
    <div class="sep"></div>

    <div class="grid2">
      <div>
        <label>Days / week</label>
        <input id="scDays" type="number" min="1" max="7" step="1" value="5" />
      </div>
      <div>
        <label>Efficiency (%)</label>
        <input id="scEff" type="number" min="50" max="100" step="5" value="85" />
      </div>
    </div>

    <div class="sep"></div>

    <div class="sectionCard" style="padding:14px;">
      <div class="muted" id="scTable"></div>
    </div>

    <div class="modalFoot">
      <button class="btn soft" data-close="1">Close</button>
      <button class="btn primary" id="scApplyBest">Apply best to Today</button>
    </div>
  `, {
    onMount(root){
      const mins = [15,30,45,60,90];
      const tableEl = $("#scTable", root);

      function renderTable(){
        const dpw = Number($("#scDays", root).value)||5;
        const eff = Number($("#scEff", root).value)||85;
        const rows = mins.map(m => {
          const r = scenarioEta(g, m, dpw, eff);
          const weeks = isFinite(r.weeks) ? r.weeks.toFixed(1) : "—";
          const date = r.date ? fmtShort(r.date) : "—";
          return { m, weeks, date, weeklyHours: r.weeklyHours || 0 };
        });

        const best = rows.slice().sort((a,b)=>a.weeks-b.weeks)[0];

        tableEl.innerHTML = rows.map(r => {
          const isBest = (r.m === best.m);
          return `
            <div class="item ${isBest ? "active":""}" data-min="${r.m}">
              <div>
                <div class="t">${r.m} min/day</div>
                <div class="m">ETA: ${r.weeks} w · ${r.date}</div>
              </div>
              <div class="badge ${isBest?"gold":"blue"}">${minutesToHHMM(Math.round(r.weeklyHours*60))}/week</div>
            </div>
          `;
        }).join("");

        // store best for apply
        root.__best = best;
      }

      $("#scDays", root).addEventListener("input", renderTable);
      $("#scEff", root).addEventListener("input", renderTable);
      renderTable();

      $("#scApplyBest", root).addEventListener("click", () => {
        const dpw = Number($("#scDays", root).value)||5;
        const eff = Number($("#scEff", root).value)||85;
        const best = root.__best || { m: 30 };

        STORE.today.tasks.push({
          id: uid(),
          text: `Forecast: ${g.title} — ${best.m} min/day · ${dpw}d/w · ${eff}%`,
          done:false,
          createdAt: Date.now(),
          source:`scenario:${g.id}`
        });
        saveStore(); closeModal(); render();
      });
    }
  });
}

/* ---------------------------
   Discover
----------------------------*/
function renderDiscover(){
  view.innerHTML = `
    <div class="sectionCard">
      ${cardHead("Discover", "Generate options. Create a goal. Auto-plan a wow moment.")}
      <div class="sep"></div>

      <div class="grid2">
        <div class="sectionCard">
          <label>Focus type</label>
          <select id="dcType">
            ${["build","skill","health","income","clarity"].map(x=>`<option>${x}</option>`).join("")}
          </select>

          <div style="margin-top:12px;">
            <label>Minutes / day</label>
            <input id="dcMin" type="number" min="10" step="5" value="30" />
          </div>

          <div class="sep"></div>
          <div class="inlineBtns">
            <button class="btn primary" id="dcGen">Generate</button>
            <button class="btn soft" id="dcWow">Generate + auto-plan</button>
          </div>
          <div class="help">This is offline: options are generated from curated patterns.</div>
        </div>

        <div class="sectionCard">
          <div class="badge">Options</div>
          <div class="sep"></div>
          <div class="list" id="dcList">
            <div class="muted">Generate 3 options to choose from.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  $("#dcGen").addEventListener("click", () => {
    const type = $("#dcType").value;
    const min = clamp(Number($("#dcMin").value)||30, 10, 180);
    const opts = generateGoalOptions(type, min);
    renderDiscoverOptions(opts, min, type);
  });

  $("#dcWow").addEventListener("click", () => {
    const type = $("#dcType").value;
    const min = clamp(Number($("#dcMin").value)||30, 10, 180);
    const opts = generateGoalOptions(type, min);
    const pick = opts[0] || "New goal";
    const g = createGoal({ title: pick, category: type, totalEffortHours: 20, minutesPerDay: min });

    // auto milestones + add focus to today
    const tpl = (MILESTONE_TEMPLATES[type] ? MILESTONE_TEMPLATES[type](g.title) : MILESTONE_TEMPLATES.build(g.title));
    const ms = scaleMilestonesByMinutes(g.minutesPerDay, tpl).map(m => ({
      id: uid(),
      title: m.title,
      done:false,
      actions: (m.actions||[]).map(a => ({ id: uid(), text: a.text || a, done:false }))
    }));
    g.milestones = ms;

    STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${STORE.settings.pomodoro.focusMin} min`, done:false, createdAt: Date.now(), source:"discover-wow" });
    saveStore();
    navigate("#/goals");
  });
}

function generateGoalOptions(type, min){
  const intensity = min >= 60 ? "Deep" : (min >= 30 ? "Steady" : "Light");
  const bank = {
    build: [
      `${intensity} MVP sprint`,
      `Ship a landing + onboarding`,
      `Build the core loop v1`
    ],
    skill: [
      `${intensity} practice plan`,
      `Learn by building 3 small projects`,
      `Skill ladder: fundamentals → output`
    ],
    health: [
      `${intensity} fitness routine`,
      `Consistency plan: 30 days`,
      `Sleep + energy reset`
    ],
    income: [
      `${intensity} offer + outreach`,
      `Build a simple funnel`,
      `10 conversations per week`
    ],
    clarity: [
      `${intensity} define “done”`,
      `Reduce scope, increase finish`,
      `Pick one outcome for 6 weeks`
    ]
  };
  const arr = bank[type] || bank.build;
  // return 3
  return arr.slice(0,3);
}

function renderDiscoverOptions(opts, min, type){
  const list = $("#dcList");
  list.innerHTML = opts.map((t,i)=>`
    <div class="item">
      <div>
        <div class="t">${escapeHTML(t)}</div>
        <div class="m">${escapeHTML(type)} · ${min} min/day</div>
      </div>
      <div class="inlineBtns">
        <button class="btn soft" data-dccreate="${i}">Create</button>
        <button class="btn ghost" data-dcwow="${i}">Create + auto-plan</button>
      </div>
    </div>
  `).join("");

  $$("[data-dccreate]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.getAttribute("data-dccreate"));
    const g = createGoal({ title: opts[i], category: type, totalEffortHours: 20, minutesPerDay: min });
    saveStore(); navigate("#/goals");
  }));
  $$("[data-dcwow]").forEach(btn => btn.addEventListener("click", () => {
    const i = Number(btn.getAttribute("data-dcwow"));
    const g = createGoal({ title: opts[i], category: type, totalEffortHours: 20, minutesPerDay: min });

    const tpl = (MILESTONE_TEMPLATES[type] ? MILESTONE_TEMPLATES[type](g.title) : MILESTONE_TEMPLATES.build(g.title));
    g.milestones = scaleMilestonesByMinutes(g.minutesPerDay, tpl).map(m => ({
      id: uid(), title: m.title, done:false,
      actions: (m.actions||[]).map(a => ({ id: uid(), text: a.text || a, done:false }))
    }));

    STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${STORE.settings.pomodoro.focusMin} min`, done:false, createdAt: Date.now(), source:"discover" });
    saveStore(); navigate("#/goals");
  }));
}

/* ---------------------------
   FLOW MODE (Overlay)
----------------------------*/
let flowOverlayEl = null;
let flowTimer = {
  running: false,
  mode: "focus", // focus | break | longbreak
  remainingSec: 0,
  cycle: 1,
  selectedTaskId: null,
  includeGoalActions: false,
  tickHandle: null
};

function renderFlow(){
  // route exists but overlay handles UI
  view.innerHTML = `
    <div class="sectionCard">
      ${cardHead("Flow", "Fullscreen mode is opening…")}
      <div class="sub">If it doesn’t, click “Flow” in the topbar.</div>
      <div class="sep"></div>
      <button class="btn primary" data-go="#/flow">Open Flow Mode</button>
    </div>
  `;
  $$("[data-go]").forEach(b => b.addEventListener("click", () => navigate("#/flow")));
}

function closeFlowOverlay(){
  if(flowOverlayEl){
    flowOverlayEl.remove();
    flowOverlayEl = null;
  }
  stopFlowTick();
}

function openFlowOverlay(){
  if(flowOverlayEl) return;

  // init timer if empty
  if(flowTimer.remainingSec <= 0){
    flowTimer.mode = "focus";
    flowTimer.remainingSec = (STORE.settings.pomodoro.focusMin || 25) * 60;
    flowTimer.cycle = flowTimer.cycle || 1;
  }

  flowOverlayEl = document.createElement("div");
  flowOverlayEl.className = "flow-root";
  flowOverlayEl.innerHTML = `
    <div class="flow-top">
      <div class="flow-brand">
        <span style="width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);display:grid;place-items:center;">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 1.8c2.6 2.3 4 4.6 4 7.1 0 3.2-2 5.3-4 7.3-2-2-4-4.1-4-7.3 0-2.5 1.4-4.8 4-7.1Z" stroke="rgba(255,255,255,.9)" stroke-width="1.2"/>
            <path d="M9 5.1v9.9" stroke="rgba(255,255,255,.9)" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </span>
        <span>Flow Mode</span>
      </div>

      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span class="flow-pill" id="flowPillMode">Focus</span>
        <span class="flow-pill" id="flowPillCycle">Cycle 1</span>
        <label class="flow-pill" style="cursor:pointer;">
          <input type="checkbox" id="flowInclActions" style="margin:0 8px 0 0; width:auto;" />
          Include goal actions
        </label>
        <button class="flow-btn ghost" id="flowExit">Exit</button>
      </div>
    </div>

    <div class="flow-main">
      <div class="flow-card">
        <div class="flow-panel flow-left">
          <div class="flow-orbs" aria-hidden="true">
            <span class="flow-orb" style="left:-18%;top:-20%;"></span>
            <span class="flow-orb o2" style="right:-22%;top:-10%;"></span>
            <span class="flow-orb o3" style="left:12%;bottom:-28%;"></span>
          </div>

          <div class="flow-timerWrap">
            <div class="flow-time" id="flowTime">00:00</div>
            <div class="flow-sub" id="flowSub">
              Choose a task. Start the timer. Keep the queue calm.
            </div>
          </div>

          <div class="flow-taskNow">
            <div class="label">Current</div>
            <div class="title" id="flowCurrentTitle">—</div>
            <div class="flow-next" id="flowNext">Next: —</div>
          </div>

          <div class="flow-controls">
            <button class="flow-btn primary" id="flowStart">Start</button>
            <button class="flow-btn" id="flowPause">Pause</button>
            <button class="flow-btn" id="flowComplete">Complete</button>
            <button class="flow-btn" id="flowSkip">Skip</button>
            <button class="flow-btn" id="flowBreak">Break</button>
            <button class="flow-btn ghost" id="flowNote">Distraction note</button>
          </div>

          <div class="help" style="margin-top:12px;">
            Complete marks the task done in Today. Notes are stored locally for the day.
          </div>
        </div>

        <div class="flow-panel flow-right">
          <div class="flow-queueTitle">
            <h3>Queue</h3>
            <div class="flow-mini" id="flowQueueMeta">—</div>
          </div>
          <div class="flow-list" id="flowList"></div>
          <div class="sep" style="margin:12px 0;"></div>

          <div class="flow-queueTitle">
            <h3>Timer</h3>
            <div class="flow-mini">Pomodoro-ish</div>
          </div>

          <div class="grid2">
            <div>
              <label>Focus (min)</label>
              <input id="flowFocusMin" type="number" min="10" step="5" />
            </div>
            <div>
              <label>Break (min)</label>
              <input id="flowBreakMin" type="number" min="3" step="1" />
            </div>
          </div>

          <div class="grid2" style="margin-top:10px;">
            <div>
              <label>Long break (min)</label>
              <input id="flowLongMin" type="number" min="5" step="5" />
            </div>
            <div>
              <label>Long every (cycles)</label>
              <input id="flowLongEvery" type="number" min="2" step="1" />
            </div>
          </div>

          <div class="help">Settings persist locally. Reduced-motion is respected.</div>
        </div>
      </div>
    </div>

    <div class="flow-footer">
      <div>Calm execution · one task at a time</div>
      <div id="flowFootHint">Press Esc to exit</div>
    </div>
  `;

  document.body.appendChild(flowOverlayEl);

  // init checkboxes & inputs
  $("#flowInclActions", flowOverlayEl).checked = !!flowTimer.includeGoalActions;
  $("#flowFocusMin", flowOverlayEl).value = STORE.settings.pomodoro.focusMin || 25;
  $("#flowBreakMin", flowOverlayEl).value = STORE.settings.pomodoro.breakMin || 5;
  $("#flowLongMin", flowOverlayEl).value = STORE.settings.pomodoro.longBreakMin || 15;
  $("#flowLongEvery", flowOverlayEl).value = STORE.settings.pomodoro.cyclesBeforeLong || 4;

  // fill list and state
  flowTimer.selectedTaskId = flowTimer.selectedTaskId || pickFirstOpenTaskId();
  syncFlowUI();

  // bindings
  $("#flowExit", flowOverlayEl).addEventListener("click", () => {
    navigate("#/today");
  });

  $("#flowInclActions", flowOverlayEl).addEventListener("change", (e) => {
    flowTimer.includeGoalActions = !!e.target.checked;
    syncFlowUI();
  });

  $("#flowStart", flowOverlayEl).addEventListener("click", startFlow);
  $("#flowPause", flowOverlayEl).addEventListener("click", pauseFlow);
  $("#flowSkip", flowOverlayEl).addEventListener("click", skipFlowTask);
  $("#flowComplete", flowOverlayEl).addEventListener("click", completeFlowTask);
  $("#flowBreak", flowOverlayEl).addEventListener("click", startBreakNow);
  $("#flowNote", flowOverlayEl).addEventListener("click", openDistractionModal);

  // settings
  ["flowFocusMin","flowBreakMin","flowLongMin","flowLongEvery"].forEach(id => {
    $(`#${id}`, flowOverlayEl).addEventListener("change", () => {
      STORE.settings.pomodoro.focusMin = clamp(Number($("#flowFocusMin", flowOverlayEl).value)||25, 10, 180);
      STORE.settings.pomodoro.breakMin = clamp(Number($("#flowBreakMin", flowOverlayEl).value)||5, 3, 60);
      STORE.settings.pomodoro.longBreakMin = clamp(Number($("#flowLongMin", flowOverlayEl).value)||15, 5, 90);
      STORE.settings.pomodoro.cyclesBeforeLong = clamp(Number($("#flowLongEvery", flowOverlayEl).value)||4, 2, 10);
      saveStore();
      // if not running and currently focus mode, align remaining to new focus duration
      if(!flowTimer.running && flowTimer.mode === "focus"){
        flowTimer.remainingSec = STORE.settings.pomodoro.focusMin * 60;
      }
      syncFlowUI();
    });
  });

  // Esc to exit
  const onKey = (e) => {
    if(e.key === "Escape"){
      navigate("#/today");
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
}

function pickFirstOpenTaskId(){
  const queue = buildFlowQueue();
  return queue[0]?.id || null;
}

function buildFlowQueue(){
  const todayOpen = (STORE.today.tasks || []).filter(t => !t.done).map(t => ({
    id: t.id,
    text: t.text,
    meta: t.source ? `Today · ${t.source}` : "Today",
    kind: "today"
  }));

  if(!flowTimer.includeGoalActions) return todayOpen;

  // add goal actions (undone) from selected goal or first goal
  const gId = STORE.ui.goalsSelectedId || STORE.goals[0]?.id || null;
  const g = STORE.goals.find(x => x.id === gId) || null;
  if(!g) return todayOpen;

  const actions = (g.milestones || []).flatMap(m => (m.actions||[]).map(a => ({ m, a })))
    .filter(x => !x.a.done)
    .slice(0, 12)
    .map(x => ({
      id: `ga:${g.id}:${x.m.id}:${x.a.id}`,
      text: `${g.title}: ${x.a.text}`,
      meta: `Goal action · ${g.title}`,
      kind: "goalAction",
      goalId: g.id,
      msId: x.m.id,
      actionId: x.a.id
    }));

  // merge: Today tasks first, then goal actions
  return todayOpen.concat(actions);
}

function syncFlowUI(){
  if(!flowOverlayEl) return;

  // pills
  $("#flowPillMode", flowOverlayEl).textContent =
    flowTimer.mode === "focus" ? "Focus" :
    flowTimer.mode === "break" ? "Break" : "Long break";
  $("#flowPillCycle", flowOverlayEl).textContent = `Cycle ${flowTimer.cycle}`;

  // timer display
  $("#flowTime", flowOverlayEl).textContent = formatTime(flowTimer.remainingSec);

  const queue = buildFlowQueue();
  const selected = queue.find(x => x.id === flowTimer.selectedTaskId) || queue[0] || null;
  if(!selected && queue[0]) flowTimer.selectedTaskId = queue[0].id;

  const currentTitle = selected ? selected.text : "No open tasks";
  $("#flowCurrentTitle", flowOverlayEl).textContent = currentTitle;

  const next = selected ? queue[queue.findIndex(x=>x.id===selected.id)+1] : null;
  $("#flowNext", flowOverlayEl).textContent = `Next: ${next ? next.text : "—"}`;

  // queue list
  $("#flowQueueMeta", flowOverlayEl).textContent = `${queue.length} items`;
  const list = $("#flowList", flowOverlayEl);
  list.innerHTML = queue.length ? queue.map(x => `
    <div class="flow-item ${x.id===flowTimer.selectedTaskId?"active":""}" data-q="${escapeAttr(x.id)}">
      <div>
        <div class="t">${escapeHTML(x.text)}</div>
        <div class="m">${escapeHTML(x.meta)}</div>
      </div>
      <div class="badge ${x.kind==="goalAction"?"blue":"gold"}">${x.kind==="goalAction"?"Action":"Task"}</div>
    </div>
  `).join("") : `<div class="muted">Nothing open. Add a task in Today.</div>`;

  $$("[data-q]", flowOverlayEl).forEach(el => el.addEventListener("click", () => {
    flowTimer.selectedTaskId = el.getAttribute("data-q");
    syncFlowUI();
  }));

  // subline
  const sub = $("#flowSub", flowOverlayEl);
  if(flowTimer.mode === "focus"){
    sub.textContent = flowTimer.running
      ? "Stay with the current task. If you drift, add a note — then return."
      : "Choose a task. Start when you’re ready.";
  }else{
    sub.textContent = flowTimer.running
      ? "Break means recovery. Keep it quiet."
      : "Start a break when you need it.";
  }

  // disable buttons if no selection
  const hasTask = !!selected;
  $("#flowComplete", flowOverlayEl).disabled = !hasTask || flowTimer.mode !== "focus";
  $("#flowSkip", flowOverlayEl).disabled = !hasTask;
}

function formatTime(sec){
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s/60);
  const ss = s%60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function startFlow(){
  if(flowTimer.running) return;
  // if focus and remaining is 0, reset
  if(flowTimer.remainingSec <= 0){
    flowTimer.remainingSec = (flowTimer.mode === "focus"
      ? STORE.settings.pomodoro.focusMin
      : (flowTimer.mode === "break" ? STORE.settings.pomodoro.breakMin : STORE.settings.pomodoro.longBreakMin)
    ) * 60;
  }
  flowTimer.running = true;
  startFlowTick();
  syncFlowUI();
}

function pauseFlow(){
  flowTimer.running = false;
  stopFlowTick();
  syncFlowUI();
}

function startFlowTick(){
  stopFlowTick();
  flowTimer.tickHandle = setInterval(() => {
    if(!flowTimer.running) return;
    flowTimer.remainingSec -= 1;
    if(flowTimer.remainingSec <= 0){
      flowTimer.remainingSec = 0;
      flowTimer.running = false;
      stopFlowTick();

      // auto transition: focus -> break (or longbreak), break -> focus
      if(flowTimer.mode === "focus"){
        const longEvery = STORE.settings.pomodoro.cyclesBeforeLong || 4;
        const isLong = (flowTimer.cycle % longEvery === 0);
        flowTimer.mode = isLong ? "longbreak" : "break";
        flowTimer.remainingSec = (isLong ? STORE.settings.pomodoro.longBreakMin : STORE.settings.pomodoro.breakMin) * 60;
      }else{
        flowTimer.mode = "focus";
        flowTimer.cycle += 1;
        flowTimer.remainingSec = (STORE.settings.pomodoro.focusMin || 25) * 60;
      }
      syncFlowUI();
    }else{
      // just tick UI
      if(flowOverlayEl) $("#flowTime", flowOverlayEl).textContent = formatTime(flowTimer.remainingSec);
    }
  }, 1000);
}

function stopFlowTick(){
  if(flowTimer.tickHandle){
    clearInterval(flowTimer.tickHandle);
    flowTimer.tickHandle = null;
  }
}

function skipFlowTask(){
  const queue = buildFlowQueue();
  if(!queue.length) return;
  const idx = Math.max(0, queue.findIndex(x => x.id === flowTimer.selectedTaskId));
  const next = queue[idx+1] || queue[0];
  flowTimer.selectedTaskId = next.id;
  syncFlowUI();
}

function completeFlowTask(){
  if(flowTimer.mode !== "focus") return;

  const queue = buildFlowQueue();
  const sel = queue.find(x => x.id === flowTimer.selectedTaskId) || null;
  if(!sel) return;

  if(sel.kind === "today"){
    const t = STORE.today.tasks.find(x => x.id === sel.id);
    if(t){
      t.done = true;
      t.doneAt = Date.now();
      recomputeStreakIfCompleted();
    }
  }else if(sel.kind === "goalAction"){
    // mark corresponding action done in goals
    const [_, goalId, msId, actionId] = sel.id.split(":");
    const g = STORE.goals.find(x => x.id === goalId);
    if(g){
      const m = (g.milestones||[]).find(x => x.id === msId);
      const a = (m?.actions||[]).find(x => x.id === actionId);
      if(a){
        a.done = true;
        m.done = (m.actions.length > 0 && m.actions.every(x=>x.done));
      }
    }
  }

  saveStore();
  // move to next open task
  flowTimer.selectedTaskId = pickFirstOpenTaskId();
  syncFlowUI();
  updateChrome();
}

function startBreakNow(){
  // instantly switch to break mode; keeps cycle
  flowTimer.running = false;
  stopFlowTick();
  flowTimer.mode = "break";
  flowTimer.remainingSec = (STORE.settings.pomodoro.breakMin || 5) * 60;
  syncFlowUI();
}

function openDistractionModal(){
  openModal("Distraction note", `
    <label>Note</label>
    <input id="dnText" placeholder="Write it down, then return…" />
    <div class="help">This is not failure — it’s capture. Your attention comes back faster.</div>
    <div class="modalFoot">
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="dnSave">Save</button>
    </div>
  `, {
    onMount(root){
      $("#dnSave", root).addEventListener("click", () => {
        const text = safeText($("#dnText", root).value);
        if(!text) return;
        STORE.today.distractions.push({ id: uid(), text, ts: Date.now() });
        saveStore();
        closeModal();
        if(flowOverlayEl){
          $("#flowFootHint", flowOverlayEl).textContent = `Saved note · ${STORE.today.distractions.length} today`;
          setTimeout(() => { if(flowOverlayEl) $("#flowFootHint", flowOverlayEl).textContent = "Press Esc to exit"; }, 2400);
        }
      });
    }
  });
}

/* ---------------------------
   Topbar buttons + Quick actions
----------------------------*/
$("#btnFlowQuick").addEventListener("click", () => navigate("#/flow"));

$("#btnExport").addEventListener("click", async () => {
  try{
    const data = JSON.stringify(STORE, null, 2);
    await navigator.clipboard.writeText(data);
    $("#btnExport").textContent = "Copied";
    setTimeout(() => $("#btnExport").textContent = "Copy", 1200);
  }catch(e){
    openModal("Copy failed", `<div class="muted">Clipboard not available. You can manually copy from DevTools → Application → LocalStorage.</div>`);
  }
});

$("#btnReset").addEventListener("click", () => {
  openModal("Reset data", `
    <div class="muted">This clears localStorage for this app. This can’t be undone.</div>
    <div class="modalFoot">
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn danger" id="rsYes">Reset</button>
    </div>
  `, {
    onMount(root){
      $("#rsYes", root).addEventListener("click", () => {
        localStorage.removeItem(STORE_KEY);
        STORE = defaultStore();
        saveStore();
        closeModal();
        navigate("#/start");
        render();
      });
    }
  });
});

// Quick actions
$("#qaAdd").addEventListener("click", () => { navigate("#/today"); setTimeout(() => $("#btnAddOne")?.click(), 40); });
$("#qaTemplates").addEventListener("click", () => { navigate("#/today"); setTimeout(openTemplatesModal, 40); });
$("#qaAutoWeek").addEventListener("click", () => { autoPlanWeek(); navigate("#/week"); render(); });
$("#qaNewGoal").addEventListener("click", () => { navigate("#/goals"); setTimeout(openNewGoalModal, 40); });

/* ---------------------------
   Helpers: escaping
----------------------------*/
function escapeHTML(str){
  return (str ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(str){
  return escapeHTML(str).replaceAll("\n"," ").trim();
}
function escapeXML(str){
  return escapeHTML(str);
}

/* ---------------------------
   Boot
----------------------------*/
updateChrome();
mount();
