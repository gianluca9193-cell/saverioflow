/* SaverIoFlow App (MVP) - Vanilla SPA + localStorage */

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

const STORE_KEY = "saverioflow_mvp_v1";

const defaultState = () => ({
  today: {
    doneBy: "18:00",
    priority: "One key step",
    tasks: [
      { id: uid(), title: "Main task", minutes: 45, done: false },
      { id: uid(), title: "Secondary task", minutes: 30, done: false },
      { id: uid(), title: "Small admin", minutes: 15, done: false }
    ]
  },
  goals: [
    demoGoal()
  ],
  ui: {
    lastDiscover: { focus: "clarity", timePerDay: 20 }
  }
});

function demoGoal(){
  return {
    id: uid(),
    title: "Launch a small project",
    notes: "A calm, step-by-step plan.",
    totalEffortHours: 18,
    minutesPerDay: 45,
    milestones: [
      { id: uid(), title: "Define scope", actions: [
        { id: uid(), title: "Write 1-page outline", minutes: 30, done: false },
        { id: uid(), title: "List requirements", minutes: 30, done: false },
      ]},
      { id: uid(), title: "Build first version", actions: [
        { id: uid(), title: "Implement core flow", minutes: 90, done: false },
        { id: uid(), title: "Polish UI", minutes: 60, done: false },
      ]},
    ]
  };
}

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : defaultState();
  }catch{
    return defaultState();
  }
}

function saveState(){
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  updateSidebarStats();
}

let state = loadState();

const view = $("#view");
const resetBtn = $("#resetBtn");

const modal = $("#modal");
const modalClose = $("#modalClose");
const modalEyebrow = $("#modalEyebrow");
const modalTitle = $("#modalTitle");
const modalSub = $("#modalSub");
const modalBody = $("#modalBody");

resetBtn.addEventListener("click", () => {
  state = defaultState();
  saveState();
  route();
});

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  const inner = $(".modal__inner", modal);
  if(inner && !inner.contains(e.target)) closeModal();
});

function openModal({eyebrow="Modal", title="Title", sub="", bodyHTML=""}){
  modalEyebrow.textContent = eyebrow;
  modalTitle.textContent = title;
  modalSub.textContent = sub;
  modalBody.innerHTML = bodyHTML;
  modal.showModal();
  document.body.classList.add("is-modal");
}
function closeModal(){
  modal.close();
  document.body.classList.remove("is-modal");
}

window.addEventListener("hashchange", route);

function setActiveNav(routeName){
  $$(".nav__link").forEach(a => a.classList.toggle("is-active", a.dataset.route === routeName));
}

function route(){
  const hash = location.hash || "#/start";
  const [path] = hash.replace("#", "").split("?");

  if(path === "/start"){ setActiveNav("start"); renderStart(); return; }
  if(path === "/today"){ setActiveNav("today"); renderToday(); return; }
  if(path === "/goals"){ setActiveNav("goals"); renderGoals(); return; }
  if(path === "/discover"){ setActiveNav("discover"); renderDiscover(); return; }

  location.hash = "#/start";
}

function updateSidebarStats(){
  const todayTasks = state.today.tasks.length;
  const todayDone = state.today.tasks.filter(t => t.done).length;
  $("#statToday").textContent = `${todayDone}/${todayTasks}`;

  $("#statGoals").textContent = String(state.goals.length);

  const focus = focusSuggestion(state.today);
  $("#statFocus").textContent = focus;
}

function focusSuggestion(today){
  const total = today.tasks.reduce((s,t)=>s+(Number(t.minutes)||0),0);
  if(total >= 90) return "Protect 1 focus block";
  if(total >= 45) return "Add 30 min focus";
  return "Add 45 min focus";
}

/* ---------- Views ---------- */

function header(title, sub, actionsHTML=""){
  return `
    <div class="view view__head">
      <div class="view__titlewrap">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">${escapeHtml(sub || "")}</p>
      </div>
      <div class="view__actions">${actionsHTML}</div>
    </div>
  `;
}

