// slider.js — tiny, premium feature slider
(() => {
  const tabs = document.querySelectorAll("[data-tab]");
  const screens = document.querySelectorAll("[data-screen]");
  if (!tabs.length || !screens.length) return;

  function activate(key){
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
    screens.forEach(s => s.classList.toggle("active", s.dataset.screen === key));
  }

  tabs.forEach(t => {
    t.addEventListener("click", () => activate(t.dataset.tab));
  });

  // auto-rotate (subtle). respects reduced motion.
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const order = Array.from(tabs).map(t => t.dataset.tab);
  let i = 0;
  setInterval(() => {
    i = (i + 1) % order.length;
    activate(order[i]);
  }, 5200);
})();
