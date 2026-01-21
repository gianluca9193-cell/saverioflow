/* SaverIoFlow — FINAL (offline, vanilla SPA)
   STORE_KEY: "saverioflow_final_v1"
*/
const STORE_KEY = "saverioflow_final_v1";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const pad2 = (n) => String(n).padStart(2,"0");
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const safe = (s) => (s ?? "").toString().trim();

const isoDate = (d=new Date()) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseISO = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
const addDays = (d, n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const weekStartMonday = (d=new Date()) => { const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; };
const fmtShort = (s) => parseISO(s).toLocaleDateString(undefined,{weekday:"short", month:"short", day:"numeric"});
const esc = (str) => (str??"").toString()
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const escAttr = (str) => esc(str).replaceAll("\n"," ").trim();

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
        { id: uid(), text: "Flow block — 25 min", done:false, createdAt: Date.now(), source:"template" },
        { id: uid(), text: "Small step — 10 min", done:false, createdAt: Date.now(), source:"template" }
      ],
      distractions: [],
      streak: { count: 0, lastCompleteDate: null }
    },
    week: { startDate: isoDate(weekStartMonday()), days: {} },
    goals: [],
    settings: {
      pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 }
    },
    ui: { lastRoute: "#/start", goalsSelectedId: null }
  };
}

function migrateStore(s){
  const d = defaultStore();
  if(!s || typeof s !== "object") return d;
  s.version ??= 1;
  s.today ??= d.today;
  s.week ??= d.week;
  s.goals ??= [];
  s.settings ??= d.settings;
  s.ui ??= d.ui;

  s.today.tasks ??= [];
  s.today.distractions ??= [];
  s.today.streak ??= { count:0, lastCompleteDate:null };

  s.week.startDate ??= d.week.startDate;
  s.week.days ??= {};

  // day rollover (keep tasks; reset distractions)
  const now = isoDate();
  if(s.today.date !== now){
    s.today.date = now;
    s.today.distractions = [];
  }
  return s;
}

function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defaultStore();
    return migrateStore(JSON.parse(raw));
  }catch{
    return defaultStore();
  }
}

let STORE = loadStore();
function saveStore(){ localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); }

/* ---------------- Modal ---------------- */
const modalRoot = $("#modalRoot");
function closeModal(){
  modalRoot.classList.remove("open");
  modalRoot.innerHTML = "";
  modalRoot.setAttribute("aria-hidden","true");
}
function openModal(title, bodyHTML, footHTML="", onMount){
  modalRoot.setAttribute("aria-hidden","false");
  modalRoot.classList.add("open");
  modalRoot.innerHTML = `
    <div class="modalBackdrop" data-close="1"></div>
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modalHead">
        <div class="modalTitle">${esc(title)}</div>
        <button class="btn ghost" data-close="1">Close</button>
      </div>
      <div class="modalBody">${bodyHTML}</div>
      ${footHTML ? `<div class="modalFoot">${footHTML}</div>` : ``}
    </div>
  `;
  const closer = (e) => { const t=e.target; if(t?.getAttribute?.("data-close")==="1") closeModal(); };
  modalRoot.addEventListener("click", closer, { once:true });
  if(typeof onMount==="function") onMount(modalRoot);
}

/* -------------- Core state helpers -------------- */
function todayProgress(){
  const tasks = STORE.today.tasks || [];
  const total = tasks.length;
  const done = tasks.filter(t=>!!t.done).length;
  const pct = total ? Math.round((done/total)*100) : 0;
  return { total, done, pct };
}

function recomputeStreakIfCompleted(){
  const { total, done } = todayProgress();
  if(total===0 || done!==total) return;

  const today = STORE.today.date;
  if(STORE.today.streak.lastCompleteDate === today) return;

  const last = STORE.today.streak.lastCompleteDate;
  if(last){
    const diff = Math.round((parseISO(today)-parseISO(last))/(1000*60*60*24));
    STORE.today.streak.count = (diff===1) ? (STORE.today.streak.count+1) : 1;
  }else{
    STORE.today.streak.count = 1;
  }
  STORE.today.streak.lastCompleteDate = today;
}

function drawPulseRing(pct){
  const ring = $("#pulseRing");
  const r = 34;
  const c = 2*Math.PI*r;
  const dash = Math.round((pct/100)*c);
  ring.innerHTML = `
    <svg viewBox="0 0 86 86" aria-hidden="true">
      <circle cx="43" cy="43" r="${r}" stroke="rgba(255,255,255,.10)" stroke-width="8" fill="none"/>
      <circle cx="43" cy="43" r="${r}" stroke="rgba(205,160,60,.85)" stroke-width="8" fill="none"
        stroke-linecap="round" stroke-dasharray="${dash} ${Math.max(0,c-dash)}"
        transform="rotate(-90 43 43)"/>
    </svg>
  `;
}

/* -------------- Templates / goal templates -------------- */
const TODAY_TEMPLATES = [
  { name:"Calm Start", lines:["Flow block — 25 min","Inbox zero — 10 min","Small step — 10 min"] },
  { name:"Deep Work", lines:["Flow block — 45 min","Break — 5 min","Flow block — 25 min"] },
  { name:"Admin Reset", lines:["Plan the day — 5 min","Email sweep — 15 min","Follow-ups — 15 min"] }
];

const GOAL_TEMPLATES = {
  clarity: (title)=>[
    { t:`Define “done” for ${title}`, a:["Write the outcome statement","List constraints","Pick a success metric"] },
    { t:"Plan the path", a:["Break into 3–5 milestones","Estimate hours per milestone","Decide weekly rhythm"] }
  ],
  skill: (title)=>[
    { t:"Fundamentals", a:["Choose resource","Practice 20 min","Take notes"] },
    { t:"Ship outputs", a:["Create 3 tiny projects","Get feedback","Iterate"] },
    { t:"Consolidate", a:["Review mistakes","Create checklist","Repeat core drills"] }
  ],
  build: (title)=>[
    { t:"MVP scope", a:["Define core loop","List must-haves","Set constraints"] },
    { t:"Implement", a:["Create skeleton","Build feature 1","Build feature 2"] },
    { t:"Polish & ship", a:["Fix rough edges","Write onboarding copy","Release v1"] }
  ],
  health: (title)=>[
    { t:"Baseline", a:["Define weekly target","Choose simple routine","Track 7 days"] },
    { t:"Consistency", a:["Schedule blocks","Prepare environment","Reduce friction"] },
    { t:"Progress", a:["Increase difficulty","Measure weekly","Adjust"] }
  ],
  income: (title)=>[
    { t:"Offer", a:["Define audience + problem","Write one-page offer","Choose pricing"] },
    { t:"Distribution", a:["Pick 1 channel","Create 5 posts","Start outreach"] },
    { t:"Conversion", a:["Run 10 conversations","Collect objections","Refine pitch"] }
  ]
};

function scaledMilestones(minutesPerDay, templateMs){
  const mpd = clamp(Number(minutesPerDay)||30, 10, 180);
  // scaling: low minutes => split more gently (we keep wording, but can add hint weight later)
  const extra = mpd < 25 ? " (small)" : "";
  return templateMs.map(ms => ({
    id: uid(),
    title: ms.t,
    done:false,
    actions: ms.a.map(a => ({ id: uid(), text: a + extra, done:false }))
  }));
}

/* ---------------- Week helpers ---------------- */
function getWeekDays(){
  const start = parseISO(STORE.week.startDate);
  return Array.from({length:7}, (_,i)=> isoDate(addDays(start, i)));
}
function ensureWeekDay(dateStr){
  STORE.week.days[dateStr] ??= { tasks: [] };
  STORE.week.days[dateStr].tasks ??= [];
  return STORE.week.days[dateStr];
}
function autoPlanWeek(){
  const days = getWeekDays();
  const defaults = ["Focus block — 25 min","Small step — 10 min"];
  days.forEach((d,i)=>{
    if(i>4) return; // weekdays
    const day = ensureWeekDay(d);
    if(day.tasks.length===0){
      defaults.forEach(line => day.tasks.push({ id: uid(), text: line, done:false, createdAt: Date.now() }));
    }
  });
  saveStore();
}

