/* SaverIoFlow App — Vanilla SPA + localStorage
   Drop 3: Dialogue (offline philosophical dialogue engine)
*/

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

const STORE_KEY = "saverioflow_final_v1";
const LEGACY_KEYS = ["saverioflow_mvp_v1"];

function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function clampInt(n, a, b){ n = Math.round(Number(n||0)); return Math.max(a, Math.min(b, n)); }
function escapeHtml(s=""){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s=""){ return escapeHtml(s).replace(/"/g,"&quot;"); }

const defaultState = () => ({
  today: {
    doneBy: "18:00",
    priority: "One meaningful step",
    tasks: []
  },
  goals: [],
  week: {
    // minimal placeholder for later drops
    days: { mon:[], tue:[], wed:[], thu:[], fri:[], sat:[], sun:[] }
  },
  ui: {
    lastDiscover: { focus: "clarity", timePerDay: 30 },
    dialogue: {
      topic: "meaning",
      philosopher: "socratic",
      depth: 2,
      // messages are per-session; stored to resume
      messages: [
        { role:"ai", ts: Date.now(), text: "Dialogue is a space for examination. What are you trying to understand right now?" }
      ],
      // internal pointer per topic to avoid repetition
      cursor: { meaning:0, control:0, desire:0, principles:0, effort:0 },
      // lightweight saved insights
      saved: []
    }
  }
});

function hydrateState(raw){
  const base = defaultState();
  const s = (raw && typeof raw === "object") ? raw : {};
  s.today = s.today || base.today;
  s.today.tasks = Array.isArray(s.today.tasks) ? s.today.tasks : base.today.tasks;
  s.today.doneBy = s.today.doneBy || base.today.doneBy;
  s.today.priority = s.today.priority || base.today.priority;

  s.goals = Array.isArray(s.goals) ? s.goals : base.goals;

  s.week = s.week || base.week;
  s.week.days = s.week.days || base.week.days;

  s.ui = s.ui || base.ui;
  s.ui.lastDiscover = s.ui.lastDiscover || base.ui.lastDiscover;

  // Dialogue
  s.ui.dialogue = s.ui.dialogue || base.ui.dialogue;
  s.ui.dialogue.topic = s.ui.dialogue.topic || base.ui.dialogue.topic;
  s.ui.dialogue.philosopher = s.ui.dialogue.philosopher || base.ui.dialogue.philosopher;
  s.ui.dialogue.depth = clampInt(s.ui.dialogue.depth || base.ui.dialogue.depth, 1, 3);
  s.ui.dialogue.messages = Array.isArray(s.ui.dialogue.messages) ? s.ui.dialogue.messages : base.ui.dialogue.messages;
  s.ui.dialogue.cursor = s.ui.dialogue.cursor || base.ui.dialogue.cursor;
  s.ui.dialogue.saved = Array.isArray(s.ui.dialogue.saved) ? s.ui.dialogue.saved : base.ui.dialogue.saved;

  return s;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return hydrateState(JSON.parse(raw));
    for(const k of LEGACY_KEYS){
      const legacy = localStorage.getItem(k);
      if(legacy){
        const s = hydrateState(JSON.parse(legacy));
        localStorage.setItem(STORE_KEY, JSON.stringify(s));
        return s;
      }
    }
    return defaultState();
  }catch{
    return defaultState();
  }
}

let state = loadState();

function saveState(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  updateSidebarStats();
}

const view = $("#view");
const resetBtn = $("#resetBtn");

const modal = $("#modal");
const modalClose = $("#modalClose");
const modalEyebrow = $("#modalEyebrow");
const modalTitle = $("#modalTitle");
const modalSub = $("#modalSub");
const modalBody = $("#modalBody");

resetBtn?.addEventListener("click", () => {
  state = defaultState();
  saveState();
  route();
});

modalClose?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  const inner = $(".modal__inner", modal);
  if(inner && !inner.contains(e.target)) closeModal();
});

function openModal({eyebrow="Modal", title="Title", sub="", bodyHTML=""}){
  if(!modal) return;
  modalEyebrow.textContent = eyebrow;
  modalTitle.textContent = title;
  modalSub.textContent = sub;
  modalBody.innerHTML = bodyHTML;
  modal.showModal();
  document.body.classList.add("is-modal");
}
function closeModal(){
  if(!modal) return;
  modal.close();
  document.body.classList.remove("is-modal");
}

/* ---------- Navigation ---------- */

window.addEventListener("hashchange", route);

function setActiveNav(routeName){
  $$(".nav__link").forEach(a => a.classList.toggle("is-active", a.dataset.route === routeName));
}

function route(){
  const hash = location.hash || "#/start";
  const [path, query] = hash.replace("#","").split("?");
  const qs = new URLSearchParams(query || "");

  if(path === "/start"){ setActiveNav("start"); renderStart(); return; }
  if(path === "/discover"){ setActiveNav("discover"); renderDiscover(); return; }
  if(path === "/goals"){ setActiveNav("goals"); renderGoals({ optimize: qs.get("optimize")==="1" }); return; }
  if(path === "/today"){ setActiveNav("today"); renderToday(); return; }
  if(path === "/week"){ setActiveNav("week"); renderWeek(); return; }

  // Flow comes in Drop 2
  if(path === "/flow"){ setActiveNav("flow"); renderComingSoon("Flow mode", "Fullscreen focus execution arrives next."); return; }

  // Dialogue (Drop 3)
  if(path === "/dialogue"){ setActiveNav("dialogue"); renderDialogue(); return; }

  location.hash = "#/start";
}

function updateSidebarStats(){
  const todayTasks = state.today.tasks.length;
  const todayDone = state.today.tasks.filter(t => t.done).length;
  $("#statToday").textContent = `${todayDone}/${todayTasks}`;
  $("#statGoals").textContent = String(state.goals.length);
  $("#statFocus").textContent = sidebarSuggestion();
}

function sidebarSuggestion(){
  if(state.goals.length === 0) return "Start in Discover";
  const open = state.today.tasks.filter(t => !t.done).length;
  if(open === 0) return "Add one step";
  if(open >= 3) return "Protect one block";
  return "Keep it small";
}

/* ---------- Common UI helpers ---------- */

function header(title, sub, actionsHTML=""){
  return `
    <div class="view__head">
      <div class="view__title">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">${escapeHtml(sub || "")}</p>
      </div>
      <div class="view__actions">${actionsHTML}</div>
    </div>
  `;
}

