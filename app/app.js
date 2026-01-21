const $=(q,e=document)=>e.querySelector(q);
const $$=(q,e=document)=>Array.from(e.querySelectorAll(q));
const STORE_KEY="saverioflow_final_v1";
const LEGACY_KEYS=["saverioflow_mvp_v1"];

const defaultState=()=>({
  today:{doneBy:"18:00",priority:"One key step",tasks:[]},
  goals:[],
  ui:{lastDiscover:{focus:"clarity",timePerDay:30}}
});

function uid(){return Math.random().toString(16).slice(2)+Date.now().toString(16);}
function loadState(){
  const raw=localStorage.getItem(STORE_KEY);
  if(raw) return JSON.parse(raw);
  for(const k of LEGACY_KEYS){
    const r=localStorage.getItem(k);
    if(r){localStorage.setItem(STORE_KEY,r);return JSON.parse(r);}
  }
  return defaultState();
}
let state=loadState();
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state));updateSidebar();}
const view=$("#view");

function route(){
  const h=location.hash||"#/start";
  const [p,q]=h.replace("#","").split("?");
  if(p==="/start")return renderStart();
  if(p==="/discover")return renderDiscover();
  if(p==="/goals")return renderGoals(new URLSearchParams(q||"").get("optimize")==="1");
  if(p==="/today")return renderToday();
  if(p==="/week")return renderWeek();
  if(p==="/flow")return renderComing("Flow mode","Focused execution is enabled in Drop 2.");
  if(p==="/dialogue")return renderComing("Dialogue","Philosophical dialogue arrives in Drop 3.");
  location.hash="#/start";
}
window.addEventListener("hashchange",route);

function updateSidebar(){
  $("#statToday").textContent=`${state.today.tasks.filter(t=>t.done).length}/${state.today.tasks.length}`;
  $("#statGoals").textContent=state.goals.length;
  $("#statFocus").textContent="Start with Discover";
}

function header(t,s,a=""){return`
  <div class="view__head">
    <div><h2>${t}</h2><p class="muted">${s||""}</p></div>
    <div>${a}</div>
  </div>`;}

function renderStart(){
  view.innerHTML=`
    ${header("Find your direction","Start by discovering what to pursue.")}
    <div class="grid3">
      <div class="card" data-go="#/discover"><h3>Discover a goal</h3><p class="muted">Guided, calm, AI-assisted.</p></div>
      <div class="card" data-go="#/goals?optimize=1"><h3>Optimize a goal</h3><p class="muted">You already know what you want.</p></div>
      <div class="card" data-go="#/today"><h3>Plan today</h3><p class="muted">Turn intention into action.</p></div>
    </div>`;
  $$("[data-go]").forEach(c=>c.onclick=()=>location.hash=c.dataset.go);
  updateSidebar();
}

function renderDiscover(){
  view.innerHTML=`
    ${header("Discover a goal","Pick a direction. We generate options.",`
      <button class="btn btn--primary btn--sm" id="gen">Generate</button>`)}
    <div class="grid3">
      <div class="card">
        <label>Focus</label>
        <select id="f"><option>clarity</option><option>skill</option><option>build</option><option>health</option><option>income</option></select>
        <label>Minutes/day</label>
        <select id="m"><option>15</option><option selected>30</option><option>45</option><option>60</option></select>
      </div>
      <div class="card" style="grid-column:span 2"><div id="opts"></div></div>
    </div>`;
  $("#gen").onclick=()=>{
    const f=$("#f").value,m=+$("#m").value;
    $("#opts").innerHTML=[1,2,3].map(i=>`
      <div class="item">
        <div>
          <div class="item__title">${f} option ${i}</div>
          <div class="item__meta">${m} min/day · structured plan</div>
        </div>
        <button class="btn btn--primary btn--sm" data-add>Add</button>
      </div>`).join("");
    $$("[data-add]").forEach(b=>b.onclick=()=>{
      state.goals.unshift({id:uid(),title:`${f} goal`,minutesPerDay:m,milestones:[]});
      state.today.tasks.unshift({id:uid(),title:`Goal focus: ${f}`,minutes:m,done:false});
      save();location.hash="#/goals";
    });
  };
  updateSidebar();
}

function renderGoals(opt){
  view.innerHTML=`
    ${header("Goals","Track and refine your goals.",`
      <button class="btn btn--ghost btn--sm" id="opt">Optimize</button>
      <button class="btn btn--ghost btn--sm" id="add">Add</button>`)}
    <div class="list">${state.goals.map(g=>`
      <div class="item"><div class="item__title">${g.title}</div></div>`).join("")}</div>`;
  $("#opt").onclick=optimizeExistingGoal;
  if(opt) optimizeExistingGoal();
  updateSidebar();
}

function optimizeExistingGoal(){
  state.goals.unshift({id:uid(),title:"Optimized goal",minutesPerDay:30,milestones:[]});
  state.today.tasks.unshift({id:uid(),title:"Next step (optimized)",minutes:30,done:false});
  save();location.hash="#/goals";
}

function renderToday(){
  view.innerHTML=`
    ${header("Today","A realistic daily plan.")}
    <ul class="list">${state.today.tasks.map(t=>`
      <li class="item">
        <div class="chk ${t.done?"is-done":""}" data-id="${t.id}"></div>
        <div>${t.title}</div>
      </li>`).join("")}</ul>`;
  $$("[data-id]").forEach(c=>c.onclick=()=>{
    const t=state.today.tasks.find(x=>x.id===c.dataset.id);t.done=!t.done;save();renderToday();
  });
  updateSidebar();
}

function renderWeek(){
  view.innerHTML=`${header("Week","Structure the week. Auto-plan in Drop 2.")}<p class="muted">Weekly board arrives next.</p>`;
}

function renderComing(t,s){
  view.innerHTML=`${header(t,"Coming next.")}<p class="muted">${s}</p>`;
}

route();