/* ---------------- Routing ---------------- */
const view = $("#view");
const Routes = {
  "#/start": renderStart,
  "#/today": renderToday,
  "#/week": renderWeek,
  "#/goals": renderGoals,
  "#/discover": renderDiscover,
  "#/flow": renderFlowRoute
};

function navigate(h){ location.hash = h; }
window.addEventListener("hashchange", render);

function updateChrome(){
  const { total, done, pct } = todayProgress();
  $("#pillDate").textContent = fmtShort(STORE.today.date);
  $("#pillStreak").textContent = `Streak ${STORE.today.streak.count || 0}`;
  $("#pillFocus").textContent = `Focus ${STORE.today.focusStyle || "—"}`;

  $("#sideProgress").textContent = `${pct}% (${done}/${total})`;
  $("#sideSub").textContent = total ? `${total-done} open · ${STORE.today.doneBy || "—"} done-by` : "Add 1 block + 1 step";
  $("#sideDoneBy").textContent = STORE.today.doneBy || "—";
  $("#sideStyle").textContent = STORE.today.focusStyle || "—";
  drawPulseRing(pct);

  const r = (location.hash || "#/start").split("?")[0];
  $$(".navItem").forEach(a => a.classList.toggle("active", a.getAttribute("href")===r));
}

function render(){
  // align week to current Monday (keeps your MVP behavior stable)
  const ws = isoDate(weekStartMonday());
  if(STORE.week.startDate !== ws){
    STORE.week.startDate = ws;
    saveStore();
  }

  const hash = (location.hash || STORE.ui.lastRoute || "#/start").split("?")[0];
  STORE.ui.lastRoute = hash;
  saveStore();

  if(hash === "#/flow"){
    // keep background view = Today (feels right)
    renderToday(true);
    Flow.open();
    updateChrome();
    return;
  }else{
    Flow.close();
  }

  (Routes[hash] || renderStart)();
  updateChrome();
}

/* ---------------- UI snippets ---------------- */
function head(title, sub){
  return `
    <div class="row">
      <div>
        <div class="h1">${esc(title)}</div>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ``}
      </div>
    </div>
  `;
}

/* ---------------- Start ---------------- */
function renderStart(){
  view.innerHTML = `
    <div class="sectionCard">
      ${head("Start","Pick a direction. Keep it calm.")}
      <div class="sep"></div>

      <div class="grid3">
        <div class="sectionCard">
          <div class="badge blue">Today</div>
          <div class="sub">Tasks, done-by, focus style, templates, streak.</div>
          <div class="sep"></div>
          <button class="btn primary" data-go="#/today">Open Today</button>
        </div>

        <div class="sectionCard">
          <div class="badge">Goals</div>
          <div class="sub">Effort, minutes/day, auto milestones, graph, scenarios.</div>
          <div class="sep"></div>
          <button class="btn primary" data-go="#/goals">Open Goals</button>
        </div>

        <div class="sectionCard">
          <div class="badge gold">Flow Mode</div>
          <div class="sub">Fullscreen focus: queue + timer + notes + breaks.</div>
          <div class="sep"></div>
          <button class="btn primary" data-go="#/flow">Enter Flow</button>
        </div>
      </div>

      <div class="sep"></div>
      <div class="sub">SaverIoFlow is a flow-system. Plan lightly. Execute calmly. Forecast realistically.</div>
    </div>
  `;
  $$("[data-go]").forEach(b => b.addEventListener("click", ()=>navigate(b.getAttribute("data-go"))));
}