function cardNav(title, sub, href, tag=""){
  return `
    <div class="card card--click" role="button" tabindex="0" data-go="${escapeAttr(href)}">
      <div class="row">
        ${tag ? `<span class="badge">${escapeHtml(tag)}</span>` : `<span class="badge badge--muted">—</span>`}
      </div>
      <h3 style="margin-top:10px;">${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(sub)}</p>
    </div>
  `;
}

function mountCardNav(){
  $$("[data-go]", view).forEach(card => {
    card.addEventListener("click", () => location.hash = card.dataset.go);
    card.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); location.hash = card.dataset.go; }
    });
  });
}

/* ---------- Start ---------- */

function renderStart(){
  view.innerHTML = `
    ${header("Where do you want to begin?", "Choose what feels most relevant. You can change this anytime.", "")}
    <div class="grid3">
      ${cardNav("Discover a goal", "When you’re unsure what to pursue — explore meaningful directions.", "#/discover", "Recommended")}
      ${cardNav("Optimize an existing goal", "Turn a vague goal into milestones and executable steps.", "#/goals?optimize=1", "Structure")}
      ${cardNav("Plan today", "Translate intent into one calm, realistic day.", "#/today", "Execution")}
    </div>

    <div class="hr"></div>

    <div class="grid3">
      ${cardNav("Dialogue", "A philosophical thinking space — questions before action.", "#/dialogue", "Reflect")}
      ${cardNav("Week", "A wider context (lightweight).", "#/week", "Context")}
      ${cardNav("Flow mode", "Fullscreen focus space (next drop).", "#/flow", "Soon")}
    </div>
  `;
  mountCardNav();
  updateSidebarStats();
}

/* ---------- Discover ---------- */

function renderDiscover(){
  const last = state.ui.lastDiscover || { focus:"clarity", timePerDay:30 };
  view.innerHTML = `
    ${header(
      "Explore meaningful directions",
      "This is not motivation. It’s clarity: choosing goals you can stand behind.",
      `<button class="btn btn--primary btn--sm" id="genBtn" type="button">Explore options</button>`
    )}

    <div class="grid3">
      <div class="card">
        <p class="eyebrow">Inputs</p>

        <div class="field">
          <div class="label">Focus type</div>
          <select class="select" id="discFocus">
            <option value="clarity">Clarity</option>
            <option value="skill">Skill</option>
            <option value="build">Build</option>
            <option value="health">Health</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div class="field">
          <div class="label">Minutes per day</div>
          <select class="select" id="discMin">
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="45">45</option>
            <option value="60">60</option>
            <option value="90">90</option>
          </select>
        </div>

        <div class="hr"></div>
        <p class="muted">
          We generate options based on time, focus, and clarity —
          not trends or pressure.
        </p>
      </div>

      <div class="card" style="grid-column: span 2;">
        <p class="eyebrow">Options</p>
        <div id="discOut" class="stack"></div>
      </div>
    </div>
  `;

  $("#discFocus").value = last.focus || "clarity";
  $("#discMin").value = String(last.timePerDay || 30);

  $("#genBtn").addEventListener("click", () => {
    const focus = $("#discFocus").value;
    const mpd = Number($("#discMin").value || 30);
    state.ui.lastDiscover = { focus, timePerDay: mpd };
    saveState();

    const opts = discoverOptions(focus, mpd);
    $("#discOut").innerHTML = opts.map(o => `
      <div class="item item--row">
        <div>
          <div class="item__title">${escapeHtml(o.title)}</div>
          <div class="item__meta">${escapeHtml(o.meta)}</div>
        </div>
        <div class="row">
          <button class="btn btn--ghost btn--sm" data-preview="${escapeAttr(o.id)}" type="button">Preview</button>
          <button class="btn btn--primary btn--sm" data-commit="${escapeAttr(o.id)}" type="button">Commit</button>
        </div>
      </div>
    `).join("");

    $$("[data-preview]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.preview;
      const opt = opts.find(x => x.id === id);
      openModal({
        eyebrow:"Discover",
        title: opt.title,
        sub: "A calm direction you can test for 14 days.",
        bodyHTML: `
          <div class="card" style="margin-top:10px;">
            <p style="font-weight:700;">What this builds</p>
            <p class="muted" style="margin-top:6px;">${escapeHtml(opt.preview)}</p>
            <div class="hr"></div>
            <p style="font-weight:700;">First steps</p>
            <ul class="bullets">
              ${opt.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}
            </ul>
          </div>
          <div class="row" style="margin-top:12px;">
            <button class="btn btn--primary" id="commitFromPreview" type="button">Commit</button>
            <button class="btn btn--ghost" id="closePreview" type="button">Close</button>
          </div>
        `
      });
      $("#closePreview").addEventListener("click", closeModal);
      $("#commitFromPreview").addEventListener("click", () => {
        closeModal();
        commitDiscoverOption(opt, mpd);
      });
    }));

    $$("[data-commit]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.commit;
      const opt = opts.find(x => x.id === id);
      commitDiscoverOption(opt, mpd);
    }));
  });

  updateSidebarStats();
}

