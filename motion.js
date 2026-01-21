// motion.js — reveal on scroll + subtle parallax for cinematic hero
(() => {
  // Reveal
  const els = document.querySelectorAll(".fadeUp");
  if ("IntersectionObserver" in window && els.length) {
    const io = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          ent.target.classList.add("is-in");
          io.unobserve(ent.target);
        }
      }
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  } else {
    els.forEach(e => e.classList.add("is-in"));
  }

  // Parallax (respect reduced motion)
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const art = document.querySelector(".heroArt");
  const glow1 = document.querySelector(".heroGlow");
  const glow2 = document.querySelector(".heroGlow2");
  const frame = document.querySelector(".heroFrame");

  if (!art && !glow1 && !glow2 && !frame) return;

  let mx = 0, my = 0, tx = 0, ty = 0;

  function onMove(e){
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (e.clientX / w) - 0.5;
    const y = (e.clientY / h) - 0.5;
    mx = x; my = y;
  }

  function tick(){
    tx += (mx - tx) * 0.08;
    ty += (my - ty) * 0.08;

    const ax = tx * 18;
    const ay = ty * 14;

    if (art) art.style.transform = `translate3d(${ax}px, ${ay + 6}px, 0)`;
    if (frame) frame.style.transform = `translate3d(${ax * 0.35}px, ${ay * 0.35}px, 0)`;
    if (glow1) glow1.style.transform = `translate3d(${ax * 0.25}px, ${ay * 0.18}px, 0)`;
    if (glow2) glow2.style.transform = `translate3d(${ax * -0.18}px, ${ay * 0.12}px, 0)`;

    requestAnimationFrame(tick);
  }

  window.addEventListener("mousemove", onMove, { passive:true });
  requestAnimationFrame(tick);
})();