/* ---------------- Today ---------------- */
function renderToday(isBehindFlow=false){
  const { total, done, pct } = todayProgress();
  const tasks = STORE.today.tasks || [];

  const ring = (() => {
    const r=54, c=2*Math.PI*r;
    const dash=Math.round((pct/100)*c);
    return `
      <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
        <div style="position:relative;width:132px;height:132px;">
          <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
            <circle cx="66" cy="66" r="${r}" stroke="rgba(255,255,255,.10)" stroke-width="10" fill="none"/>
            <circle cx="66" cy="66" r="${r}" stroke="rgba(205,160,60,.85)" stroke-width="10" fill="none"
              stroke-linecap="round" stroke-dasharray="${dash} ${Math.max(0,c-dash)}" transform="rotate(-90 66 66)"/>
          </svg>
          <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;">
            <div style="font-size:26px;font-weight:650;letter-spacing:-0.01em;">${pct}%</div>
            <div style="font-size:12px;color:rgba(255,255,255,.60);letter-spacing:.08em;text-transform:uppercase;margin-top:-2px;">
              ${done}/${total}
            </div>
          </div>
        </div>
        <div style="flex:1; min-width:240px;">
          <div class="badge ${pct>=70?"ok":""}">Queue</div>
          <div class="sub" style="margin-top:8px;">Keep it finishable. One block + one small step beats a long list.</div>
          <div class="inline" style="margin-top:12px;">
            <button class="btn primary" id="tRecommend">Recommendation</button>
            <button class="btn soft" id="tTemplates">Templates</button>
            <button class="btn soft" id="tFlow">Enter Flow</button>
          </div>
        </div>
      </div>
    `;
  })();

  const list = tasks.length ? tasks.map(t=>`
    <div class="item">
      <div>
        <div class="t">${esc(t.text)}</div>
        <div class="m">${esc(t.source || "task")} · ${t.done ? "done" : "open"}</div>
      </div>
      <div class="inline">
        <button class="btn soft" data-tog="${escAttr(t.id)}">${t.done ? "Undo" : "Done"}</button>
        <button class="btn ghost" data-del="${escAttr(t.id)}">✕</button>
      </div>
    </div>
  `).join("") : `<div class="sub">No tasks yet. Add a focused block.</div>`;

  view.innerHTML = `
    <div class="sectionCard">
      ${head("Today","Tasks, done-by, focus style — then execute.")}
      <div class="sep"></div>

      <div class="grid2">
        <div class="sectionCard">${ring}</div>
        <div class="sectionCard">
          <div class="grid2">
            <div>
              <label>Done-by</label>
              <input id="doneBy" value="${escAttr(STORE.today.doneBy||"")}" placeholder="17:00" />
            </div>
            <div>
              <label>Focus style</label>
              <select id="focusStyle">
                ${["Deep","Calm","Fast","Creative","Admin"].map(x=>`<option ${x===STORE.today.focusStyle?"selected":""}>${x}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="sep"></div>

          <label>Quick add (multi-line)</label>
          <textarea id="quickAdd" placeholder="One task per line…"></textarea>
          <div class="inline" style="margin-top:10px;">
            <button class="btn primary" id="addLines">Add</button>
            <button class="btn soft" id="addOne">Add one</button>
            <button class="btn ghost" id="clearDone">Clear done</button>
          </div>

          <div class="help">Streak increments when all tasks are completed.</div>
        </div>
      </div>

      <div class="sep"></div>
      <div class="sectionCard">
        <div class="row">
          <div class="inline">
            <span class="badge gold">Tasks</span>
            <span class="sub" style="margin:0;">${tasks.length ? "Tap Done to keep momentum." : "Add a calm queue."}</span>
          </div>
          <div class="inline">
            <button class="btn soft" id="openNotes">Distraction notes</button>
          </div>
        </div>
        <div class="sep"></div>
        <div class="list">${list}</div>
      </div>
    </div>
  `;

  $("#doneBy").addEventListener("change",(e)=>{ STORE.today.doneBy = safe(e.target.value)||"17:00"; saveStore(); updateChrome(); });
  $("#focusStyle").addEventListener("change",(e)=>{ STORE.today.focusStyle = e.target.value; saveStore(); updateChrome(); });

  $("#addLines").addEventListener("click", ()=>{
    const lines = ($("#quickAdd").value||"").split("\n").map(safe).filter(Boolean);
    if(!lines.length) return;
    lines.forEach(line => STORE.today.tasks.push({ id: uid(), text: line, done:false, createdAt: Date.now(), source:"manual" }));
    $("#quickAdd").value="";
    saveStore(); render();
  });

  $("#addOne").addEventListener("click", ()=>{
    openModal("Add task", `
      <label>Task</label>
      <input id="tt" placeholder="e.g., Flow block — 25 min" />
      <div class="help">Tip: keep it block-sized and specific.</div>
    `, `
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="ok">Add</button>
    `, (root)=>{
      $("#ok",root).addEventListener("click", ()=>{
        const text = safe($("#tt",root).value);
        if(!text) return;
        STORE.today.tasks.push({ id: uid(), text, done:false, createdAt: Date.now(), source:"manual" });
        saveStore(); closeModal(); render();
      });
    });
  });

  $("#clearDone").addEventListener("click", ()=>{
    STORE.today.tasks = (STORE.today.tasks||[]).filter(t=>!t.done);
    saveStore(); render();
  });

  $("#tTemplates").addEventListener("click", openTemplatesModal);
  $("#tRecommend").addEventListener("click", openRecommendationModal);
  $("#tFlow").addEventListener("click", ()=>navigate("#/flow"));

  $("#openNotes").addEventListener("click", ()=>{
    const notes = STORE.today.distractions || [];
    openModal("Distraction notes", `
      <div class="sub">Captured notes for ${esc(fmtShort(STORE.today.date))}. Keep them, don’t fight them.</div>
      <div class="sep"></div>
      <div class="list">
        ${notes.length ? notes.map(n=>`
          <div class="item">
            <div>
              <div class="t">${esc(n.text)}</div>
              <div class="m">${new Date(n.ts).toLocaleTimeString(undefined,{hour:"2-digit", minute:"2-digit"})}</div>
            </div>
          </div>
        `).join("") : `<div class="sub">No notes today.</div>`}
      </div>
    `);
  });

  $$("[data-tog]").forEach(b=>b.addEventListener("click", ()=>{
    const id=b.getAttribute("data-tog");
    const t=STORE.today.tasks.find(x=>x.id===id);
    if(!t) return;
    t.done=!t.done;
    if(t.done) t.doneAt=Date.now();
    recomputeStreakIfCompleted();
    saveStore(); render();
  }));
  $$("[data-del]").forEach(b=>b.addEventListener("click", ()=>{
    const id=b.getAttribute("data-del");
    STORE.today.tasks = STORE.today.tasks.filter(x=>x.id!==id);
    saveStore(); render();
  }));

  if(isBehindFlow){ /* keep as background */ }
}

function openTemplatesModal(){
  const list = TODAY_TEMPLATES.map((t,i)=>`
    <div class="item">
      <div>
        <div class="t">${esc(t.name)}</div>
        <div class="m">${esc(t.lines.join(" · "))}</div>
      </div>
      <div class="inline">
        <button class="btn soft" data-add="${i}">Add</button>
        <button class="btn ghost" data-rep="${i}">Replace</button>
      </div>
    </div>
  `).join("");

  openModal("Templates", `
    <div class="sub">Pick a starting shape. You can edit afterwards.</div>
    <div class="sep"></div>
    <div class="list">${list}</div>
  `, "", (root)=>{
    $$("[data-add]",root).forEach(btn=>btn.addEventListener("click", ()=>{
      const i=Number(btn.getAttribute("data-add"));
      const tpl=TODAY_TEMPLATES[i];
      tpl.lines.forEach(line=>STORE.today.tasks.push({ id: uid(), text: line, done:false, createdAt: Date.now(), source:`template:${tpl.name}` }));
      saveStore(); closeModal(); render();
    }));
    $$("[data-rep]",root).forEach(btn=>btn.addEventListener("click", ()=>{
      const i=Number(btn.getAttribute("data-rep"));
      const tpl=TODAY_TEMPLATES[i];
      STORE.today.tasks = tpl.lines.map(line=>({ id: uid(), text: line, done:false, createdAt: Date.now(), source:`template:${tpl.name}` }));
      saveStore(); closeModal(); render();
    }));
  });
}

function openRecommendationModal(){
  const open = (STORE.today.tasks||[]).filter(t=>!t.done);
  const focusMin = STORE.settings.pomodoro.focusMin || 25;
  const hasBlock = open.some(t=>/flow block|focus block|pomodoro/i.test(t.text));
  const hasSmall = open.some(t=>/small step|10 min|micro/i.test(t.text));
  const recs = [];
  if(!hasBlock) recs.push({ text:`Flow block — ${focusMin} min`, source:"recommendation" });
  if(!hasSmall) recs.push({ text:`Small step — 10 min`, source:"recommendation" });

  openModal("Recommendation", `
    <div class="sub">Calm, practical. One block + one small step. Then execute.</div>
    <div class="sep"></div>
    <div class="list">
      <div class="item">
        <div>
          <div class="t">Suggested</div>
          <div class="m">${recs.length ? esc(recs.map(x=>x.text).join(" · ")) : "Your queue already has a good shape."}</div>
        </div>
      </div>
    </div>
  `, `
    <button class="btn soft" data-close="1">Close</button>
    <button class="btn primary" id="apply">Apply</button>
    <button class="btn soft" id="goFlow">Enter Flow</button>
  `, (root)=>{
    $("#apply",root).addEventListener("click", ()=>{
      if(recs.length){
        recs.forEach(r=>STORE.today.tasks.push({ id: uid(), text:r.text, done:false, createdAt: Date.now(), source:r.source }));
        saveStore();
      }
      closeModal(); render();
    });
    $("#goFlow",root).addEventListener("click", ()=>{ closeModal(); navigate("#/flow"); });
  });
}

/* ---------------- Week ---------------- */
function renderWeek(){
  const days = getWeekDays();
  const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const grid = days.map((d,i)=>{
    const day=ensureWeekDay(d);
    const open=day.tasks.filter(t=>!t.done).length;
    return `
      <div class="dayCell" data-day="${escAttr(d)}">
        <div class="d">${names[i]} · ${esc(fmtShort(d).split(", ").slice(1).join(", "))}</div>
        <div class="n">${day.tasks.length} tasks · ${open} open</div>
      </div>
    `;
  }).join("");

  view.innerHTML = `
    <div class="sectionCard">
      ${head("Week","Overview grid. Tap a day. Auto-plan if empty.")}
      <div class="sep"></div>
      <div class="inline">
        <button class="btn primary" id="wkAuto">Auto-plan week</button>
      </div>
      <div class="sep"></div>
      <div class="weekGrid">${grid}</div>
      <div class="help">Auto-plan fills weekdays with a focus block + small step (only if empty).</div>
    </div>
  `;

  $("#wkAuto").addEventListener("click", ()=>{ autoPlanWeek(); render(); });
  $$(".dayCell").forEach(c=>c.addEventListener("click", ()=> openDayModal(c.getAttribute("data-day")) ));
}

function openDayModal(dateStr){
  const day = ensureWeekDay(dateStr);
  const list = day.tasks.length ? day.tasks.map(t=>`
    <div class="item">
      <div>
        <div class="t">${esc(t.text)}</div>
        <div class="m">${t.done ? "done" : "open"}</div>
      </div>
      <div class="inline">
        <button class="btn soft" data-tog="${escAttr(t.id)}">${t.done?"Undo":"Done"}</button>
        <button class="btn ghost" data-del="${escAttr(t.id)}">✕</button>
        <button class="btn ghost" data-today="${escAttr(t.id)}">→ Today</button>
      </div>
    </div>
  `).join("") : `<div class="sub">No tasks yet.</div>`;

  openModal(`Day · ${fmtShort(dateStr)}`, `
    <div class="grid2">
      <div>
        <label>Add task</label>
        <input id="dt" placeholder="One focused item…" />
      </div>
      <div>
        <label>Quick</label>
        <button class="btn soft" id="add">Add</button>
      </div>
    </div>
    <div class="sep"></div>
    <div class="list">${list}</div>
  `, "", (root)=>{
    $("#add",root).addEventListener("click", ()=>{
      const text=safe($("#dt",root).value);
      if(!text) return;
      day.tasks.push({ id: uid(), text, done:false, createdAt: Date.now() });
      saveStore(); closeModal(); openDayModal(dateStr);
    });

    $$("[data-tog]",root).forEach(b=>b.addEventListener("click", ()=>{
      const id=b.getAttribute("data-tog");
      const t=day.tasks.find(x=>x.id===id);
      if(!t) return;
      t.done=!t.done;
      saveStore(); closeModal(); openDayModal(dateStr);
    }));
    $$("[data-del]",root).forEach(b=>b.addEventListener("click", ()=>{
      const id=b.getAttribute("data-del");
      day.tasks = day.tasks.filter(x=>x.id!==id);
      saveStore(); closeModal(); openDayModal(dateStr);
    }));
    $$("[data-today]",root).forEach(b=>b.addEventListener("click", ()=>{
      const id=b.getAttribute("data-today");
      const t=day.tasks.find(x=>x.id===id);
      if(!t) return;
      STORE.today.tasks.push({ id: uid(), text: t.text, done:false, createdAt: Date.now(), source:`week:${dateStr}` });
      saveStore(); closeModal(); render();
    }));
  });
}

/* ---------------- Goals ---------------- */
function createGoal({ title, category="build", totalEffortHours=20, minutesPerDay=30 }){
  const g = {
    id: uid(),
    title: safe(title) || "Untitled goal",
    category,
    totalEffortHours: clamp(Number(totalEffortHours)||20, 1, 5000),
    minutesPerDay: clamp(Number(minutesPerDay)||30, 10, 300),
    createdAt: Date.now(),
    milestones: []
  };
  STORE.goals.push(g);
  STORE.ui.goalsSelectedId = g.id;
  saveStore();
  return g;
}

function baseEtaWeeks(g){
  const mpd = clamp(Number(g.minutesPerDay)||30, 10, 300);
  const dpw = 5, eff = 1;
  const wh = (mpd*dpw/60)*eff;
  if(wh<=0.001) return Infinity;
  return (Number(g.totalEffortHours)||1)/wh;
}

function scenarioEta(g, minutesPerDay, daysPerWeek, efficiencyPct){
  const mpd = clamp(Number(minutesPerDay)||30, 10, 300);
  const dpw = clamp(Number(daysPerWeek)||5, 1, 7);
  const eff = clamp(Number(efficiencyPct)||85, 50, 100)/100;
  const weeklyHours = (mpd*dpw/60)*eff;
  if(weeklyHours<=0.001) return { weeks: Infinity, date:null, weeklyHours:0 };
  const weeks = (Number(g.totalEffortHours)||1)/weeklyHours;
  const days = Math.ceil(weeks*7);
  const date = isoDate(addDays(new Date(), days));
  return { weeks, date, weeklyHours };
}

function renderGoals(){
  const goals = STORE.goals || [];
  const activeId = STORE.ui.goalsSelectedId || goals[0]?.id || null;
  STORE.ui.goalsSelectedId = activeId;
  saveStore();

  const left = goals.length ? goals.map(g=>`
    <div class="item ${g.id===activeId?"active":""}" data-sel="${escAttr(g.id)}">
      <div>
        <div class="t">${esc(g.title)}</div>
        <div class="m">${esc(g.category)} · ${g.totalEffortHours}h · ${g.minutesPerDay} min/day</div>
      </div>
      <div class="badge ${g.category==="income"?"gold":"blue"}">${esc(g.category)}</div>
    </div>
  `).join("") : `<div class="sub">No goals yet. Create one.</div>`;

  const g = goals.find(x=>x.id===activeId) || null;
  const right = g ? goalDetailHTML(g) : `
    <div class="sectionCard">
      ${head("Goals","Create your first goal.")}
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
            <div class="sub">Effort · milestones · actions · forecasting</div>
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
  $$("[data-sel]").forEach(el=>el.addEventListener("click", ()=>{
    STORE.ui.goalsSelectedId = el.getAttribute("data-sel");
    saveStore(); render();
  }));
  if(g) bindGoalDetail(g);
}

