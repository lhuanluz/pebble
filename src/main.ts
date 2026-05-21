import './style.css';

type Vec = { x: number; y: number };
type Peg = Vec & { radius: number; hit: boolean; kind: 'story' | 'spark' | 'anchor' };
type Ball = Vec & { vx: number; vy: number; radius: number; active: boolean };

type Theme = {
  title: string;
  subtitle: string;
  launcher: string;
  ball: string;
  pegs: Record<Peg['kind'], string>;
  winLine: string;
};

const theme: Theme = {
  title: 'PEBBLE: A Ruptura da Bufa',
  subtitle: 'Um pachinko caótico de gás cósmico, termos duvidosos e decisões gamer irreversíveis.',
  launcher: '#f97316',
  ball: '#ecfccb',
  pegs: {
    story: '#a3e635',
    spark: '#22d3ee',
    anchor: '#facc15',
  },
  winLine: 'Estoure os pegs verdes para selar a fenda fedorrenta antes que a sala vire outro universo.',
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <section class="hud">
      <div>
        <p class="eyebrow">volume 1 • termos de responsabilidade</p>
        <h1>${theme.title}</h1>
        <p>${theme.subtitle}</p>
      </div>
      <div class="stats">
        <span>Score <strong id="score">0</strong></span>
        <span>Shots <strong id="shots">10</strong></span>
        <span>Targets <strong id="targets">0</strong></span>
      </div>
    </section>
    <canvas id="game" width="960" height="640" aria-label="Pebble game canvas"></canvas>
    <section class="controls">
      <p>${theme.winLine}</p>
      <p><kbd>Mouse</kbd> mira • <kbd>Click</kbd>/<kbd>Espaço</kbd> dispara • <kbd>R</kbd> reinicia • som liga no primeiro disparo</p>
    </section>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing canvas');
const context = canvas.getContext('2d');
if (!context) throw new Error('Missing 2D context');
const ctx: CanvasRenderingContext2D = context;

const scoreEl = document.querySelector<HTMLElement>('#score')!;
const shotsEl = document.querySelector<HTMLElement>('#shots')!;
const targetsEl = document.querySelector<HTMLElement>('#targets')!;

const W = canvas.width;
const H = canvas.height;
const gravity = 0.105;
const airFriction = 0.9992;
const wallBounce = 0.82;
const pegBounce = 0.84;
const fixedStep = 1 / 120;
const launcher: Vec = { x: W / 2, y: 46 };
let aim: Vec = { x: W / 2, y: 260 };
let score = 0;
let shots = 10;
let pegs: Peg[] = [];
let ball: Ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false };
let message = 'Assine os termos e mire na fenda.';
let shotScore = 0;
let shotHits = 0;
let audio: AudioContext | null = null;

function makeLevel() {
  const level: Peg[] = [];
  const rows = [8, 9, 10, 11, 10, 9, 8, 7];
  rows.forEach((count, row) => {
    const y = 130 + row * 55;
    const start = W / 2 - ((count - 1) * 70) / 2;
    for (let i = 0; i < count; i += 1) {
      const kind: Peg['kind'] = (row + i) % 7 === 0 ? 'anchor' : (row * 3 + i) % 5 === 0 ? 'spark' : 'story';
      level.push({
        x: start + i * 70 + Math.sin(row * 1.7 + i) * 10,
        y: y + Math.sin(i * 1.3 + row) * 12,
        radius: kind === 'anchor' ? 15 : 14,
        hit: false,
        kind,
      });
    }
  });

  for (let i = 0; i < 13; i += 1) {
    level.push({
      x: 120 + i * 60,
      y: 565 + Math.sin(i) * 8,
      radius: 12,
      hit: false,
      kind: i % 3 === 0 ? 'spark' : 'anchor',
    });
  }

  return level;
}

function reset() {
  score = 0;
  shots = 10;
  pegs = makeLevel();
  ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false };
  message = 'Assine os termos e mire na fenda.';
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(score);
  shotsEl.textContent = String(shots);
  targetsEl.textContent = String(pegs.filter((p) => p.kind === 'story' && !p.hit).length);
}

function getShotVector(power = 6.8) {
  const dx = aim.x - launcher.x;
  const dy = Math.max(90, aim.y - launcher.y);
  const len = Math.hypot(dx, dy) || 1;
  return { vx: (dx / len) * power, vy: (dy / len) * power };
}

