document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("canvas-container");
  if (!container) return;

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  let w = 1;
  let h = 1;
  let dpr = 1;

  let active = false;
  let locked = false;
  let x = 0;
  let y = 0;

  let rafPending = false;

  let flash = null;

  const isCoarse =
    (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) ||
    (navigator.maxTouchPoints || 0) > 0;

  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

  const resize = () => {
    w = window.innerWidth || 1;
    h = window.innerHeight || 1;

    document.documentElement.style.setProperty("--vh", `${h * 0.01}px`);

    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const tieDye = (px, py, boost = 0) => {
    px = clamp(px, 0, w);
    py = clamp(py, 0, h);

    const hue = (px / w) * 360;
    const sat = clamp((py / h) * 100 * (1 + boost * 0.12), 0, 100);
    const light = 50 + Math.sin(px * 0.05) * 20 + boost * 10;

    const rad = w / 2;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, rad);
    grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${light}%)`);
    grad.addColorStop(0.25, `hsl(${(hue + 60) % 360}, ${sat}%, ${light - 5}%)`);
    grad.addColorStop(0.5, `hsl(${(hue + 120) % 360}, ${sat}%, ${light - 10}%)`);
    grad.addColorStop(0.75, `hsl(${(hue + 180) % 360}, ${sat}%, ${light - 15}%)`);
    grad.addColorStop(1, `hsl(${(hue + 240) % 360}, ${sat}%, ${light - 20}%)`);
    return grad;
  };

  const drawBlack = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  };

  const drawActive = () => {
    ctx.fillStyle = tieDye(x, y, 0);
    ctx.fillRect(0, 0, w, h);
  };

  const drawFlash = (now) => {
    if (!flash) return;

    const t = (now - flash.start) / flash.dur;
    if (t >= 1) {
      flash = null;
      return;
    }

    const pulse = Math.sin(Math.PI * t);

    drawBlack();

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = tieDye(flash.x, flash.y, pulse);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const rad = Math.max(w, h) * 0.6;
    const glow = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, rad);
    glow.addColorStop(0, `rgba(128,222,234,${0.22 * pulse})`);
    glow.addColorStop(0.35, `rgba(79,195,247,${0.14 * pulse})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  const render = (now) => {
    rafPending = false;

    if (flash) {
      drawFlash(now);
      if (flash) schedule();
      else if (active) drawActive();
      else drawBlack();
      return;
    }

    if (!active) {
      drawBlack();
      return;
    }

    drawActive();
  };

  const schedule = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(render);
  };

  const pointFromEvent = (e) => {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (typeof e.clientX === "number" && typeof e.clientY === "number") return { x: e.clientX, y: e.clientY };
    return null;
  };

  const activateFromEvent = (e) => {
    if (!isCoarse && locked) return;
    const pt = pointFromEvent(e);
    if (!pt) return;
    x = pt.x;
    y = pt.y;
    active = true;
    schedule();
  };

  const deactivate = () => {
    active = false;
    schedule();
  };

  const touchMove = (e) => {
    if (e.cancelable) e.preventDefault();
    activateFromEvent(e);
  };

  const startFlashAt = (px, py, dur = 300) => {
    flash = { x: px, y: py, start: performance.now(), dur };
    schedule();
  };

  resize();
  drawBlack();

  window.addEventListener(
    "resize",
    () => {
      resize();
      schedule();
    },
    { passive: true }
  );

  container.addEventListener("mousemove", activateFromEvent, { passive: true });

  container.addEventListener("touchstart", activateFromEvent, { passive: true });
  container.addEventListener("touchmove", touchMove, { passive: false });

  window.addEventListener("touchend", deactivate, { passive: true });

  window.addEventListener(
    "click",
    (e) => {
      if (isCoarse) return;
      if (!locked && !active) return;
      locked = !locked;
      if (locked) {
        active = false;
        schedule();
        return;
      }
      const pt = pointFromEvent(e);
      if (pt) {
        x = pt.x;
        y = pt.y;
      }
      active = true;
      schedule();
    },
    { passive: true }
  );

  const email = document.getElementById("email");
  if (email && isCoarse) {
    const flashFrom = (evt) => {
      const r = email.getBoundingClientRect();
      const px = typeof evt.clientX === "number" ? evt.clientX : r.left + r.width / 2;
      const py = typeof evt.clientY === "number" ? evt.clientY : r.top + r.height / 2;
      startFlashAt(px, py, 300);
    };

    email.addEventListener("touchstart", flashFrom, { passive: true });
    email.addEventListener("mousedown", flashFrom, { passive: true });
  }

  const lc = document.querySelector(".logo-container");
  setTimeout(() => {
    if (lc) lc.classList.add("pulsing");
  }, 3000);
});