function goalDetailHTML(g){
  const ms = g.milestones || [];
  const actionsTotal = ms.flatMap(m=>m.actions||[]).length;
  const actionsOpen = ms.flatMap(m=>m.actions||[]).filter(a=>!a.done).length;
  const eta = baseEtaWeeks(g);
  const etaStr = isFinite(eta) ? `${eta.toFixed(1)} w` : "—";

  return `
    <div class="row">
      <div>
        <h2>${esc(g.title)}</h2>
        <div class="sub">${esc(g.category)} · ${g.totalEffortHours}h total · ${g.minutesPerDay} min/day · base ETA ${etaStr}</div>
      </div>
      <div class="inline">
        <button class="btn soft" id="gGraph">Graph</button>
        <button class="btn soft" id="gScen">Scenarios</button>
        <button class="btn danger" id="gDel">Delete</button>
      </div>
    </div>

    <div class="sep"></div>

    <div class="grid2">
      <div>
        <label>Total effort (hours)</label>
        <input id="gEff" type="number" min="1" step="1" value="${escAttr(g.totalEffortHours)}" />
      </div>
      <div>
        <label>Minutes / day</label>
        <input id="gMin" type="number" min="10" step="5" value="${escAttr(g.minutesPerDay)}" />
      </div>
    </div>

    <div class="sep"></div>

    <div class="inline">
      <span class="badge">Actions</span>
      <span class="sub" style="margin:0;">${actionsTotal} total · ${actionsOpen} open</span>
    </div>

    <div class="sep"></div>

    <div class="inline">
      <button class="btn primary" id="gAuto">Auto milestones</button>
      <button class="btn soft" id="gAddMs">Add milestone</button>
      <button class="btn soft" id="gAddFocus">Add focus to Today</button>
    </div>

    <div class="sep"></div>

    <div class="list">
      ${ms.length ? ms.map(m=>milestoneHTML(g,m)).join("") : `<div class="sub">No milestones yet. Generate a clean path.</div>`}
    </div>
  `;
}

function milestoneHTML(g,m){
  const actions = m.actions || [];
  const doneCount = actions.filter(a=>a.done).length;
  return `
    <div class="sectionCard" style="padding:14px;">
      <div class="row">
        <div>
          <div class="inline">
            <span class="badge ${m.done?"ok":"blue"}">${m.done?"done":"active"}</span>
            <div class="t" style="font-size:14px;">${esc(m.title)}</div>
          </div>
          <div class="m" style="margin-top:6px;">${doneCount}/${actions.length} actions done</div>
        </div>
        <div class="inline">
          <button class="btn soft" data-msadd="${escAttr(m.id)}">Add action</button>
          <button class="btn ghost" data-msdel="${escAttr(m.id)}">Delete</button>
        </div>
      </div>

      <div class="sep"></div>

      <div class="list">
        ${actions.length ? actions.map(a=>`
          <div class="item">
            <div>
              <div class="t">${esc(a.text)}</div>
              <div class="m">${a.done ? "done" : "open"}</div>
            </div>
            <div class="inline">
              <button class="btn soft" data-atog="${escAttr(m.id)}:${escAttr(a.id)}">${a.done?"Undo":"Done"}</button>
              <button class="btn ghost" data-adel="${escAttr(m.id)}:${escAttr(a.id)}">✕</button>
              <button class="btn ghost" data-a2t="${escAttr(m.id)}:${escAttr(a.id)}">→ Today</button>
            </div>
          </div>
        `).join("") : `<div class="sub">No actions yet.</div>`}
      </div>
    </div>
  `;
}