function discoverOptions(focus, mpd){
  const m = clampInt(mpd, 10, 120);
  const id = () => uid();

  // Gentle, non-hype options:
  const bank = {
    clarity: [
      {
        title: "Clarify your next 90 days",
        preview: "You’ll define what ‘done’ means, reduce noise, and commit to one coherent direction.",
        steps: ["Write a definition of done", "Choose one constraint", "Design a weekly rhythm"]
      },
      {
        title: "Reduce obligations, increase intention",
        preview: "You’ll identify unnecessary commitments and regain calm control over time.",
        steps: ["List obligations", "Remove one non-essential", "Protect one focus block"]
      },
      {
        title: "Build a personal decision framework",
        preview: "You’ll create simple principles that guide goals, not moods.",
        steps: ["Name 3 principles", "Test them on decisions", "Turn one into actions"]
      }
    ],
    skill: [
      {
        title: "Learn one skill deeply",
        preview: "You’ll select one sub-skill and practice it with feedback, not randomness.",
        steps: ["Choose one sub-skill", "Pick a practice format", "Ship a small artifact"]
      },
      {
        title: "Strengthen focus as a skill",
        preview: "You’ll train attention with short blocks and review what distracts you.",
        steps: ["2 focus blocks/day", "Log distractions", "Adjust environment"]
      },
      {
        title: "Write, speak, or create with clarity",
        preview: "You’ll produce output steadily, without perfection pressure.",
        steps: ["Define output cadence", "Create one template", "Publish a small piece"]
      }
    ],
    build: [
      {
        title: "Ship a small project",
        preview: "You’ll scope an MVP and ship calmly, step by step.",
        steps: ["Write MVP boundary", "Build core path", "Polish and ship"]
      },
      {
        title: "Design a portfolio / presence",
        preview: "You’ll build something public, small, and coherent.",
        steps: ["Define narrative", "Create one artifact", "Publish and iterate"]
      },
      {
        title: "Automate one recurring pain",
        preview: "You’ll pick one friction point and remove it through a small system.",
        steps: ["Choose the pain", "Design simplest automation", "Test weekly"]
      }
    ],
    health: [
      {
        title: "Create a calm health baseline",
        preview: "You’ll stabilize sleep, movement, and recovery with gentle consistency.",
        steps: ["Pick one habit", "Track lightly", "Review weekly"]
      },
      {
        title: "Build strength without chaos",
        preview: "You’ll follow a minimal plan and progress steadily.",
        steps: ["Choose 2–3 exercises", "Schedule 3 days/week", "Review progress"]
      },
      {
        title: "Reduce stress through structure",
        preview: "You’ll reduce decision fatigue with a simple routine.",
        steps: ["Simplify mornings", "Protect evenings", "Add one recovery block"]
      }
    ],
    income: [
      {
        title: "Increase income through one lever",
        preview: "You’ll choose one income lever and commit to a weekly delivery rhythm.",
        steps: ["Pick one lever", "Define weekly delivery", "Review conversion"]
      },
      {
        title: "Build a small offer",
        preview: "You’ll define one offer and test it in small iterations.",
        steps: ["Define audience", "Create offer draft", "Test with 5 people"]
      },
      {
        title: "Improve career clarity",
        preview: "You’ll clarify what you want next and map steps with calm realism.",
        steps: ["Write role criteria", "List gaps", "Plan weekly actions"]
      }
    ]
  };

  const chosen = (bank[focus] || bank.clarity).slice(0,3).map((o, i) => ({
    id: id(),
    title: o.title,
    preview: o.preview,
    steps: o.steps,
    meta: `${m} min/day · calm structure · 14-day test`
  }));

  return chosen;
}

function commitDiscoverOption(opt, mpd){
  const minutes = clampInt(mpd, 10, 120);
  const goal = {
    id: uid(),
    title: opt.title,
    notes: "Created from Discover. You can refine this anytime.",
    totalEffortHours: Math.max(6, Math.round((minutes * 21) / 60)),
    minutesPerDay: minutes,
    milestones: autoMilestonesForFocus(state.ui.lastDiscover.focus, minutes, opt.title)
  };

  state.goals.unshift(goal);

  // Add a calm Today focus + first micro-step
  state.today.tasks.unshift({
    id: uid(),
    title: `Goal focus: ${opt.title}`,
    minutes: clampInt(minutes, 15, 90),
    done: false
  });

  const firstAction = goal.milestones?.[0]?.actions?.[0];
  if(firstAction){
    state.today.tasks.unshift({
      id: uid(),
      title: `Next step: ${firstAction.title}`,
      minutes: clampInt(firstAction.minutes || 20, 10, 60),
      done: false
    });
  }

  saveState();
  location.hash = "#/goals";
}

/* ---------- Goals (minimal placeholder, optimizer works) ---------- */

function renderGoals(opts = {}){
  const list = state.goals.map(g => `
    <div class="item item--row">
      <div>
        <div class="item__title">${escapeHtml(g.title)}</div>
        <div class="item__meta">${escapeHtml(`${g.minutesPerDay||30} min/day · effort ~${g.totalEffortHours||0}h`)}</div>
      </div>
      <div class="row">
        <button class="btn btn--ghost btn--sm" data-open="${escapeAttr(g.id)}" type="button">Open</button>
        <button class="btn btn--ghost btn--sm" data-del="${escapeAttr(g.id)}" type="button">Delete</button>
      </div>
    </div>
  `).join("");

  view.innerHTML = `
    ${header("Goals", "Goals are intentions. Milestones and actions make them real.", `
      <button class="btn btn--ghost btn--sm" id="optGoalBtn" type="button">Optimize</button>
      <button class="btn btn--primary btn--sm" id="newGoalBtn" type="button">Add</button>
    `)}
    <div class="stack">
      ${state.goals.length ? list : `<div class="card"><p class="muted">You haven’t committed to a goal yet. That’s the right moment to think.</p><div class="hr"></div><a class="btn btn--primary" href="#/discover">Discover a direction</a></div>`}
    </div>
  `;

  $("#optGoalBtn").addEventListener("click", optimizeExistingGoalModal);
  $("#newGoalBtn").addEventListener("click", addGoalModal);

  if(opts.optimize) optimizeExistingGoalModal();

  $$("[data-del]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.del;
    state.goals = state.goals.filter(g => g.id !== id);
    saveState();
    renderGoals();
  }));

  $$("[data-open]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.open;
    const g = state.goals.find(x => x.id === id);
    if(!g) return;
    openModal({
      eyebrow:"Goal",
      title:g.title,
      sub:"This is a lightweight preview (full goals suite is already planned).",
      bodyHTML: `
        <div class="card" style="margin-top:10px;">
          <p class="muted">${escapeHtml(g.notes || "")}</p>
          <div class="hr"></div>
          <p style="font-weight:700;">Milestones</p>
          <ul class="bullets">
            ${(g.milestones||[]).map(m=>`<li>${escapeHtml(m.title)} (${(m.actions||[]).length} actions)</li>`).join("") || "<li>—</li>"}
          </ul>
        </div>
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="addGoalFocusToToday" type="button">Add focus to Today</button>
          <button class="btn btn--ghost" id="closeGoal" type="button">Close</button>
        </div>
      `
    });
    $("#closeGoal").addEventListener("click", closeModal);
    $("#addGoalFocusToToday").addEventListener("click", () => {
      state.today.tasks.unshift({ id: uid(), title:`Goal focus: ${g.title}`, minutes: clampInt(g.minutesPerDay||30, 15, 90), done:false });
      saveState();
      closeModal();
      location.hash = "#/today";
    });
  }));

  updateSidebarStats();
}