function fire() {
  if (ball.active || shots <= 0) return;
  ensureAudio();
  const shot = getShotVector();
  ball = { x: launcher.x, y: launcher.y, vx: shot.vx, vy: shot.vy, radius: 8, active: true };
  shots -= 1;
  shotScore = 0;
  shotHits = 0;
  message = '';
  playTone(110, 0.07, 'sawtooth', 0.04);
  playTone(180, 0.09, 'triangle', 0.03, 0.04);
  syncHud();
}

function update() {
  if (!ball.active) return;

  for (let i = 0; i < 2; i += 1) {
    stepPhysics(fixedStep);
  }
}

function stepPhysics(_dt: number) {
  ball.vy += gravity;
  ball.vx *= airFriction;
  ball.vy *= airFriction;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.radius || ball.x > W - ball.radius) {
    ball.vx *= -wallBounce;
    ball.x = Math.max(ball.radius, Math.min(W - ball.radius, ball.x));
    playTone(120, 0.035, 'square', 0.025);
  }
  if (ball.y < ball.radius) {
    ball.vy *= -wallBounce;
    ball.y = ball.radius;
    playTone(140, 0.035, 'square', 0.025);
  }

  const collisions = pegs
    .filter((peg) => !peg.hit)
    .map((peg) => ({ peg, dist: Math.hypot(ball.x - peg.x, ball.y - peg.y) }))
    .filter(({ peg, dist }) => dist < ball.radius + peg.radius)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2);

  for (const { peg, dist } of collisions) {
    collidePeg(peg, dist);
  }

  if (ball.y > H + 80) {
    ball.active = false;
    ball.x = launcher.x;
    ball.y = launcher.y;
    ball.vx = 0;
    ball.vy = 0;
    const remaining = pegs.filter((p) => p.kind === 'story' && !p.hit).length;
    message = endOfShotMessage(remaining);
    if (remaining === 0) playWin();
  }
}

function collidePeg(peg: Peg, dist: number) {
  if (peg.hit) return;
  peg.hit = true;
  const dx = ball.x - peg.x;
  const dy = ball.y - peg.y;
  const nx = dx / (dist || 1);
  const ny = dy / (dist || 1);
  const min = ball.radius + peg.radius;
  const incoming = ball.vx * nx + ball.vy * ny;

  if (incoming < 0) {
    ball.vx = (ball.vx - 2 * incoming * nx) * pegBounce;
    ball.vy = (ball.vy - 2 * incoming * ny) * pegBounce;
  } else {
    ball.vx += nx * 0.16;
    ball.vy += ny * 0.16;
  }

  ball.x = peg.x + nx * (min + 0.4);
  ball.y = peg.y + ny * (min + 0.4);
  const points = peg.kind === 'story' ? 100 : peg.kind === 'spark' ? 60 : 35;
  score += points;
  shotScore += points;
  shotHits += 1;
  playFart(peg.kind);
  syncHud();
}

function endOfShotMessage(remaining: number) {
  if (remaining === 0) return `INVASÃO CONTIDA! ${shotScore} pontos em ${shotHits} peidos cósmicos.`;
  if (shotHits === 0) return shots > 0 ? 'Vácuo total. Nem o bueiro acreditou nesse disparo.' : 'Fim de rodada. Pressione R para reabrir os termos.';
  if (shotScore >= 900) return `COMBO FEDORENTO! ${shotScore} pontos, ${shotHits} pegs atingidos.`;
  if (shotScore >= 500) return `Bufa encadeada: ${shotScore} pontos em ${shotHits} impactos.`;
  if (shotScore >= 200) return `Peidinho eficiente: ${shotScore} pontos.`;
  return `Microbufa registrada: ${shotScore} pontos.`;
}

function draw() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#050816');
  gradient.addColorStop(0.42, '#052e16');
  gradient.addColorStop(0.72, '#1e1b4b');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawVortex();
  drawCity();
  drawBucket();
  drawLauncher();
  drawTrajectory();

  for (const peg of pegs) drawPeg(peg);
  drawBall();
  drawMessage();
}