function bindGoalDetail(g){
  $("#gEff").addEventListener("change",(e)=>{ g.totalEffortHours = clamp(Number(e.target.value)||1, 1, 5000); saveStore(); render(); });
  $("#gMin").addEventListener("change",(e)=>{ g.minutesPerDay = clamp(Number(e.target.value)||10, 10, 300); saveStore(); render(); });

  $("#gAddFocus").addEventListener("click", ()=>{
    const focusMin = STORE.settings.pomodoro.focusMin || 25;
    STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${focusMin} min`, done:false, createdAt: Date.now(), source:`goal:${g.id}` });
    saveStore(); render();
  });

  $("#gAddMs").addEventListener("click", ()=>{
    openModal("Add milestone", `
      <label>Milestone title</label>
      <input id="msT" placeholder="e.g., MVP scope" />
    `, `
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="ok">Add</button>
    `, (root)=>{
      $("#ok",root).addEventListener("click", ()=>{
        const title=safe($("#msT",root).value);
        if(!title) return;
        g.milestones.push({ id: uid(), title, done:false, actions:[] });
        saveStore(); closeModal(); render();
      });
    });
  });

  $("#gAuto").addEventListener("click", ()=>openAutoMilestonesModal(g));
  $("#gGraph").addEventListener("click", ()=>openGoalGraphModal(g));
  $("#gScen").addEventListener("click", ()=>openScenariosModal(g));

  $("#gDel").addEventListener("click", ()=>{
    openModal("Delete goal", `<div class="sub">This removes the goal and all milestones/actions.</div>`,
      `<button class="btn soft" data-close="1">Cancel</button><button class="btn danger" id="yes">Delete</button>`,
      (root)=>{
        $("#yes",root).addEventListener("click", ()=>{
          STORE.goals = STORE.goals.filter(x=>x.id!==g.id);
          STORE.ui.goalsSelectedId = STORE.goals[0]?.id || null;
          saveStore(); closeModal(); render();
        });
      }
    );
  });

  $$("[data-msadd]").forEach(b=>b.addEventListener("click", ()=>{
    const msId=b.getAttribute("data-msadd");
    const m=g.milestones.find(x=>x.id===msId);
    if(!m) return;
    openModal("Add action", `
      <label>Action</label>
      <input id="aT" placeholder="Specific, block-sized…" />
    `, `
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="ok">Add</button>
    `, (root)=>{
      $("#ok",root).addEventListener("click", ()=>{
        const text=safe($("#aT",root).value);
        if(!text) return;
        m.actions.push({ id: uid(), text, done:false });
        saveStore(); closeModal(); render();
      });
    });
  }));

  $$("[data-msdel]").forEach(b=>b.addEventListener("click", ()=>{
    const msId=b.getAttribute("data-msdel");
    g.milestones = g.milestones.filter(x=>x.id!==msId);
    saveStore(); render();
  }));

  $$("[data-atog]").forEach(b=>b.addEventListener("click", ()=>{
    const [msId,aId]=b.getAttribute("data-atog").split(":");
    const m=g.milestones.find(x=>x.id===msId);
    const a=m?.actions?.find(x=>x.id===aId);
    if(!m||!a) return;
    a.done=!a.done;
    m.done = (m.actions.length>0 && m.actions.every(x=>x.done));
    saveStore(); render();
  }));

  $$("[data-adel]").forEach(b=>b.addEventListener("click", ()=>{
    const [msId,aId]=b.getAttribute("data-adel").split(":");
    const m=g.milestones.find(x=>x.id===msId);
    if(!m) return;
    m.actions = (m.actions||[]).filter(x=>x.id!==aId);
    m.done = (m.actions.length>0 && m.actions.every(x=>x.done));
    saveStore(); render();
  }));

  $$("[data-a2t]").forEach(b=>b.addEventListener("click", ()=>{
    const [msId,aId]=b.getAttribute("data-a2t").split(":");
    const m=g.milestones.find(x=>x.id===msId);
    const a=m?.actions?.find(x=>x.id===aId);
    if(!m||!a) return;
    STORE.today.tasks.push({ id: uid(), text:`${g.title}: ${a.text}`, done:false, createdAt: Date.now(), source:`goal-action:${g.id}` });
    saveStore(); render();
  }));
}

function openNewGoalModal(){
  openModal("New goal", `
    <div class="grid2">
      <div>
        <label>Goal title</label>
        <input id="t" placeholder="e.g., Launch MVP" />
      </div>
      <div>
        <label>Category</label>
        <select id="c">
          ${["clarity","skill","build","health","income"].map(x=>`<option>${x}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="grid2" style="margin-top:12px;">
      <div>
        <label>Total effort (hours)</label>
        <input id="e" type="number" min="1" step="1" value="20" />
      </div>
      <div>
        <label>Minutes / day</label>
        <input id="m" type="number" min="10" step="5" value="30" />
      </div>
    </div>
  `, `
    <button class="btn soft" data-close="1">Cancel</button>
    <button class="btn primary" id="ok">Create</button>
  `, (root)=>{
    $("#ok",root).addEventListener("click", ()=>{
      createGoal({
        title: $("#t",root).value,
        category: $("#c",root).value,
        totalEffortHours: Number($("#e",root).value)||20,
        minutesPerDay: Number($("#m",root).value)||30
      });
      closeModal(); render();
    });
  });
}

function openAutoMilestonesModal(g){
  openModal("Auto milestones", `
    <div class="sub">Offline templates by type. Minutes/day scales the plan. Replace or append.</div>
    <div class="sep"></div>
    <div class="grid2">
      <div>
        <label>Template</label>
        <select id="type">
          ${["clarity","skill","build","health","income"].map(x=>`<option ${x===g.category?"selected":""}>${x}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Mode</label>
        <select id="mode">
          <option value="replace">Replace milestones</option>
          <option value="append">Append milestones</option>
        </select>
      </div>
    </div>
    <div style="margin-top:12px;">
      <label><input type="checkbox" id="addToday" style="width:auto; margin-right:8px;">Add focus to Today after generating</label>
    </div>
  `, `
    <button class="btn soft" data-close="1">Cancel</button>
    <button class="btn primary" id="ok">Generate</button>
  `, (root)=>{
    $("#ok",root).addEventListener("click", ()=>{
      const type=$("#type",root).value;
      const mode=$("#mode",root).value;
      const addToday=$("#addToday",root).checked;

      const tpl = (GOAL_TEMPLATES[type] || GOAL_TEMPLATES.build)(g.title);
      const ms = scaledMilestones(g.minutesPerDay, tpl);

      if(mode==="replace") g.milestones = ms;
      else g.milestones = (g.milestones||[]).concat(ms);

      if(addToday){
        const focusMin = STORE.settings.pomodoro.focusMin || 25;
        STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${focusMin} min`, done:false, createdAt: Date.now(), source:`goal:${g.id}` });
      }

      saveStore(); closeModal(); render();
    });
  });
}