function renderStart(){
  view.innerHTML = `
    ${header("Choose how you want to start.", "You can change this anytime.", "")}

    <div class="grid3">
      <div class="card" role="button" tabindex="0" data-go="#/today">
        <div class="row">
          <span class="badge">Recommended</span>
          <span class="badge badge--muted">Fast start</span>
        </div>
        <h3 style="margin-top:10px;">Today</h3>
        <p class="muted">Create a calm daily plan in seconds.</p>
        <div class="hr"></div>
        <p class="gold">3 blocks · 1 priority · done-by ${escapeHtml(state.today.doneBy)}</p>
      </div>

      <div class="card" role="button" tabindex="0" data-go="#/goals">
        <div class="row">
          <span class="badge badge--muted">Structured</span>
        </div>
        <h3 style="margin-top:10px;">Reach a goal</h3>
        <p class="muted">Goals → milestones → actions + forecasting.</p>
        <div class="hr"></div>
        <p class="gold">ETA + effort per day</p>
      </div>

      <div class="card" role="button" tabindex="0" data-go="#/discover">
        <div class="row">
          <span class="badge badge--muted">Guided</span>
        </div>
        <h3 style="margin-top:10px;">Discover a goal</h3>
        <p class="muted">Not sure what to pursue? Pick a direction.</p>
        <div class="hr"></div>
        <p class="gold">3 tailored options</p>
      </div>
    </div>
  `;

  $$("[data-go]", view).forEach(card => {
    card.addEventListener("click", () => location.hash = card.dataset.go);
    card.addEventListener("keydown", (e) => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        location.hash = card.dataset.go;
      }
    });
  });

  updateSidebarStats();
}