function addGoalModal(){
  openModal({
    eyebrow:"Goals",
    title:"Add a goal",
    sub:"Keep it honest. You can refine later.",
    bodyHTML: `
      <div class="field">
        <div class="label">Goal title</div>
        <input class="input" id="goalTitle" placeholder="e.g. Ship a small project" />
      </div>
      <div class="grid2">
        <div class="field">
          <div class="label">Minutes/day</div>
          <select class="select" id="goalMpd">
            <option>15</option><option selected>30</option><option>45</option><option>60</option><option>90</option>
          </select>
        </div>
        <div class="field">
          <div class="label">Focus type</div>
          <select class="select" id="goalFocus">
            <option value="clarity">Clarity</option>
            <option value="skill">Skill</option>
            <option value="build">Build</option>
            <option value="health">Health</option>
            <option value="income">Income</option>
          </select>
        </div>
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="btn btn--primary" id="goalCreate" type="button">Create</button>
        <button class="btn btn--ghost" id="goalCancel" type="button">Cancel</button>
      </div>
    `
  });
  $("#goalCancel").addEventListener("click", closeModal);
  $("#goalCreate").addEventListener("click", () => {
    const title = $("#goalTitle").value.trim();
    if(!title) return;
    const mpd = Number($("#goalMpd").value || 30);
    const focus = $("#goalFocus").value;

    const goal = {
      id: uid(),
      title,
      notes:"Created manually.",
      totalEffortHours: Math.max(6, Math.round((mpd * 21) / 60)),
      minutesPerDay: mpd,
      milestones: autoMilestonesForFocus(focus, mpd, title)
    };
    state.goals.unshift(goal);
    saveState();
    closeModal();
    renderGoals();
  });
}

function optimizeExistingGoalModal(){
  openModal({
    eyebrow:"Optimize",
    title:"Make an existing goal executable",
    sub:"We translate your goal into milestones, actions, and a calm rhythm.",
    bodyHTML: `
      <div class="field">
        <div class="label">Your goal</div>
        <input class="input" id="ogTitle" placeholder="e.g. Launch my portfolio site" />
      </div>

      <div class="grid3" style="margin-top:12px;">
        <div class="field">
          <div class="label">Focus type</div>
          <select class="select" id="ogFocus">
            <option value="clarity">Clarity</option>
            <option value="skill">Skill</option>
            <option value="build">Build</option>
            <option value="health">Health</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div class="field">
          <div class="label">Minutes/day</div>
          <select class="select" id="ogMpd">
            <option value="15">15</option>
            <option value="30" selected>30</option>
            <option value="45">45</option>
            <option value="60">60</option>
            <option value="90">90</option>
          </select>
        </div>
        <div class="field">
          <div class="label">Milestones</div>
          <select class="select" id="ogStyle">
            <option value="replace">Replace</option>
            <option value="append">Append</option>
          </select>
        </div>
      </div>

      <div class="field" style="margin-top:12px;">
        <div class="label">Constraint (optional)</div>
        <input class="input" id="ogConstraint" placeholder="e.g. 3 days/week · evenings only · no weekends" />
      </div>

      <div class="row" style="margin-top:12px;">
        <button class="btn btn--primary" id="ogCreate" type="button">Optimize & create</button>
        <button class="btn btn--ghost" id="ogCancel" type="button">Cancel</button>
      </div>
    `
  });

  $("#ogCancel").addEventListener("click", closeModal);
  $("#ogCreate").addEventListener("click", () => {
    const title = $("#ogTitle").value.trim();
    if(!title) return;
    const focus = $("#ogFocus").value;
    const mpd = Number($("#ogMpd").value || 30);
    const style = $("#ogStyle").value;
    const constraint = $("#ogConstraint").value.trim();

    const goal = {
      id: uid(),
      title,
      notes: constraint ? `Constraint: ${constraint}` : "Optimized plan.",
      totalEffortHours: Math.max(6, Math.round((mpd * 21) / 60)),
      minutesPerDay: mpd,
      milestones: []
    };

    const generated = autoMilestonesForFocus(focus, mpd, title);
    goal.milestones = (style === "append") ? (goal.milestones.concat(generated)) : generated;

    state.goals.unshift(goal);
    state.today.tasks.unshift({ id: uid(), title:`Goal focus: ${title}`, minutes: clampInt(mpd, 15, 90), done:false });

    const firstAction = goal.milestones?.[0]?.actions?.[0];
    if(firstAction){
      state.today.tasks.unshift({ id: uid(), title:`Next step: ${firstAction.title}`, minutes: clampInt(firstAction.minutes||20, 10, 60), done:false });
    }

    saveState();
    closeModal();
    location.hash = "#/goals";
  });
}

/* ---------- Today (clearer text, simple tasks) ---------- */