function openGoalGraphModal(g){
  const ms = g.milestones || [];
  const h = 90 + ms.length*72;
  const firstActive = ms.findIndex(x=>!x.done);
  const nodes = ms.map((m,i)=>{
    const y = 50 + i*72;
    const isDone = !!m.done;
    const isActive = !isDone && (i===firstActive);
    const fill = isDone ? "rgba(205,160,60,.85)" : (isActive ? "rgba(80,140,255,.85)" : "rgba(255,255,255,.14)");
    const stroke = isDone ? "rgba(205,160,60,.95)" : (isActive ? "rgba(80,140,255,.95)" : "rgba(255,255,255,.18)");
    return `
      ${i>0 ? `<line x1="70" y1="${y-72}" x2="70" y2="${y-14}" stroke="rgba(255,255,255,.12)" stroke-width="2"/>` : ``}
      <circle cx="70" cy="${y}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="98" y="${y+4}" fill="rgba(255,255,255,.86)" font-size="12">${esc(m.title)}</text>
    `;
  }).join("");

  openModal("Goal graph", `
    <div class="sub">Done = gold. Active = blue. Upcoming = quiet.</div>
    <div class="sep"></div>
    <div class="sectionCard" style="padding:14px; background:rgba(0,0,0,.22);">
      <svg width="100%" height="${h}" viewBox="0 0 760 ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        ${nodes || `<text x="20" y="40" fill="rgba(255,255,255,.62)" font-size="12">No milestones yet.</text>`}
      </svg>
    </div>
  `);
}

function openScenariosModal(g){
  openModal("Forecast scenarios", `
    <div class="sub">Adjust days/week + efficiency. Compare 15/30/45/60/90 min/day. Apply best to Today.</div>
    <div class="sep"></div>

    <div class="grid2">
      <div>
        <label>Days / week (1–7)</label>
        <input id="dpw" type="number" min="1" max="7" step="1" value="5" />
      </div>
      <div>
        <label>Efficiency (50–100%)</label>
        <input id="eff" type="number" min="50" max="100" step="5" value="85" />
      </div>
    </div>

    <div class="sep"></div>
    <div class="list" id="tbl"></div>
  `, `
    <button class="btn soft" data-close="1">Close</button>
    <button class="btn primary" id="apply">Apply best to Today</button>
  `, (root)=>{
    const mins=[15,30,45,60,90];
    const tbl=$("#tbl",root);

    function paint(){
      const dpw=Number($("#dpw",root).value)||5;
      const eff=Number($("#eff",root).value)||85;
      const rows = mins.map(m=>{
        const r=scenarioEta(g,m,dpw,eff);
        return { m, weeks:r.weeks, date:r.date, weeklyHours:r.weeklyHours };
      });
      const best = rows.slice().sort((a,b)=>a.weeks-b.weeks)[0];
      root.__best = { best, dpw, eff };

      tbl.innerHTML = rows.map(r=>{
        const isBest = r.m===best.m;
        const w = isFinite(r.weeks) ? r.weeks.toFixed(1) : "—";
        const d = r.date ? fmtShort(r.date) : "—";
        const wh = r.weeklyHours ? `${r.weeklyHours.toFixed(1)}h/week` : "—";
        return `
          <div class="item ${isBest?"active":""}">
            <div>
              <div class="t">${r.m} min/day</div>
              <div class="m">ETA: ${w} w · ${d}</div>
            </div>
            <div class="badge ${isBest?"gold":"blue"}">${wh}</div>
          </div>
        `;
      }).join("");
    }

    $("#dpw",root).addEventListener("input", paint);
    $("#eff",root).addEventListener("input", paint);
    paint();

    $("#apply",root).addEventListener("click", ()=>{
      const payload = root.__best?.best;
      const dpw = root.__best?.dpw;
      const eff = root.__best?.eff;
      if(!payload) return;
      STORE.today.tasks.push({
        id: uid(),
        text: `Forecast: ${g.title} — ${payload.m} min/day · ${dpw}d/w · ${eff}%`,
        done:false,
        createdAt: Date.now(),
        source:`scenario:${g.id}`
      });
      saveStore(); closeModal(); render();
    });
  });
}

/* ---------------- Discover ---------------- */
function genOptions(type, min){
  const intensity = min>=60 ? "Deep" : (min>=30 ? "Steady" : "Light");
  const bank = {
    build:[`${intensity} MVP sprint`,`Ship landing + onboarding`,`Build the core loop v1`],
    skill:[`${intensity} practice plan`,`Learn by building 3 projects`,`Skill ladder: fundamentals → output`],
    health:[`${intensity} fitness routine`,`Consistency plan: 30 days`,`Sleep + energy reset`],
    income:[`${intensity} offer + outreach`,`Build a simple funnel`,`10 conversations per week`],
    clarity:[`${intensity} define “done”`,`Reduce scope, increase finish`,`Pick one outcome for 6 weeks`]
  };
  return (bank[type] || bank.build).slice(0,3);
}

function renderDiscover(){
  view.innerHTML = `
    <div class="sectionCard">
      ${head("Discover","Generate goal options. Create fast. Auto-plan a wow moment.")}
      <div class="sep"></div>

      <div class="grid2">
        <div class="sectionCard">
          <label>Focus type</label>
          <select id="type">${["build","skill","health","income","clarity"].map(x=>`<option>${x}</option>`).join("")}</select>

          <div style="margin-top:12px;">
            <label>Minutes / day</label>
            <input id="min" type="number" min="10" step="5" value="30" />
          </div>

          <div class="sep"></div>

          <div class="inline">
            <button class="btn primary" id="gen">Generate</button>
            <button class="btn soft" id="wow">Generate + auto-plan</button>
          </div>

          <div class="help">Offline generation using curated patterns + milestone templates.</div>
        </div>

        <div class="sectionCard">
          <div class="badge">Options</div>
          <div class="sep"></div>
          <div class="list" id="out">
            <div class="sub">Generate 3 options to choose from.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  $("#gen").addEventListener("click", ()=>{
    const type=$("#type").value;
    const min=clamp(Number($("#min").value)||30, 10, 180);
    paintOptions(genOptions(type,min), type, min);
  });

  $("#wow").addEventListener("click", ()=>{
    const type=$("#type").value;
    const min=clamp(Number($("#min").value)||30, 10, 180);
    const opts=genOptions(type,min);
    const pick=opts[0] || "New goal";
    const g=createGoal({ title: pick, category: type, totalEffortHours: 20, minutesPerDay: min });

    const tpl=(GOAL_TEMPLATES[type]||GOAL_TEMPLATES.build)(g.title);
    g.milestones = scaledMilestones(g.minutesPerDay, tpl);

    const focusMin = STORE.settings.pomodoro.focusMin || 25;
    STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${focusMin} min`, done:false, createdAt: Date.now(), source:"discover-wow" });

    saveStore();
    navigate("#/goals");
  });
}

function paintOptions(opts,type,min){
  const out=$("#out");
  out.innerHTML = opts.map((t,i)=>`
    <div class="item">
      <div>
        <div class="t">${esc(t)}</div>
        <div class="m">${esc(type)} · ${min} min/day</div>
      </div>
      <div class="inline">
        <button class="btn soft" data-c="${i}">Create</button>
        <button class="btn ghost" data-w="${i}">Create + auto-plan</button>
      </div>
    </div>
  `).join("");

  $$("[data-c]").forEach(b=>b.addEventListener("click", ()=>{
    const i=Number(b.getAttribute("data-c"));
    createGoal({ title: opts[i], category:type, totalEffortHours:20, minutesPerDay:min });
    saveStore(); navigate("#/goals");
  }));

  $$("[data-w]").forEach(b=>b.addEventListener("click", ()=>{
    const i=Number(b.getAttribute("data-w"));
    const g=createGoal({ title: opts[i], category:type, totalEffortHours:20, minutesPerDay:min });
    const tpl=(GOAL_TEMPLATES[type]||GOAL_TEMPLATES.build)(g.title);
    g.milestones = scaledMilestones(g.minutesPerDay, tpl);

    const focusMin = STORE.settings.pomodoro.focusMin || 25;
    STORE.today.tasks.push({ id: uid(), text:`Flow: ${g.title} — ${focusMin} min`, done:false, createdAt: Date.now(), source:"discover" });

    saveStore(); navigate("#/goals");
  }));
}

