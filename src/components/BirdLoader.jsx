import { useEffect, useRef } from 'react';

const isDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#45B7D1', '#A78BFA', '#F472B6'];
const rnd    = (a, b) => Math.random() * (b - a) + a;
const pick   = arr => arr[Math.floor(Math.random() * arr.length)];

// ── Bird ──────────────────────────────────────────────────────────────────────
class Bird {
  constructor(w, h, offsetX = 0) {
    this.w = w; this.h = h;
    this.reset(offsetX);
  }

  reset(offsetX = 0) {
    this.x       = -80 - offsetX;   // stagger initial positions
    this.y       = rnd(this.h * 0.15, this.h * 0.8);
    this.speed   = rnd(10, 16);        // extra fast base speed
    this.vy      = 0;
    this.color   = pick(COLORS);
    this.size    = rnd(16, 26);
    this.flap    = 0;
    this.flapDir = 1;
    this.trail   = [];               // short trail: 6 pts max
    this.scattered    = false;
    this.scatterTick  = 0;
  }

  scatter() {
    this.scattered   = true;
    this.scatterTick = 0;
    const mag    = rnd(12, 28);      // extreme scatter burst
    const angle  = rnd(-0.6, 0.6) * Math.PI;
    this.speed   = Math.cos(angle) * mag;
    this.vy      = Math.sin(angle) * mag * (Math.random() > 0.5 ? 1 : -1);
  }

  update() {
    if (this.scattered) {
      this.scatterTick++;
      this.speed = this.speed * 0.94 + rnd(12, 18) * 0.06;
      this.vy   *= 0.90;
      if (this.scatterTick > 80) { this.scattered = false; this.vy = 0; }
    }

    this.x += this.speed;
    this.y += this.vy;

    this.flap += 0.45 * this.flapDir; // much faster flapping
    if (Math.abs(this.flap) > 1) this.flapDir *= -1;

    // keep trail short → less garbage
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    if (this.x > this.w + 100 || this.x < -250 ||
        this.y < -150 || this.y > this.h + 150) {
      this.reset();
    }
  }

  draw(ctx) {
    // minimal trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const a = (i / this.trail.length) * 0.3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.size * 0.15 * (i / this.trail.length), 0, Math.PI * 2);
      ctx.fillStyle = this.color + Math.floor(a * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }

    const s = this.size;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.speed < 0) ctx.scale(-1, 1);

    const wa = this.flap * 0.5;

    // wings (two ellipses)
    ctx.fillStyle = this.color;
    ctx.save(); ctx.rotate(-wa);
    ctx.beginPath();
    ctx.ellipse(-s * 0.28, 0, s * 0.82, s * 0.2, 0.05, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();

    ctx.save(); ctx.rotate(wa);
    ctx.beginPath();
    ctx.ellipse(s * 0.28, 0, s * 0.82, s * 0.2, -0.05, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();

    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(s * 0.26, -s * 0.07, s * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s * 0.3, -s * 0.09, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(s * 0.305, -s * 0.09, s * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = '#FFD93D';
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.06);
    ctx.lineTo(s * 0.56, -s * 0.035);
    ctx.lineTo(s * 0.4, -s * 0.015);
    ctx.fill();

    ctx.restore();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const MAX_BIRDS = 3;
const TARGET_FPS = 24;
const FRAME_MS   = 1000 / TARGET_FPS;

export default function BirdLoader() {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ birds: [], lastTime: 0 });
  const darkRef   = useRef(isDark());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = e => { darkRef.current = e.matches; };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      // rebuild birds on resize to use new dimensions
      stateRef.current.birds = Array.from(
        { length: MAX_BIRDS },
        (_, i) => new Bird(canvas.width, canvas.height, i * 220)
      );
    };
    resize();
    window.addEventListener('resize', resize);

    // spacebar → scatter
    const onKey = e => {
      if (e.code === 'Space') {
        e.preventDefault();
        stateRef.current.birds.forEach(b => b.scatter());
      }
    };
    window.addEventListener('keydown', onKey);

    // ── throttled RAF loop ────────────────────────────────────────────────────
    let animId;
    const loop = (now) => {
      animId = requestAnimationFrame(loop);

      if (now - stateRef.current.lastTime < FRAME_MS) return; // skip frame
      stateRef.current.lastTime = now;

      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const dark = darkRef.current;

      // background (solid colour — cheaper than gradient every frame)
      ctx.fillStyle = dark ? '#0e0525' : '#f4f7ff';
      ctx.fillRect(0, 0, w, h);

      // birds
      stateRef.current.birds.forEach(b => {
        b.w = w; b.h = h;
        b.update();
        b.draw(ctx);
      });
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, display: 'block' }} />
  );
}