function renderToday(){
  const t = state.today;
  const totalMin = t.tasks.reduce((s,x)=>s+(Number(x.minutes)||0),0);

  view.innerHTML = `
    ${header("Today’s focus", "A realistic plan for a meaningful day.", `
      <button class="btn btn--ghost btn--sm" id="addStepBtn" type="button">Add a step</button>
      <button class="btn btn--primary btn--sm" id="recBtn" type="button">Recommendation</button>
    `)}

    <div class="grid3">
      <div class="card">
        <p class="eyebrow">Setup</p>

        <div class="field">
          <div class="label">Priority</div>
          <input class="input" id="priorityInput" value="${escapeAttr(t.priority)}" placeholder="One meaningful step" />
        </div>

        <div class="field">
          <div class="label">Done-by</div>
          <input class="input" id="doneByInput" value="${escapeAttr(t.doneBy)}" placeholder="18:00" />
        </div>

        <div class="hr"></div>
        <p class="muted">Total planned</p>
        <p style="font-weight:780; font-size:1.25rem;">${totalMin} min</p>
        <p class="muted" style="margin-top:8px;">
          Completing everything is not required.
          Doing the right thing is.
        </p>
      </div>

      <div class="card" style="grid-column: span 2;">
        <p class="eyebrow">Steps</p>
        ${t.tasks.length ? `<ul class="list">${t.tasks.map(taskRow).join("")}</ul>` : `
          <div class="card" style="margin-top:12px;">
            <p class="muted">
              A calm day has no obligations yet.
              Add one meaningful step — or keep it empty.
            </p>
          </div>
        `}
      </div>
    </div>
  `;

  $("#priorityInput").addEventListener("input", (e)=>{ state.today.priority = e.target.value; saveState(); });
  $("#doneByInput").addEventListener("input", (e)=>{ state.today.doneBy = e.target.value; saveState(); });

  $("#addStepBtn").addEventListener("click", () => {
    openModal({
      eyebrow:"Today",
      title:"Add a step",
      sub:"Small and clear beats ambitious and vague.",
      bodyHTML: `
        <div class="field">
          <div class="label">Step</div>
          <textarea class="textarea" id="newTaskTitle" placeholder="e.g. Outline the next section"></textarea>
        </div>
        <div class="field">
          <div class="label">Minutes (optional)</div>
          <input class="input" id="newTaskMin" type="number" min="0" step="5" placeholder="30" />
        </div>
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="createTaskBtn" type="button">Add</button>
          <button class="btn btn--ghost" id="cancelTaskBtn" type="button">Cancel</button>
        </div>
      `
    });
    $("#cancelTaskBtn").addEventListener("click", closeModal);
    $("#createTaskBtn").addEventListener("click", () => {
      const title = $("#newTaskTitle").value.trim();
      const minutes = Number($("#newTaskMin").value || 0);
      if(!title) return;
      state.today.tasks.unshift({ id: uid(), title, minutes: minutes || 0, done:false });
      saveState();
      closeModal();
      renderToday();
    });
  });

  $("#recBtn").addEventListener("click", () => {
    const open = t.tasks.filter(x=>!x.done).length;
    const msg =
      open === 0 ? "Add one step that matters — nothing else."
      : open >= 4 ? "Your plan is heavy. Protect one focus block, then remove one non-essential task."
      : "Protect one uninterrupted block for your priority.";

    openModal({
      eyebrow:"Recommendation",
      title:"A calm improvement",
      sub:"Optional. No pressure.",
      bodyHTML: `
        <div class="card" style="margin-top:10px;">
          <p style="font-weight:750;">${escapeHtml(msg)}</p>
          <p class="muted" style="margin-top:8px;">Tip: decide the start time, not just the duration.</p>
        </div>
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="addFocus" type="button">Add focus block</button>
          <button class="btn btn--ghost" id="closeRec" type="button">Close</button>
        </div>
      `
    });
    $("#closeRec").addEventListener("click", closeModal);
    $("#addFocus").addEventListener("click", () => {
      state.today.tasks.unshift({ id: uid(), title:"Focus block (protected)", minutes:45, done:false });
      saveState();
      closeModal();
      renderToday();
    });
  });

  // toggle / delete
  t.tasks.forEach(task => {
    const rowEl = $(`[data-task="${task.id}"]`, view);
    if(!rowEl) return;
    $(".chk", rowEl).addEventListener("click", () => {
      task.done = !task.done;
      saveState();
      renderToday();
    });
    $(`[data-del="${task.id}"]`, rowEl)?.addEventListener("click", () => {
      state.today.tasks = state.today.tasks.filter(x => x.id !== task.id);
      saveState();
      renderToday();
    });
  });

  updateSidebarStats();
}

function taskRow(t){
  const meta = t.minutes ? `${t.minutes} min` : "—";
  return `
    <li class="item item--row" data-task="${escapeAttr(t.id)}">
      <div class="chk ${t.done ? "is-done":""}" role="button" aria-label="toggle done"></div>
      <div>
        <div class="item__title">${escapeHtml(t.title)}</div>
        <div class="item__meta">${escapeHtml(meta)}</div>
      </div>
      <button class="iconbtn2" type="button" data-del="${escapeAttr(t.id)}" aria-label="Delete">✕</button>
    </li>
  `;
}

/* ---------- Week (placeholder) ---------- */

function renderWeek(){
  view.innerHTML = `
    ${header("The week in context", "This view exists to support balance — not to fill every hour.", "")}
    <div class="card">
      <p class="muted">
        Weekly board + auto-plan arrives with the full planning suite.
        For now: use Discover → Goals → Today to stay coherent.
      </p>
    </div>
  `;
  updateSidebarStats();
}

function renderComingSoon(title, sub){
  view.innerHTML = `
    ${header(title, sub, "")}
    <div class="card">
      <p class="muted">You’ll get this in the next drop — without breaking your MVP.</p>
    </div>
  `;
  updateSidebarStats();
}

/* =========================
   DIALOGUE (Drop 3)
   ========================= */

const DIALOGUE_TOPICS = [
  { key:"meaning", title:"Meaning & direction", hint:"What is worth pursuing — and why?", school:"Socrates · Aristotle · Nietzsche" },
  { key:"control", title:"Control & acceptance", hint:"What can I influence — and what should I stop fighting?", school:"Stoicism" },
  { key:"desire", title:"Desire & simplicity", hint:"Do I really need this — or am I chasing it?", school:"Epicurus · Schopenhauer" },
  { key:"principles", title:"Principles & integrity", hint:"Can I stand behind this action?", school:"Kant" },
  { key:"effort", title:"Effort & resistance", hint:"What am I avoiding — and what would honest effort look like?", school:"Stoics · Kierkegaard · Camus" },
];

// 20 names (for credibility + scope)
const PHILOSOPHER_OPTIONS = [
  { key:"socratic", name:"Socrates (method)", line:"Define terms. Test assumptions. Ask better questions." },
  { key:"plato", name:"Plato", line:"Look beyond appearances. What is the form of the good here?" },
  { key:"aristotle", name:"Aristotle", line:"Purpose, virtue, habit. What is excellence in action?" },
  { key:"epictetus", name:"Epictetus", line:"Control vs. not. Return to what depends on you." },
  { key:"marcus", name:"Marcus Aurelius", line:"Act well. Accept what cannot be changed." },
  { key:"seneca", name:"Seneca", line:"Time is life. Avoid false urgency." },
  { key:"epicurus", name:"Epicurus", line:"Tranquility through simple, necessary desires." },
  { key:"montaigne", name:"Montaigne", line:"Human, imperfect, honest. Live without performance." },
  { key:"kant", name:"Immanuel Kant", line:"Principles you can will universally. Respect persons." },
  { key:"mill", name:"J. S. Mill", line:"Consider consequences while protecting individuality." },
  { key:"arendt", name:"Hannah Arendt", line:"Think before acting within systems." },
  { key:"schopenhauer", name:"Schopenhauer", line:"Desire drives suffering. See the pattern clearly." },
  { key:"nietzsche", name:"Nietzsche", line:"Create values. Choose your becoming consciously." },
  { key:"pascal", name:"Pascal", line:"Distraction hides deeper questions." },
  { key:"weil", name:"Simone Weil", line:"Attention is a moral act." },
  { key:"confucius", name:"Confucius", line:"Cultivate character through right relationships and ritual." },
  { key:"laozi", name:"Laozi", line:"Less forcing, more alignment. Do what fits." },
  { key:"buddha", name:"Buddha", line:"Suffering and attachment. Notice, loosen, return." },
  { key:"kierkegaard", name:"Kierkegaard", line:"Choose with inwardness. Anxiety signals freedom." },
  { key:"camus", name:"Camus", line:"Face the absurd, still choose lucid action." },
];