function renderToday(){
  const t = state.today;
  const totalMin = t.tasks.reduce((s,x)=>s+(Number(x.minutes)||0),0);
  const suggestion = focusSuggestion(t);

  view.innerHTML = `
    ${header("Today", "A simple plan that stays realistic.", `
      <button class="btn btn--ghost btn--sm" id="addTaskBtn" type="button">Add task</button>
      <button class="btn btn--primary btn--sm" id="todayInsightBtn" type="button">Recommendation</button>
    `)}

    <div class="grid3">
      <div class="card">
        <p class="eyebrow">Setup</p>

        <div class="field">
          <div class="label">Priority</div>
          <input class="input" id="priorityInput" value="${escapeAttr(t.priority)}" placeholder="One key step" />
        </div>

        <div class="field">
          <div class="label">Done-by</div>
          <input class="input" id="doneByInput" value="${escapeAttr(t.doneBy)}" placeholder="18:00" />
        </div>

        <div class="hr"></div>
        <p class="muted">Total planned</p>
        <p style="font-weight:750; font-size:1.25rem;">${totalMin} min</p>
        <p class="gold" style="margin-top:6px;">Suggestion: ${escapeHtml(suggestion)}</p>
      </div>

      <div class="card" style="grid-column: span 2;">
        <p class="eyebrow">Tasks</p>
        <ul class="list">
          ${t.tasks.map(taskRow).join("")}
        </ul>
      </div>
    </div>
  `;

  $("#priorityInput").addEventListener("input", (e) => {
    state.today.priority = e.target.value;
    saveState();
  });
  $("#doneByInput").addEventListener("input", (e) => {
    state.today.doneBy = e.target.value;
    saveState();
    route(); // updates start preview too
  });

  $("#addTaskBtn").addEventListener("click", () => {
    openModal({
      eyebrow: "Today",
      title: "Add a task",
      sub: "Keep it small and clear.",
      bodyHTML: `
        <div class="field">
          <div class="label">Task title</div>
          <input class="input" id="newTaskTitle" placeholder="e.g. Write outline" />
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

      state.today.tasks.unshift({ id: uid(), title, minutes: minutes || 0, done: false });
      saveState();
      closeModal();
      renderToday();
    });
  });

  $("#todayInsightBtn").addEventListener("click", () => {
    const insight =
      totalMin >= 90
        ? "You planned a heavy day. Protect one uninterrupted focus block and move admin to the end."
        : (totalMin >= 45
            ? "Add one protected 30–45 min focus block. Keep everything else minimal."
            : "Your plan is light. Add one 45-min focus block for a meaningful step.");

    openModal({
      eyebrow: "Recommendation",
      title: "A calm improvement",
      sub: "Optional. No pressure.",
      bodyHTML: `
        <div class="card" style="margin-top:8px;">
          <p style="font-weight:700;">${escapeHtml(insight)}</p>
          <p class="muted" style="margin-top:8px;">Tip: set a clear start time, not just a duration.</p>
        </div>
        <div class="row" style="margin-top:12px;">
          <button class="btn btn--primary" id="addFocusTaskBtn" type="button">Add focus block</button>
          <button class="btn btn--ghost" id="closeInsightBtn" type="button">Close</button>
        </div>
      `
    });

    $("#closeInsightBtn").addEventListener("click", closeModal);
    $("#addFocusTaskBtn").addEventListener("click", () => {
      state.today.tasks.unshift({ id: uid(), title: "Focus block", minutes: 45, done: false });
      saveState();
      closeModal();
      renderToday();
    });
  });

  // task actions
  t.tasks.forEach(task => {
    const rowEl = $(`[data-task="${task.id}"]`, view);
    if(!rowEl) return;
    $(".chk", rowEl).addEventListener("click", () => {
      task.done = !task.done;
      saveState();
      renderToday();
    });
    $(`[data-del="${task.id}"]`, rowEl).addEventListener("click", () => {
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
    <li class="item" data-task="${escapeAttr(t.id)}">
      <div class="chk ${t.done ? "is-done":""}" role="button" aria-label="toggle done"></div>
      <div>
        <div class="item__title">${escapeHtml(t.title)}</div>
        <div class="item__meta">${escapeHtml(meta)}</div>
      </div>
      <div class="item__actions">
        <button class="iconbtn2" type="button" data-del="${escapeAttr(t.id)}" aria-label="Delete">✕</button>
      </div>
    </li>
  `;
}

function renderGoals(){
  view.innerHTML = `
    ${header("Goals", "Goals → milestones → actions. Forecasting included.", `
      <button class="btn btn--ghost btn--sm" id="addGoalBtn" type="button">Add goal</button>
    `)}

    <div class="list">
      ${state.goals.map(goalCard).join("")}
    </div>
  `;

  $("#addGoalBtn").addEventListener("click", () => addGoalModal());

  // bind expand + actions
  state.goals.forEach(g => {
    const root = $(`[data-goal="${g.id}"]`, view);
    if(!root) return;

    $(`[data-open="${g.id}"]`, root).addEventListener("click", () => {
      const expanded = root.getAttribute("data-expanded") === "true";
      root.setAttribute("data-expanded", expanded ? "false" : "true");
      root.classList.toggle("is-expanded", !expanded);
      const details = $(`.goal__details`, root);
      if(details) details.style.display = expanded ? "none" : "block";
    });

    $(`[data-delgoal="${g.id}"]`, root).addEventListener("click", () => {
      state.goals = state.goals.filter(x => x.id !== g.id);
      saveState();
      renderGoals();
    });

    $(`[data-addms="${g.id}"]`, root).addEventListener("click", () => addMilestoneModal(g.id));
    $(`[data-forecast="${g.id}"]`, root).addEventListener("click", () => forecastModal(g.id));

    // action toggles
    g.milestones.forEach(ms => {
      ms.actions.forEach(a => {
        const row = $(`[data-action="${a.id}"]`, root);
        if(!row) return;
        $(".chk", row).addEventListener("click", () => {
          a.done = !a.done;
          saveState();
          renderGoals();
        });
        $(`[data-delaction="${a.id}"]`, row).addEventListener("click", () => {
          ms.actions = ms.actions.filter(x => x.id !== a.id);
          saveState();
          renderGoals();
        });
      });

      const addBtn = $(`[data-addaction="${ms.id}"]`, root);
      if(addBtn){
        addBtn.addEventListener("click", () => addActionModal(g.id, ms.id));
      }
    });
  });

  updateSidebarStats();
}

function goalCard(g){
  const { etaText, reqText } = computeForecast(g.totalEffortHours, g.minutesPerDay);
  const doneCount = countDoneActions(g);
  const totalCount = countAllActions(g);

  return `
    <div class="card" data-goal="${escapeAttr(g.id)}" data-expanded="false">
      <div class="row" style="justify-content:space-between;">
        <div>
          <div class="row">
            <span class="badge">${escapeHtml(g.title)}</span>
            <span class="badge badge--muted">${doneCount}/${totalCount} actions</span>
          </div>
          <p class="muted" style="margin-top:8px;">${escapeHtml(g.notes || "—")}</p>
          <p class="gold" style="margin-top:10px;">Forecast: ${escapeHtml(etaText)} · ${escapeHtml(reqText)}</p>
        </div>

        <div class="row">
          <button class="btn btn--ghost btn--sm" type="button" data-forecast="${escapeAttr(g.id)}">Forecast</button>
          <button class="btn btn--ghost btn--sm" type="button" data-open="${escapeAttr(g.id)}">Details</button>
          <button class="btn btn--ghost btn--sm" type="button" data-delgoal="${escapeAttr(g.id)}">Delete</button>
        </div>
      </div>

      <div class="goal__details" style="display:none; margin-top:14px;">
        <div class="grid3">
          <div class="card" style="background:rgba(255,255,255,.02); border-color:rgba(255,255,255,.08);">
            <p class="eyebrow">Settings</p>
            <div class="field">
              <div class="label">Total effort (hours)</div>
              <input class="input" type="number" min="0" step="1" value="${escapeAttr(g.totalEffortHours)}" data-effort="${escapeAttr(g.id)}" />
            </div>
            <div class="field">
              <div class="label">Minutes/day</div>
              <input class="input" type="number" min="0" step="5" value="${escapeAttr(g.minutesPerDay)}" data-mpd="${escapeAttr(g.id)}" />
            </div>
            <div class="row" style="margin-top:12px;">
              <button class="btn btn--primary btn--sm" type="button" data-savegoal="${escapeAttr(g.id)}">Save</button>
              <button class="btn btn--ghost btn--sm" type="button" data-addms="${escapeAttr(g.id)}">Add milestone</button>
            </div>
          </div>

          <div class="card" style="grid-column: span 2; background:rgba(255,255,255,.02); border-color:rgba(255,255,255,.08);">
            <p class="eyebrow">Milestones & actions</p>
            ${g.milestones.map(msBlock).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function msBlock(ms){
  return `
    <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.08);">
      <div class="row" style="justify-content:space-between;">
        <div style="font-weight:750;">${escapeHtml(ms.title)}</div>
        <div class="row">
          <button class="btn btn--ghost btn--sm" type="button" data-addaction="${escapeAttr(ms.id)}">Add action</button>
        </div>
      </div>

      <ul class="list" style="margin-top:10px;">
        ${(ms.actions || []).map(actionRow).join("") || `<li class="muted">No actions yet.</li>`}
      </ul>
    </div>
  `;
}

function actionRow(a){
  const meta = a.minutes ? `${a.minutes} min` : "—";
  return `
    <li class="item" data-action="${escapeAttr(a.id)}">
      <div class="chk ${a.done ? "is-done":""}" role="button" aria-label="toggle done"></div>
      <div>
        <div class="item__title">${escapeHtml(a.title)}</div>
        <div class="item__meta">${escapeHtml(meta)}</div>
      </div>
      <div class="item__actions">
        <button class="iconbtn2" type="button" data-delaction="${escapeAttr(a.id)}" aria-label="Delete">✕</button>
      </div>
    </li>
  `;
}

function addGoalModal(prefillTitle=""){
  openModal({
    eyebrow: "Goals",
    title: "Add a goal",
    sub: "Keep it simple. You can refine later.",
    bodyHTML: `
      <div class="field">
        <div class="label">Goal title</div>
        <input class="input" id="gTitle" placeholder="e.g. Learn a skill fast" value="${escapeAttr(prefillTitle)}" />
      </div>
      <div class="field">
        <div class="label">Notes (optional)</div>
        <textarea class="textarea" id="gNotes" placeholder="Short description..."></textarea>
      </div>
      <div class="grid3" style="margin-top:12px;">
        <div class="field">
          <div class="label">Total effort (hours)</div>
          <input class="input" id="gEffort" type="number" min="0" step="1" value="12" />
        </div>
        <div class="field">
          <div class="label">Minutes/day</div>
          <input class="input" id="gMpd" type="number" min="0" step="5" value="30" />
        </div>
        <div class="field">
          <div class="label">Create</div>
          <button class="btn btn--primary" id="gCreate" type="button">Add goal</button>
        </div>
      </div>
      <div class="row" style="margin-top:10px;">
        <button class="btn btn--ghost" id="gCancel" type="button">Cancel</button>
      </div>
    `
  });

  $("#gCancel").addEventListener("click", closeModal);
  $("#gCreate").addEventListener("click", () => {
    const title = $("#gTitle").value.trim();
    if(!title) return;
    const notes = $("#gNotes").value.trim();
    const effort = Number($("#gEffort").value || 0);
    const mpd = Number($("#gMpd").value || 0);

    state.goals.unshift({
      id: uid(),
      title,
      notes,
      totalEffortHours: effort || 0,
      minutesPerDay: mpd || 0,
      milestones: []
    });

    saveState();
    closeModal();
    renderGoals();
  });
}

function addMilestoneModal(goalId){
  openModal({
    eyebrow: "Milestones",
    title: "Add milestone",
    sub: "A milestone is a meaningful checkpoint.",
    bodyHTML: `
      <div class="field">
        <div class="label">Milestone title</div>
        <input class="input" id="msTitle" placeholder="e.g. Define scope" />
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="btn btn--primary" id="msAdd" type="button">Add</button>
        <button class="btn btn--ghost" id="msCancel" type="button">Cancel</button>
      </div>
    `
  });

  $("#msCancel").addEventListener("click", closeModal);
  $("#msAdd").addEventListener("click", () => {
    const title = $("#msTitle").value.trim();
    if(!title) return;
    const g = state.goals.find(x => x.id === goalId);
    if(!g) return;

    g.milestones.push({ id: uid(), title, actions: [] });
    saveState();
    closeModal();
    renderGoals();
  });
}

function addActionModal(goalId, milestoneId){
  openModal({
    eyebrow: "Actions",
    title: "Add action",
    sub: "Make it small and executable.",
    bodyHTML: `
      <div class="field">
        <div class="label">Action title</div>
        <input class="input" id="aTitle" placeholder="e.g. Write 1-page outline" />
      </div>
      <div class="field">
        <div class="label">Minutes (optional)</div>
        <input class="input" id="aMin" type="number" min="0" step="5" value="30" />
      </div>
      <div class="row" style="margin-top:12px;">
        <button class="btn btn--primary" id="aAdd" type="button">Add</button>
        <button class="btn btn--ghost" id="aCancel" type="button">Cancel</button>
      </div>
    `
  });

  $("#aCancel").addEventListener("click", closeModal);
  $("#aAdd").addEventListener("click", () => {
    const title = $("#aTitle").value.trim();
    if(!title) return;
    const minutes = Number($("#aMin").value || 0);

    const g = state.goals.find(x => x.id === goalId);
    if(!g) return;
    const ms = g.milestones.find(m => m.id === milestoneId);
    if(!ms) return;

    ms.actions.push({ id: uid(), title, minutes: minutes || 0, done: false });
    saveState();
    closeModal();
    renderGoals();
  });
}

function forecastModal(goalId){
  const g = state.goals.find(x => x.id === goalId);
  if(!g) return;

  const { etaText, reqText, days } = computeForecast(g.totalEffortHours, g.minutesPerDay);

  openModal({
    eyebrow: "Forecast",
    title: g.title,
    sub: "Basic forecasting (MVP).",
    bodyHTML: `
      <div class="grid3" style="margin-top:8px;">
        <div class="card">
          <p class="muted">Total effort</p>
          <p style="font-weight:800; font-size:1.3rem;">${escapeHtml(String(g.totalEffortHours))} h</p>
        </div>
        <div class="card">
          <p class="muted">Minutes/day</p>
          <p style="font-weight:800; font-size:1.3rem;">${escapeHtml(String(g.minutesPerDay))}</p>
        </div>
        <div class="card">
          <p class="muted">ETA</p>
          <p class="gold" style="font-weight:800; font-size:1.3rem;">${escapeHtml(etaText)}</p>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <p style="font-weight:700;">Required effort: <span class="gold">${escapeHtml(reqText)}</span></p>
        <p class="muted" style="margin-top:8px;">Assumption: consistent daily work. (Later we add schedule quality + missed days.)</p>
      </div>

      <div class="row" style="margin-top:12px;">
        <button class="btn btn--primary" id="applyToToday" type="button">Add focus block to Today</button>
        <button class="btn btn--ghost" id="closeForecast" type="button">Close</button>
      </div>
    `
  });

  $("#closeForecast").addEventListener("click", closeModal);
  $("#applyToToday").addEventListener("click", () => {
    state.today.tasks.unshift({ id: uid(), title: `Goal focus: ${g.title}`, minutes: Math.min(60, Math.max(20, g.minutesPerDay || 45)), done: false });
    saveState();
    closeModal();
    location.hash = "#/today";
  });
}

function renderDiscover(){
  const last = state.ui.lastDiscover || { focus:"clarity", timePerDay:20 };

  view.innerHTML = `
    ${header("Discover a goal", "A calm flow that gives you 3 realistic options.", `
      <button class="btn btn--primary btn--sm" id="genBtn" type="button">Generate options</button>
    `)}

    <div class="grid3">
      <div class="card">
        <p class="eyebrow">1) Focus</p>
        <div class="field">
          <div class="label">What do you want most right now?</div>
          <select class="select" id="focusSel">
            <option value="clarity">Clarity</option>
            <option value="energy">Energy</option>
            <option value="income">Income</option>
            <option value="skill">Skill</option>
          </select>
        </div>

        <div class="field">
          <div class="label">2) Time per day</div>
          <select class="select" id="timeSel">
            <option value="10">10 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </select>
        </div>

        <div class="hr"></div>
        <p class="muted">This is a preview. In the real app, we generate milestones, actions and a first daily plan.</p>
      </div>

      <div class="card" style="grid-column: span 2;">
        <p class="eyebrow">3) Options</p>
        <div class="list" id="optList"></div>
      </div>
    </div>
  `;

  const focusSel = $("#focusSel");
  const timeSel = $("#timeSel");
  focusSel.value = last.focus;
  timeSel.value = String(last.timePerDay);

  function generate(){
    const focus = focusSel.value;
    const time = Number(timeSel.value);
    state.ui.lastDiscover = { focus, timePerDay: time };
    saveState();

    const opts = discoverOptions(focus, time);
    $("#optList").innerHTML = opts.map(o => `
      <div class="item" style="grid-template-columns: 1fr auto;">
        <div>
          <div class="item__title">${escapeHtml(o.title)}</div>
          <div class="item__meta">${escapeHtml(o.desc)}</div>
          <div class="gold" style="margin-top:6px;">${escapeHtml(o.example)}</div>
        </div>
        <div class="item__actions">
          <button class="btn btn--primary btn--sm" type="button" data-add="${escapeAttr(o.title)}">Add</button>
        </div>
      </div>
    `).join("");

    $$("[data-add]").forEach(btn => {
      btn.addEventListener("click", () => {
        const title = btn.dataset.add;
        addGoalModal(title);
      });
    });
  }

  $("#genBtn").addEventListener("click", generate);
  generate();

  updateSidebarStats();
}

function discoverOptions(focus, time){
  const speed = time >= 45 ? "faster" : (time <= 10 ? "lighter" : "balanced");
  const base = {
    clarity: [
      { title:"12-week reset", desc:"Clean week structure + daily execution.", example:`${speed} · ${time} min/day · weekly review` },
      { title:"Project focus", desc:"Pick one project and finish step-by-step.", example:`ETA style · ${time} min/day` },
      { title:"Declutter & simplify", desc:"Reduce noise → increase clarity.", example:`10-day sprint · ${Math.min(time,20)} min/day` }
    ],
    energy: [
      { title:"Energy routine", desc:"A small routine that compounds.", example:`${speed} · ${time} min/day · 4 weeks` },
      { title:"Sleep & focus", desc:"Stabilize schedule, improve deep work.", example:`14 days · ${Math.min(time,15)} min/day` },
      { title:"Movement plan", desc:"Low-friction habit with tracking.", example:`30 days · ${Math.min(time,20)} min/day` }
    ],
    income: [
      { title:"Skill → income", desc:"Pick one skill and ship weekly output.", example:`${speed} · ${time} min/day · 8 weeks` },
      { title:"Side project", desc:"Build a small offer with milestones.", example:`ETA · ${time} min/day` },
      { title:"Finance clarity", desc:"Simple overview + weekly check.", example:`20 min/week · monthly insight` }
    ],
    skill: [
      { title:"Learn a skill fast", desc:"Structured ladder with daily practice.", example:`${speed} · ${time} min/day · 6 weeks` },
      { title:"Portfolio sprint", desc:"Publish small pieces consistently.", example:`30 days · ${Math.min(time,20)} min/day` },
      { title:"Deep work upgrade", desc:"Protect focus time and measure it.", example:`1 block/day · weekly trend` }
    ]
  };
  return base[focus] || base.clarity;
}

/* ---------- Forecasting (basic) ---------- */
/* totalEffortHours: total required work time
   minutesPerDay: daily available time
   returns: ETA in weeks/days + required effort text
*/
function computeForecast(totalEffortHours, minutesPerDay){
  const effortMin = Math.max(0, Number(totalEffortHours) || 0) * 60;
  const mpd = Math.max(0, Number(minutesPerDay) || 0);

  if(effortMin === 0 || mpd === 0){
    return {
      etaText: "—",
      reqText: mpd === 0 ? "set minutes/day" : "set effort",
      days: 0
    };
  }

  const days = Math.ceil(effortMin / mpd);
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;

  let etaText = "";
  if(weeks <= 0) etaText = `${days} days`;
  else if(remDays === 0) etaText = `${weeks} weeks`;
  else etaText = `${weeks} weeks ${remDays} days`;

  const reqText = `${mpd} min/day`;
  return { etaText, reqText, days };
}

function countAllActions(g){
  return (g.milestones || []).reduce((s,ms)=>s + (ms.actions||[]).length, 0);
}
function countDoneActions(g){
  return (g.milestones || []).reduce((s,ms)=>s + (ms.actions||[]).filter(a=>a.done).length, 0);
}

/* ---------- Escape helpers ---------- */
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}
function escapeAttr(str){ return escapeHtml(str).replace(/"/g, "&quot;"); }

/* ---------- Interactions inside Goal details ---------- */
document.addEventListener("click", (e) => {
  const saveBtn = e.target.closest("[data-savegoal]");
  if(saveBtn){
    const id = saveBtn.dataset.savegoal;
    const g = state.goals.find(x => x.id === id);
    if(!g) return;

    const eff = $(`[data-effort="${CSS.escape(id)}"]`);
    const mpd = $(`[data-mpd="${CSS.escape(id)}"]`);
    g.totalEffortHours = Number(eff?.value || 0);
    g.minutesPerDay = Number(mpd?.value || 0);

    saveState();
    renderGoals();
  }

  const delActionBtn = e.target.closest("[data-delaction]");
  if(delActionBtn){
    // handled by per-render binding too; this makes it resilient
    e.preventDefault();
  }
});

saveState();
route();