/* ---------------- FLOW MODE ---------------- */
function renderFlowRoute(){
  // route exists; overlay is handled by Flow.open()
  view.innerHTML = `
    <div class="sectionCard">
      ${head("Flow","Opening fullscreen mode…")}
      <div class="sep"></div>
      <button class="btn primary" data-go="#/flow">Open Flow</button>
    </div>
  `;
  $$("[data-go]").forEach(b=>b.addEventListener("click", ()=>navigate(b.getAttribute("data-go"))));
}

const Flow = (() => {
  const root = $("#flowRoot");
  let el = null;

  const state = {
    running:false,
    mode:"focus", // focus | break | long
    remainingSec:0,
    cycle:1,
    selectedId:null,
    includeGoalActions:false,
    tick:null
  };

  const formatTime = (sec) => {
    const s=Math.max(0, Math.floor(sec));
    const mm=Math.floor(s/60), ss=s%60;
    return `${pad2(mm)}:${pad2(ss)}`;
  };

  const buildQueue = () => {
    const todayOpen = (STORE.today.tasks||[]).filter(t=>!t.done).map(t=>({
      id:t.id, kind:"today", text:t.text, meta:`Today · ${t.source||"task"}`
    }));
    if(!state.includeGoalActions) return todayOpen;

    const gId = STORE.ui.goalsSelectedId || STORE.goals[0]?.id || null;
    const g = STORE.goals.find(x=>x.id===gId) || null;
    if(!g) return todayOpen;

    const actions = (g.milestones||[])
      .flatMap(m => (m.actions||[]).map(a => ({ m, a })))
      .filter(x => !x.a.done)
      .slice(0, 12)
      .map(x => ({
        id:`ga:${g.id}:${x.m.id}:${x.a.id}`,
        kind:"goalAction",
        text:`${g.title}: ${x.a.text}`,
        meta:`Goal action · ${g.title}`,
        goalId:g.id, msId:x.m.id, actionId:x.a.id
      }));

    return todayOpen.concat(actions);
  };

  const pickFirst = () => buildQueue()[0]?.id || null;

  const ensureTimer = () => {
    if(state.remainingSec>0) return;
    const p=STORE.settings.pomodoro;
    state.mode="focus";
    state.remainingSec=(p.focusMin||25)*60;
    state.cycle=state.cycle||1;
  };

  const sync = () => {
    if(!el) return;
    const q = buildQueue();
    if(!state.selectedId) state.selectedId = pickFirst();
    if(state.selectedId && !q.some(x=>x.id===state.selectedId)) state.selectedId = pickFirst();

    $("#fMode",el).textContent = state.mode==="focus" ? "Focus" : (state.mode==="break" ? "Break" : "Long break");
    $("#fCycle",el).textContent = `Cycle ${state.cycle}`;
    $("#fTime",el).textContent = formatTime(state.remainingSec);

    const cur = q.find(x=>x.id===state.selectedId) || q[0] || null;
    const next = cur ? q[q.findIndex(x=>x.id===cur.id)+1] : null;

    $("#fCur",el).textContent = cur ? cur.text : "No open tasks";
    $("#fNext",el).textContent = `Next: ${next ? next.text : "—"}`;
    $("#fMeta",el).textContent = `${q.length} items`;

    const list = $("#fList",el);
    list.innerHTML = q.length ? q.map(x=>`
      <div class="flowItem ${x.id===state.selectedId?"active":""}" data-q="${escAttr(x.id)}">
        <div>
          <div class="t">${esc(x.text)}</div>
          <div class="m">${esc(x.meta)}</div>
        </div>
        <div class="badge ${x.kind==="goalAction"?"blue":"gold"}">${x.kind==="goalAction"?"Action":"Task"}</div>
      </div>
    `).join("") : `<div class="sub">Nothing open. Add a task in Today.</div>`;

    $$("[data-q]",el).forEach(it=>it.addEventListener("click", ()=>{
      state.selectedId = it.getAttribute("data-q");
      sync();
    }));

    $("#fComplete",el).disabled = !(cur && state.mode==="focus");
    $("#fSkip",el).disabled = !cur;

    const sub = $("#fSub",el);
    if(state.mode==="focus"){
      sub.textContent = state.running
        ? "Stay with the current task. If you drift, add a note — then return."
        : "Choose a task. Start when you’re ready.";
    }else{
      sub.textContent = state.running
        ? "Break means recovery. Keep it quiet."
        : "Start a break when you need it.";
    }
  };

  const stopTick = () => { if(state.tick){ clearInterval(state.tick); state.tick=null; } };

  const startTick = () => {
    stopTick();
    state.tick = setInterval(()=>{
      if(!state.running) return;
      state.remainingSec -= 1;
      if(state.remainingSec<=0){
        state.remainingSec = 0;
        state.running = false;
        stopTick();

        const p=STORE.settings.pomodoro;
        if(state.mode==="focus"){
          const longEvery = p.cyclesBeforeLong || 4;
          const isLong = (state.cycle % longEvery === 0);
          state.mode = isLong ? "long" : "break";
          state.remainingSec = (isLong ? p.longBreakMin : p.breakMin) * 60;
        }else{
          state.mode = "focus";
          state.cycle += 1;
          state.remainingSec = (p.focusMin||25) * 60;
        }
        sync();
      }else{
        if(el) $("#fTime",el).textContent = formatTime(state.remainingSec);
      }
    }, 1000);
  };

  const start = () => {
    if(state.running) return;
    if(state.remainingSec<=0){
      const p=STORE.settings.pomodoro;
      state.remainingSec = (state.mode==="focus" ? p.focusMin : (state.mode==="break" ? p.breakMin : p.longBreakMin)) * 60;
    }
    state.running = true;
    startTick();
    sync();
  };

  const pause = () => { state.running=false; stopTick(); sync(); };

  const skip = () => {
    const q=buildQueue();
    if(!q.length) return;
    const idx=Math.max(0, q.findIndex(x=>x.id===state.selectedId));
    state.selectedId = (q[idx+1] || q[0]).id;
    sync();
  };

  const complete = () => {
    if(state.mode!=="focus") return;
    const q=buildQueue();
    const cur=q.find(x=>x.id===state.selectedId) || null;
    if(!cur) return;

    if(cur.kind==="today"){
      const t=STORE.today.tasks.find(x=>x.id===cur.id);
      if(t){ t.done=true; t.doneAt=Date.now(); recomputeStreakIfCompleted(); }
    }else{
      const [_, goalId, msId, actionId] = cur.id.split(":");
      const g = STORE.goals.find(x=>x.id===goalId);
      const m = g?.milestones?.find(x=>x.id===msId);
      const a = m?.actions?.find(x=>x.id===actionId);
      if(a){ a.done=true; m.done = (m.actions.length>0 && m.actions.every(x=>x.done)); }
    }

    saveStore();
    state.selectedId = pickFirst();
    sync();
    updateChrome();
  };

  const breakNow = () => {
    pause();
    const p=STORE.settings.pomodoro;
    state.mode="break";
    state.remainingSec=(p.breakMin||5)*60;
    sync();
  };

  const note = () => {
    openModal("Distraction note", `
      <label>Note</label>
      <input id="n" placeholder="Write it down, then return…" />
      <div class="help">Capture reduces resistance. Return to the task.</div>
    `, `
      <button class="btn soft" data-close="1">Cancel</button>
      <button class="btn primary" id="ok">Save</button>
    `, (root2)=>{
      $("#ok",root2).addEventListener("click", ()=>{
        const text=safe($("#n",root2).value);
        if(!text) return;
        STORE.today.distractions.push({ id: uid(), text, ts: Date.now() });
        saveStore();
        closeModal();
        if(el){
          $("#fHint",el).textContent = `Saved note · ${STORE.today.distractions.length} today`;
          setTimeout(()=>{ if(el) $("#fHint",el).textContent="Press Esc to exit"; }, 2400);
        }
      });
    });
  };

  const applySettings = () => {
    const p = STORE.settings.pomodoro;
    p.focusMin = clamp(Number($("#pFocus",el).value)||25, 10, 180);
    p.breakMin = clamp(Number($("#pBreak",el).value)||5, 3, 60);
    p.longBreakMin = clamp(Number($("#pLong",el).value)||15, 5, 90);
    p.cyclesBeforeLong = clamp(Number($("#pEvery",el).value)||4, 2, 10);
    saveStore();
    if(!state.running && state.mode==="focus") state.remainingSec = p.focusMin*60;
    sync();
  };

  const onKey = (e) => {
    if(e.key==="Escape"){
      navigate("#/today");
      window.removeEventListener("keydown", onKey);
    }
  };

  const open = () => {
    if(el) return;
    ensureTimer();
    state.selectedId = state.selectedId || pickFirst();

    el = document.createElement("div");
    el.className = "flowRoot";
    el.innerHTML = `
      <div class="flowTop">
        <div class="flowBrand">
          <span style="width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);display:grid;place-items:center;">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 1.8c2.6 2.3 4 4.6 4 7.1 0 3.2-2 5.3-4 7.3-2-2-4-4.1-4-7.3 0-2.5 1.4-4.8 4-7.1Z" stroke="rgba(255,255,255,.9)" stroke-width="1.2"/>
              <path d="M9 5.1v9.9" stroke="rgba(255,255,255,.9)" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </span>
          <span>Flow Mode</span>
        </div>

        <div class="inline">
          <span class="flowPill" id="fMode">Focus</span>
          <span class="flowPill" id="fCycle">Cycle 1</span>
          <label class="flowPill" style="cursor:pointer;">
            <input type="checkbox" id="fIncl" style="width:auto; margin-right:8px;">
            Include goal actions
          </label>
          <button class="flowBtn ghost" id="fExit">Exit</button>
        </div>
      </div>

      <div class="flowMain">
        <div class="flowCard">
          <div class="flowPanel flowLeft">
            <div class="flowOrbs" aria-hidden="true">
              <span class="flowOrb" style="left:-18%;top:-20%;"></span>
              <span class="flowOrb o2" style="right:-22%;top:-10%;"></span>
              <span class="flowOrb o3" style="left:12%;bottom:-28%;"></span>
            </div>

            <div style="display:grid; place-items:center;">
              <div class="flowTime" id="fTime">00:00</div>
              <div class="flowSub" id="fSub">Choose a task. Start the timer. Keep the queue calm.</div>
            </div>

            <div class="flowNow">
              <div class="lab">Current</div>
              <div class="tit" id="fCur">—</div>
              <div class="flowNext" id="fNext">Next: —</div>
            </div>

            <div class="flowControls">
              <button class="flowBtn primary" id="fStart">Start</button>
              <button class="flowBtn" id="fPause">Pause</button>
              <button class="flowBtn" id="fComplete">Complete</button>
              <button class="flowBtn" id="fSkip">Skip</button>
              <button class="flowBtn" id="fBreak">Break</button>
              <button class="flowBtn ghost" id="fNote">Distraction note</button>
            </div>

            <div class="help" style="margin-top:12px;">Complete updates Today tasks (and optionally goal actions).</div>
          </div>

          <div class="flowPanel flowRight">
            <div class="flowQueueHead">
              <h3>Queue</h3>
              <div class="flowMini" id="fMeta">—</div>
            </div>
            <div class="flowList" id="fList"></div>

            <div class="sep" style="margin:12px 0;"></div>

            <div class="flowQueueHead">
              <h3>Timer</h3>
              <div class="flowMini">Pomodoro-ish</div>
            </div>

            <div class="grid2">
              <div><label>Focus (min)</label><input id="pFocus" type="number" min="10" step="5"></div>
              <div><label>Break (min)</label><input id="pBreak" type="number" min="3" step="1"></div>
            </div>

            <div class="grid2" style="margin-top:10px;">
              <div><label>Long break (min)</label><input id="pLong" type="number" min="5" step="5"></div>
              <div><label>Long every (cycles)</label><input id="pEvery" type="number" min="2" step="1"></div>
            </div>

            <div class="help">Settings persist locally.</div>
          </div>
        </div>
      </div>

      <div class="flowFoot">
        <div>Calm execution · one task at a time</div>
        <div id="fHint">Press Esc to exit</div>
      </div>
    `;

    root.setAttribute("aria-hidden","false");
    root.appendChild(el);

    // init settings inputs
    const p=STORE.settings.pomodoro;
    $("#pFocus",el).value = p.focusMin || 25;
    $("#pBreak",el).value = p.breakMin || 5;
    $("#pLong",el).value = p.longBreakMin || 15;
    $("#pEvery",el).value = p.cyclesBeforeLong || 4;

    $("#fIncl",el).checked = !!state.includeGoalActions;

    $("#fExit",el).addEventListener("click", ()=>navigate("#/today"));
    $("#fStart",el).addEventListener("click", start);
    $("#fPause",el).addEventListener("click", pause);
    $("#fSkip",el).addEventListener("click", skip);
    $("#fComplete",el).addEventListener("click", complete);
    $("#fBreak",el).addEventListener("click", breakNow);
    $("#fNote",el).addEventListener("click", note);

    $("#fIncl",el).addEventListener("change",(e)=>{ state.includeGoalActions=!!e.target.checked; sync(); });

    ["pFocus","pBreak","pLong","pEvery"].forEach(id=>{
      $(`#${id}`,el).addEventListener("change", applySettings);
    });

    window.addEventListener("keydown", onKey);
    sync();
  };

  const close = () => {
    stopTick();
    if(el){ el.remove(); el=null; root.setAttribute("aria-hidden","true"); }
  };

  return { open, close };
})();