const DIALOGUE_QUESTIONS = {
  meaning: [
    "What do you mean by this goal — in concrete terms?",
    "If you achieved it, what would change in your daily life?",
    "What would be lost if you did not pursue it?",
    "What would remain?",
    "Is this something you chose — or something you inherited from expectations?",
    "What is the smallest honest version of this goal?",
    "What would ‘enough’ look like here?",
  ],
  control: [
    "What part of this depends entirely on you?",
    "What part never did?",
    "If you acted only on what is in your control, what would you do today?",
    "What are you resisting that may require acceptance instead?",
    "Which fear is quietly shaping your decisions?",
    "What would calm courage look like for 20 minutes?",
  ],
  desire: [
    "Which desire here is natural and necessary?",
    "Which desire creates more disturbance than satisfaction?",
    "If no one could see your progress, would you still want this?",
    "What are you hoping this goal will protect you from feeling?",
    "What would remain if you removed the craving for certainty?",
    "What simple routine would reduce anxiety this week?",
  ],
  principles: [
    "What principle are you acting on right now? Say it as a rule.",
    "Would you accept this rule if everyone acted on it?",
    "Are you treating yourself as an end — or merely as a means?",
    "What would integrity look like in one concrete action today?",
    "Which compromise would you later regret?",
    "What is the smallest action that still respects your principle?",
  ],
  effort: [
    "What are you avoiding — specifically?",
    "What story are you telling yourself about why you can’t start?",
    "If the task were easy, what would the first 10 minutes be?",
    "What discomfort are you unwilling to feel — and what does it cost you?",
    "What would honest effort look like today without drama?",
    "What would you do if you accepted imperfection as the price of progress?",
  ]
};

const PHILOSOPHER_LENSES = {
  socratic: { tone:"inquisitive", opener:"Let’s clarify terms before we move.", close:"What assumption is hidden here?" },
  plato: { tone:"ideal", opener:"Let’s separate appearance from what is real.", close:"What is the true good in this?" },
  aristotle: { tone:"practical", opener:"Let’s think in terms of purpose and habit.", close:"What would excellence look like here?" },
  epictetus: { tone:"stoic", opener:"Return to control: what depends on you?", close:"What is yours to do, today?" },
  marcus: { tone:"stoic", opener:"Act well, accept the rest.", close:"What is the virtuous action now?" },
  seneca: { tone:"stoic", opener:"Your time is your life. Spend it deliberately.", close:"What is false urgency here?" },
  epicurus: { tone:"calm", opener:"Let’s seek tranquility rather than more.", close:"Which desire can you simplify?" },
  montaigne: { tone:"human", opener:"Let’s be honest, not impressive.", close:"What is true for you, without performance?" },
  kant: { tone:"principled", opener:"Name your maxim as a rule.", close:"Can you stand behind it universally?" },
  mill: { tone:"consequences", opener:"Consider outcomes without losing yourself.", close:"Who is affected, and how?" },
  arendt: { tone:"responsibility", opener:"Let’s think before we act within systems.", close:"What are you enabling by acting or not acting?" },
  schopenhauer: { tone:"realist", opener:"Notice how desire pulls you into suffering.", close:"What does the will demand here?" },
  nietzsche: { tone:"values", opener:"What values are you choosing to live by?", close:"Is this your goal — or theirs?" },
  pascal: { tone:"lucid", opener:"Distraction is often a symptom.", close:"What are you not wanting to face?" },
  weil: { tone:"attention", opener:"Let’s return to attention.", close:"What deserves your attention, precisely?" },
  confucius: { tone:"cultivation", opener:"Let’s think character and relationships.", close:"What is the right practice here?" },
  laozi: { tone:"alignment", opener:"Where are you forcing what doesn’t fit?", close:"What happens if you stop pushing?" },
  buddha: { tone:"nonattachment", opener:"Let’s observe attachment without judgment.", close:"What happens if you let it loosen?" },
  kierkegaard: { tone:"inward", opener:"Anxiety can signal freedom.", close:"What choice are you avoiding?" },
  camus: { tone:"courage", opener:"Even without certainty, we can act lucidly.", close:"What is your honest next act?" },
};

function ensureDialogue(){
  state = hydrateState(state);
  const d = state.ui.dialogue;
  if(!d.messages.length){
    d.messages.push({ role:"ai", ts: Date.now(), text:"Dialogue is a space for examination. What are you trying to understand right now?" });
  }
}

