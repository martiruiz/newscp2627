// "We track the best sports accounts" radar (home → How it works, step 01).
// Rings ripple softly (CSS); three account chips orbit along the rings and take turns with the others.
(() => {
  const radar = document.querySelector("[data-radar]");
  if (!radar) return;
  const layer = radar.querySelector("[data-radar-chips]");
  const ACCOUNTS = [
    ["FC Barcelona", "fcbarcelona"], ["NBA", "nba"], ["433", "433"], ["Manchester City", "mancity"], ["ESPN", "espn"],
    ["Chicago Bulls", "chicagobulls"], ["MotoGP", "motogp"], ["New England Patriots", "patriots"], ["MLB", "mlb"],
    ["Real Madrid", "realmadrid"], ["UEFA Champions League", "championsleague"], ["The Olympic Games", "olympics"], ["LALIGA", "laliga"],
    ["NFL", "nfl"], ["Formula 1", "f1"], ["Premier League", "premierleague"], ["Bleacher Report", "bleacherreport"],
    ["Nike", "nike"], ["adidas", "adidas"], ["PUMA", "puma"], ["Under Armour", "underarmour"], ["Red Bull", "redbull"],
  ];
  // different order on every visit, so every account gets its turn up front
  for (let i = ACCOUNTS.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ACCOUNTS[i], ACCOUNTS[j]] = [ACCOUNTS[j], ACCOUNTS[i]]; }
  const RINGS = [170, 198, 226, 254, 282];   // radii (SVG units, 644 × 600 box, centre 322/300) chips travel on
  const CX = 322, CY = 300, W = 644, H = 600;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const chipHtml = ([name, handle]) => `<img src="assets/tracking/${handle}.jpg" alt="" width="44" height="44" loading="lazy"><span><b>${name}</b><small>@${handle}</small></span>`;
  // Three slots 120° apart orbit together (so they never meet); each swaps its account every few seconds
  const SPEED = 4; // degrees per second
  const slots = [
    { angle: -30, ring: 4 },
    { angle: 90, ring: 2 },
    { angle: 210, ring: 3 },
  ];
  slots.forEach((s) => (s.home = s.angle));
  let next = 0;
  const used = new Set();
  function pickAccount() {
    for (let k = 0; k < ACCOUNTS.length; k++) {
      const i = (next + k) % ACCOUNTS.length;
      if (!used.has(i)) { next = i + 1; return i; }
    }
    return 0;
  }
  slots.forEach((s) => {
    s.i = pickAccount(); used.add(s.i);
    s.el = Object.assign(document.createElement("div"), { className: "radar-chip is-in", innerHTML: chipHtml(ACCOUNTS[s.i]) });
    layer.appendChild(s.el);
  });

  function place(s) {
    const r = RINGS[s.ring];
    const a = (s.angle * Math.PI) / 180;
    // percentages so it scales with the container
    s.el.style.left = `${((CX + r * Math.cos(a)) / W) * 100}%`;
    s.el.style.top = `${((CY + r * Math.sin(a)) / H) * 100}%`;
  }
  slots.forEach(place);
  if (reduce) return;

  let last = performance.now();
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(radar);
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) slots.forEach((s) => { s.home += SPEED * dt; s.angle += (s.home - s.angle) * Math.min(1, dt * 1.5); place(s); });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Swap one chip at a time: fade out, jump to another ring / angle, fade in with the next account
  let turn = 0;
  setInterval(() => {
    if (!visible) return;
    const s = slots[turn++ % slots.length];
    s.el.classList.remove("is-in");
    setTimeout(() => {
      used.delete(s.i);
      s.i = pickAccount(); used.add(s.i);
      s.el.innerHTML = chipHtml(ACCOUNTS[s.i]);
      s.ring = (s.ring + 1 + Math.floor(Math.random() * (RINGS.length - 1))) % RINGS.length; // another ring, same sector
      s.angle = s.home + (Math.random() * 30 - 15);
      place(s);
      s.el.classList.add("is-in");
    }, 650);
  }, 2600);
})();