/* ---------------- Top buttons + quick actions ---------------- */
$("#btnFlow").addEventListener("click", ()=>navigate("#/flow"));

$("#btnCopy").addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(JSON.stringify(STORE, null, 2));
    $("#btnCopy").textContent = "Copied";
    setTimeout(()=>$("#btnCopy").textContent="Copy", 1200);
  }catch{
    openModal("Copy failed", `<div class="sub">Clipboard not available. Use DevTools → Application → localStorage.</div>`);
  }
});

$("#btnReset").addEventListener("click", ()=>{
  openModal("Reset data", `<div class="sub">This clears local data for this app. This can’t be undone.</div>`,
    `<button class="btn soft" data-close="1">Cancel</button><button class="btn danger" id="yes">Reset</button>`,
    (root)=>{
      $("#yes",root).addEventListener("click", ()=>{
        localStorage.removeItem(STORE_KEY);
        STORE = defaultStore();
        saveStore();
        closeModal();
        navigate("#/start");
        render();
      });
    }
  );
});

$("#qaAdd").addEventListener("click", ()=>{ navigate("#/today"); setTimeout(()=>$("#addOne")?.click(), 60); });
$("#qaTemplates").addEventListener("click", ()=>{ navigate("#/today"); setTimeout(openTemplatesModal, 60); });
$("#qaAutoWeek").addEventListener("click", ()=>{ autoPlanWeek(); navigate("#/week"); render(); });
$("#qaNewGoal").addEventListener("click", ()=>{ navigate("#/goals"); setTimeout(openNewGoalModal, 60); });

/* ---------------- Boot ---------------- */
if(!location.hash) location.hash = STORE.ui.lastRoute || "#/start";
render();