function renderDialogue(){
  ensureDialogue();
  const d = state.ui.dialogue;
  const topic = DIALOGUE_TOPICS.find(t => t.key === d.topic) || DIALOGUE_TOPICS[0];
  const phil = PHILOSOPHER_OPTIONS.find(p => p.key === d.philosopher) || PHILOSOPHER_OPTIONS[0];
  const lens = PHILOSOPHER_LENSES[d.philosopher] || PHILOSOPHER_LENSES.socratic;

  view.innerHTML = `
    ${header("Dialogue — reflect and examine", "A philosophical thinking space: questions before action.", `
      <button class="btn btn--ghost btn--sm" id="dlgReset" type="button">Reset</button>
      <button class="btn btn--primary btn--sm" id="dlgExport" type="button">Export</button>
    `)}

    <div class="dialogue">
      <div class="dialogue__top card">
        <div class="grid3">
          <div class="field">
            <div class="label">Topic</div>
            <select class="select" id="dlgTopic">
              ${DIALOGUE_TOPICS.map(t=>`<option value="${escapeAttr(t.key)}"${t.key===topic.key?" selected":""}>${escapeHtml(t.title)}</option>`).join("")}
            </select>
            <div class="help">${escapeHtml(topic.hint)} · <span class="gold">${escapeHtml(topic.school)}</span></div>
          </div>

          <div class="field">
            <div class="label">Lens</div>
            <select class="select" id="dlgPhil">
              ${PHILOSOPHER_OPTIONS.map(p=>`<option value="${escapeAttr(p.key)}"${p.key===phil.key?" selected":""}>${escapeHtml(p.name)}</option>`).join("")}
            </select>
            <div class="help">${escapeHtml(phil.line)}</div>
          </div>

          <div class="field">
            <div class="label">Depth</div>
            <div class="seg" role="group" aria-label="Depth">
              <button class="seg__btn ${d.depth===1?"is-on":""}" data-depth="1" type="button">Light</button>
              <button class="seg__btn ${d.depth===2?"is-on":""}" data-depth="2" type="button">Standard</button>
              <button class="seg__btn ${d.depth===3?"is-on":""}" data-depth="3" type="button">Deep</button>
            </div>
            <div class="help">No advice. No prescriptions. Only clearer questions.</div>
          </div>
        </div>
      </div>

      <div class="dialogue__log" id="dlgLog" aria-live="polite">
        ${d.messages.map(m => renderMsg(m)).join("")}
      </div>

      <div class="dialogue__composer card">
        <div class="row row--between">
          <div class="muted">
            <span class="gold">${escapeHtml(lens.opener)}</span>
            <span class="muted"> · Keep it honest, not impressive.</span>
          </div>
          <button class="btn btn--ghost btn--sm" id="dlgSaveInsight" type="button">Save insight</button>
        </div>

        <textarea class="textarea" id="dlgInput" rows="3"
          placeholder="Write what you actually think. (Enter = send · Shift+Enter = new line)"></textarea>

        <div class="row row--between" style="margin-top:10px;">
          <div class="muted">Try: define terms · test assumptions · name what you control</div>
          <div class="row">
            <button class="btn btn--ghost btn--sm" id="dlgToGoals" type="button">Go to Goals</button>
            <button class="btn btn--primary btn--sm" id="dlgSend" type="button">Send</button>
          </div>
        </div>
      </div>

      <div class="card">
        <p class="muted">
          <strong>Note:</strong> Dialogue is a structured reflection tool.
          It does not provide professional advice. If you need urgent help, seek local support.
        </p>
      </div>
    </div>
  `;

  // handlers
  $("#dlgTopic").addEventListener("change", (e) => {
    d.topic = e.target.value;
    saveState();
    renderDialogue();
  });

  $("#dlgPhil").addEventListener("change", (e) => {
    d.philosopher = e.target.value;
    saveState();
    renderDialogue();
  });

  $$("[data-depth]").forEach(btn => btn.addEventListener("click", () => {
    d.depth = clampInt(btn.dataset.depth, 1, 3);
    saveState();
    renderDialogue();
  }));

  $("#dlgReset").addEventListener("click", () => {
    openModal({
      eyebrow:"Dialogue",
      title:"Reset this dialogue?",
      sub:"This clears the current conversation, not your goals.",
      bodyHTML: `
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="dlgResetYes" type="button">Reset</button>
          <button class="btn btn--ghost" id="dlgResetNo" type="button">Cancel</button>
        </div>
      `
    });
    $("#dlgResetNo").addEventListener("click", closeModal);
    $("#dlgResetYes").addEventListener("click", () => {
      d.messages = [{ role:"ai", ts:Date.now(), text:"Dialogue is a space for examination. What are you trying to understand right now?" }];
      saveState();
      closeModal();
      renderDialogue();
    });
  });

  $("#dlgExport").addEventListener("click", () => {
    const txt = exportDialogueText();
    openModal({
      eyebrow:"Dialogue",
      title:"Export",
      sub:"Copy your conversation as text.",
      bodyHTML: `
        <div class="field">
          <div class="label">Text</div>
          <textarea class="textarea" rows="10" id="dlgExportText">${escapeHtml(txt)}</textarea>
        </div>
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="dlgCopy" type="button">Copy</button>
          <button class="btn btn--ghost" id="dlgCloseExport" type="button">Close</button>
        </div>
      `
    });
    $("#dlgCloseExport").addEventListener("click", closeModal);
    $("#dlgCopy").addEventListener("click", async () => {
      try{
        await navigator.clipboard.writeText(txt);
        closeModal();
      }catch{
        // ignore
      }
    });
  });

  $("#dlgToGoals").addEventListener("click", () => location.hash = "#/goals");

  $("#dlgSaveInsight").addEventListener("click", () => {
    openModal({
      eyebrow:"Dialogue",
      title:"Save an insight",
      sub:"A short sentence you want to remember.",
      bodyHTML: `
        <div class="field">
          <div class="label">Insight</div>
          <input class="input" id="insightText" placeholder="e.g. I’m chasing approval, not meaning." />
        </div>
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="saveInsightBtn" type="button">Save</button>
          <button class="btn btn--ghost" id="cancelInsightBtn" type="button">Cancel</button>
        </div>
      `
    });
    $("#cancelInsightBtn").addEventListener("click", closeModal);
    $("#saveInsightBtn").addEventListener("click", () => {
      const text = $("#insightText").value.trim();
      if(!text) return;
      d.saved.unshift({ id:uid(), ts:Date.now(), topic:d.topic, philosopher:d.philosopher, text });
      // also offer to add to Today as a note-task
      state.today.tasks.unshift({ id:uid(), title:`Reflection: ${text}`, minutes:0, done:false });
      saveState();
      closeModal();
      renderDialogue();
    });
  });

  const input = $("#dlgInput");
  $("#dlgSend").addEventListener("click", () => sendDialogueMessage(input.value));
  input.addEventListener("keydown", (e) => {
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      sendDialogueMessage(input.value);
    }
  });

  // scroll log to bottom
  const log = $("#dlgLog");
  if(log) log.scrollTop = log.scrollHeight;

  updateSidebarStats();
}

function renderMsg(m){
  const role = m.role === "you" ? "You" : "Dialogue";
  const cls = m.role === "you" ? "msg msg--you" : "msg msg--ai";
  return `
    <div class="${cls}">
      <div class="msg__role">${escapeHtml(role)}</div>
      <div class="msg__text">${escapeHtml(m.text)}</div>
    </div>
  `;
}

function sendDialogueMessage(rawText){
  ensureDialogue();
  const d = state.ui.dialogue;
  const text = String(rawText || "").trim();
  if(!text) return;

  d.messages.push({ role:"you", ts:Date.now(), text });

  const reply = generateDialogueReply(text);
  d.messages.push({ role:"ai", ts:Date.now(), text: reply });

  saveState();
  renderDialogue();
}

function exportDialogueText(){
  const d = state.ui.dialogue;
  const topic = DIALOGUE_TOPICS.find(t=>t.key===d.topic)?.title || d.topic;
  const phil = PHILOSOPHER_OPTIONS.find(p=>p.key===d.philosopher)?.name || d.philosopher;
  const lines = [];
  lines.push(`SaverIoFlow Dialogue`);
  lines.push(`Topic: ${topic}`);
  lines.push(`Lens: ${phil}`);
  lines.push(`—`);
  for(const m of d.messages){
    lines.push(`${m.role === "you" ? "You" : "Dialogue"}: ${m.text}`);
  }
  return lines.join("\n");
}

