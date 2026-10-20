// Sign-up / log-in background: a tunnel of real SCP posts you glide through (walls, floor and ceiling), inspired by
// React Bits' Passage Gallery, built with CSS 3D (no library). Photos (assets/tunnel/*.webp, small thumbnails),
// gold → violet accent tiles, a hairline grid, navy fog in the distance; the view leans slightly towards the pointer.
// Still with "reduce motion". Sits under the light ribbon (js/auth-bg.js) and the form.
(() => {
  const host = document.querySelector(".auth-page");
  if (!host) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = document.createElement("div");
  scene.className = "atn-scene"; scene.setAttribute("aria-hidden", "true");
  host.prepend(scene);
  const world = document.createElement("div"); world.className = "atn-world"; scene.append(world);
  const fog = document.createElement("div"); fog.className = "atn-fog"; scene.append(fog);

  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let photos = [], rows = [], W, H, cell, D, R, persp, next = 0;
  const LANES = 5, GAP = 0.1, PHOTO = 1, ACCENT = 0, SPEED = 0.35;   // every tile holds a real post · speed in cells per second

  function tile(row, x, y, rot, size) {
    const r = rnd(), t = document.createElement("i");
    t.className = "atn-t";
    t.style.cssText = `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;transform:translate3d(${x}px,${y}px,0) ${rot}`;
    if (r < PHOTO && photos.length) { t.classList.add("is-photo"); t.style.backgroundImage = `url(assets/tunnel/${photos[(next++) % photos.length]})`; }
    else if (r < PHOTO + ACCENT) t.classList.add("is-accent");
    row.append(t);
  }
  function build() {
    W = innerWidth; H = innerHeight;
    persp = (H / 2) / Math.tan((72 / 2) * Math.PI / 180);
    scene.style.perspective = `${persp}px`;
    cell = W / LANES; const wallN = Math.max(2, Math.round(H / cell)), wallCell = H / wallN;
    R = W < 700 ? 12 : 16; D = R * cell;
    world.innerHTML = ""; rows = []; seed = 7; next = 0;
    photos.sort(() => rnd() - 0.5);
    for (let j = 0; j < R; j++) {
      const row = document.createElement("div"); row.className = "atn-row";
      for (let i = 0; i < LANES; i++) {
        const x = (i + 0.5) * cell - W / 2, s = cell * (1 - GAP);
        tile(row, x, H / 2, "rotateX(90deg)", s);      // floor
        tile(row, x, -H / 2, "rotateX(-90deg)", s);    // ceiling
      }
      for (let k = 0; k < wallN; k++) {
        const y = (k + 0.5) * wallCell - H / 2, s = Math.min(cell, wallCell) * (1 - GAP);
        tile(row, -W / 2, y, "rotateY(90deg)", s);     // left wall
        tile(row, W / 2, y, "rotateY(-90deg)", s);     // right wall
      }
      world.append(row); rows.push(row);
    }
    place(offset);
  }
  let offset = 0, last = performance.now(), lookX = 0, lookY = 0, tx = 0, ty = 0, push = 0;   // push: extra speed from the wheel / a drag
  function place(o) {
    rows.forEach((row, j) => {
      // rows run from deep in the tunnel up to just in front of the camera (never behind it), so the walls reach the screen edges
      const near = Math.min(cell * 0.9, persp * 0.6);
      let z = ((((-(j + 0.5) * cell + o) % D) + D) % D) - D; if (z + D <= near) z += D;   // also when going backwards
      const depth = Math.max(0, -z) / (D - near);
      row.style.transform = `translateZ(${z}px)`;
      row.style.setProperty("--o", String(Math.max(0, 1 - Math.pow(depth, 1.4))).slice(0, 5));   // on the tiles: opacity on a 3D group would flatten it
    });
    world.style.transform = `rotateY(${lookX}deg) rotateX(${lookY}deg)`;
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    // cruise forward; the wheel / a drag adds speed (forward or backwards) that fades out smoothly
    offset = (offset + ((still ? 0 : SPEED * cell) + push) * dt) % D;
    push *= Math.pow(0.12, dt);
    lookX += (tx - lookX) * 0.04; lookY += (ty - lookY) * 0.04;
    place(offset);
    if (!document.hidden) requestAnimationFrame(frame);
  }
  // mouse wheel / trackpad: down = deeper into the tunnel, up = back out
  addEventListener("wheel", (e) => {
    const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    push = Math.max(-cell * 14, Math.min(cell * 14, push + dy * cell * 0.012));
  }, { passive: true });
  let touchY = null;
  addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", (e) => { if (touchY == null) return; const y = e.touches[0].clientY; push = Math.max(-cell * 14, Math.min(cell * 14, push + (touchY - y) * cell * 0.03)); touchY = y; }, { passive: true });
  addEventListener("touchend", () => { touchY = null; }, { passive: true });
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth - 0.5) * 6; ty = -(e.clientY / innerHeight - 0.5) * 4; }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 200); });
  fetch("assets/tunnel/list.json?v=96").then((r) => r.json()).catch(() => []).then((list) => {
    photos = list || [];
    build();
    requestAnimationFrame((t) => { last = t; scene.classList.add("is-on"); frame(t); });
  });
})();