function drawStars() {
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = '#fff7ad';
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 97) % W;
    const y = 80 + ((i * 53) % (H - 140));
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function drawVortex() {
  ctx.save();
  ctx.translate(W / 2, 118);
  for (let i = 0; i < 42; i += 1) {
    const radius = 18 + i * 3.1;
    ctx.rotate(0.1);
    ctx.strokeStyle = `rgba(163, 230, 53, ${0.42 - i * 0.007})`;
    ctx.lineWidth = Math.max(1, 8 - i * 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, radius, i * 0.22, Math.PI * 1.4 + i * 0.22);
    ctx.stroke();
  }
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCity() {
  ctx.save();
  ctx.globalAlpha = 0.72;
  for (let i = 0; i < 18; i += 1) {
    const width = 28 + ((i * 13) % 34);
    const height = 50 + ((i * 29) % 120);
    const x = i * 58 - 18;
    const y = H - 72 - height;
    ctx.fillStyle = i % 3 === 0 ? '#111827' : '#1f2937';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#facc15';
    for (let wy = y + 12; wy < y + height - 8; wy += 20) {
      for (let wx = x + 7; wx < x + width - 6; wx += 14) {
        if ((wx + wy + i) % 3 === 0) ctx.fillRect(wx, wy, 4, 5);
      }
    }
  }
  ctx.restore();
}

function drawBucket() {
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(W / 2 - 104, H - 28, 208, 18);
  ctx.fillStyle = '#d9f99d';
  ctx.font = '800 14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BUEIRO DIMENSIONAL', W / 2, H - 36);
}

function drawLauncher() {
  const dx = aim.x - launcher.x;
  const dy = aim.y - launcher.y;
  const len = Math.hypot(dx, dy) || 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(launcher.x, launcher.y);
  ctx.lineTo(launcher.x + (dx / len) * 116, launcher.y + (dy / len) * 116);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = theme.launcher;
  ctx.beginPath();
  ctx.arc(launcher.x, launcher.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b2f00';
  ctx.font = '700 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BUF', launcher.x, launcher.y + 4);
}

function drawTrajectory() {
  if (ball.active) return;
  const shot = getShotVector(6.8);
  let px = launcher.x;
  let py = launcher.y;
  let vx = shot.vx;
  let vy = shot.vy;
  ctx.save();
  ctx.fillStyle = 'rgba(236, 252, 203, 0.58)';
  for (let i = 0; i < 54; i += 1) {
    vy += gravity;
    vx *= airFriction;
    vy *= airFriction;
    px += vx * 2;
    py += vy * 2;
    if (px < 10 || px > W - 10 || py > H) break;
    if (i % 3 === 0) {
      ctx.globalAlpha = Math.max(0.08, 0.55 - i * 0.008);
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPeg(peg: Peg) {
  ctx.save();
  ctx.globalAlpha = peg.hit ? 0.11 : 1;
  ctx.shadowColor = theme.pegs[peg.kind];
  ctx.shadowBlur = peg.hit ? 0 : 12;
  ctx.fillStyle = theme.pegs[peg.kind];
  ctx.beginPath();
  ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.shadowColor = '#bef264';
  ctx.shadowBlur = ball.active ? 16 : 8;
  ctx.fillStyle = theme.ball;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#111827';
  ctx.stroke();
  ctx.restore();
}

function drawMessage() {
  ctx.fillStyle = 'rgba(15,23,42,0.72)';
  ctx.fillRect(24, H - 64, 520, 40);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 16px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(message, 42, H - 39);
}

function ensureAudio() {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
}

function playFart(kind: Peg['kind']) {
  if (!audio) return;
  const start = audio.currentTime;
  const duration = kind === 'story' ? 0.18 : kind === 'spark' ? 0.11 : 0.14;
  const base = kind === 'story' ? 72 : kind === 'spark' ? 115 : 88;
  const osc = audio.createOscillator();
  const mod = audio.createOscillator();
  const modGain = audio.createGain();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();

  osc.type = 'sawtooth';
  mod.type = 'sine';
  osc.frequency.setValueAtTime(base, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(35, base * 0.55), start + duration);
  mod.frequency.setValueAtTime(22, start);
  modGain.gain.setValueAtTime(kind === 'spark' ? 18 : 28, start);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(kind === 'spark' ? 520 : 340, start);
  filter.Q.setValueAtTime(7, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(kind === 'story' ? 0.11 : 0.075, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  mod.connect(modGain);
  modGain.connect(osc.frequency);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  mod.start(start);
  osc.stop(start + duration + 0.02);
  mod.stop(start + duration + 0.02);
}

function playTone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.72), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playWin() {
  [392, 523, 659, 784].forEach((freq, i) => playTone(freq, 0.12, 'triangle', 0.06, i * 0.08));
}

function frame() {
  update();
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  aim = {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
});
canvas.addEventListener('click', fire);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') reset();
  if (event.key === ' ') fire();
});

reset();
frame();