function generateDialogueReply(lastUserText){
  const d = state.ui.dialogue;
  const topicKey = d.topic;
  const depth = clampInt(d.depth, 1, 3);
  const lens = PHILOSOPHER_LENSES[d.philosopher] || PHILOSOPHER_LENSES.socratic;

  const pool = DIALOGUE_QUESTIONS[topicKey] || DIALOGUE_QUESTIONS.meaning;
  const c = d.cursor || (d.cursor = { meaning:0, control:0, desire:0, principles:0, effort:0 });
  const idx = c[topicKey] ?? 0;
  const q = pool[idx % pool.length];
  c[topicKey] = (idx + 1);

  // Minimal reflective lead-in (no advice)
  const lead = buildLead(lastUserText, lens, depth, topicKey);
  const follow = buildFollow(depth, lens, topicKey);

  // End with question (core of Socratic style)
  return `${lead}\n\n${q}${follow ? `\n\n${follow}` : ""}`;
}

function buildLead(userText, lens, depth, topicKey){
  // Keep it calm and non-judgmental; avoid quoting user verbatim
  const topicNames = {
    meaning:"meaning and direction",
    control:"control and acceptance",
    desire:"desire and simplicity",
    principles:"principles and integrity",
    effort:"effort and resistance"
  };
  const t = topicNames[topicKey] || "clarity";
  if(depth === 1){
    return `${lens.opener} We’re looking at ${t}.`;
  }
  if(depth === 2){
    return `${lens.opener} We’re looking at ${t}. Let’s make the question precise.`;
  }
  return `${lens.opener} We’re looking at ${t}. We’ll aim for precision, then one concrete implication.`;
}

function buildFollow(depth, lens, topicKey){
  if(depth === 1) return "";
  if(depth === 2) return `${lens.close}`;
  // depth 3: tiny exercise prompt
  const exercises = {
    meaning: "Mini-exercise: define “done” in one sentence. What would prove the goal is real?",
    control: "Mini-exercise: list two things you control today, and one you explicitly release.",
    desire: "Mini-exercise: name one desire you can simplify this week. What replaces it?",
    principles: "Mini-exercise: write your rule as one maxim. Where does it break under universality?",
    effort: "Mini-exercise: describe the first 10 minutes. What friction can you remove beforehand?"
  };
  return `${lens.close}\n\n${exercises[topicKey] || ""}`.trim();
}

/* ---------- Offline milestone templates (used by Discover/Optimize) ---------- */

function autoMilestonesForFocus(focus, mpd, goalTitle){
  const m = clampInt(mpd || 30, 10, 120);
  const scale = (baseMin) => clampInt(Math.round(baseMin * (m/30)), 10, 120);

  const lib = {
    clarity: [
      { title:"Define the outcome", actions:[
        { title:"Write a 1-page definition of done", minutes: scale(30), done:false },
        { title:"List constraints + non-goals", minutes: scale(25), done:false },
      ]},
      { title:"Design a calm rhythm", actions:[
        { title:"Choose 3 weekly focus sessions", minutes: scale(20), done:false },
        { title:"Write a weekly review checklist", minutes: scale(20), done:false },
      ]},
      { title:"Execute the first 7 days", actions:[
        { title:"Prepare your first 3 steps", minutes: scale(20), done:false },
        { title:"Do one protected focus block", minutes: scale(45), done:false },
      ]},
    ],
    skill: [
      { title:"Build the learning ladder", actions:[
        { title:"Define the core sub-skill", minutes: scale(25), done:false },
        { title:"Pick one practice format", minutes: scale(20), done:false },
      ]},
      { title:"Deliberate practice", actions:[
        { title:"Do 5 sessions with feedback notes", minutes: scale(45), done:false },
        { title:"Create an error list + fix plan", minutes: scale(25), done:false },
      ]},
      { title:"Ship proof of skill", actions:[
        { title:"Produce a small artifact", minutes: scale(60), done:false },
        { title:"Review / publish / share", minutes: scale(30), done:false },
      ]},
    ],
    build: [
      { title:"Scope & architecture", actions:[
        { title:"Define MVP boundary in 10 bullets", minutes: scale(25), done:false },
        { title:"Sketch the main flow (screens → data)", minutes: scale(35), done:false },
      ]},
      { title:"First working version", actions:[
        { title:"Implement core path end-to-end", minutes: scale(60), done:false },
        { title:"Add a minimal QA checklist", minutes: scale(20), done:false },
      ]},
      { title:"Polish & ship", actions:[
        { title:"Fix friction points (top 3)", minutes: scale(30), done:false },
        { title:"Ship a first release", minutes: scale(30), done:false },
      ]},
    ],
    health: [
      { title:"Stabilize baseline", actions:[
        { title:"Set a sleep anchor time", minutes: scale(15), done:false },
        { title:"Plan movement 3×/week", minutes: scale(20), done:false },
      ]},
      { title:"Reduce friction", actions:[
        { title:"Prepare environment (clothes / food / space)", minutes: scale(20), done:false },
        { title:"Define a recovery ritual", minutes: scale(15), done:false },
      ]},
      { title:"Review and adjust", actions:[
        { title:"Track lightly for 7 days", minutes: scale(10), done:false },
        { title:"Adjust one thing, not everything", minutes: scale(15), done:false },
      ]},
    ],
    income: [
      { title:"Choose one lever", actions:[
        { title:"Pick one lever (skills/offer/network)", minutes: scale(20), done:false },
        { title:"Define a weekly delivery rhythm", minutes: scale(20), done:false },
      ]},
      { title:"Build & test", actions:[
        { title:"Create a simple offer draft", minutes: scale(35), done:false },
        { title:"Test with 5 conversations", minutes: scale(45), done:false },
      ]},
      { title:"Refine", actions:[
        { title:"Review feedback; refine one thing", minutes: scale(25), done:false },
        { title:"Repeat weekly", minutes: scale(20), done:false },
      ]},
    ]
  };

  return (lib[focus] || lib.clarity).map(ms => ({
    id: uid(),
    title: ms.title,
    actions: ms.actions.map(a => ({ id: uid(), title: a.title, minutes: a.minutes, done: false }))
  }));
}

// init
route();
updateSidebarStats();
