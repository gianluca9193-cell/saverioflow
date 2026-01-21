// motion.js — reveal elements on scroll
(() => {
  const els = document.querySelectorAll(".fadeUp");
  if (!("IntersectionObserver" in window) || els.length === 0) {
    els.forEach(e => e.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const ent of entries) {
      if (ent.isIntersecting) {
        ent.target.classList.add("is-in");
        io.unobserve(ent.target);
      }
    }
  }, { threshold: 0.12 });
  els.forEach(e => io.observe(e));
})();
