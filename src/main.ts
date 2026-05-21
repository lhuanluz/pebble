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
  title: 'Pebble: PEIDE Table',
  subtitle: 'Protótipo arcade inspirado em Peggle. O pacote visual/textual do PEIDE entra quando o PDF estiver acessível.',
  launcher: '#f7c948',
  ball: '#f9fafb',
  pegs: {
    story: '#ff6b6b',
    spark: '#48dbfb',
    anchor: '#7bed9f',
  },
  winLine: 'Limpe todos os pegs vermelhos para fechar a rodada.',
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <section class="hud">
      <div>
        <p class="eyebrow">pebble prototype</p>
        <h1>${theme.title}</h1>
        <p>${theme.subtitle}</p>
      </div>
      <div class="stats">
        <span>Score <strong id="score">0</strong></span>
        <span>Shots <strong id="shots">8</strong></span>
        <span>Targets <strong id="targets">0</strong></span>
      </div>
    </section>
    <canvas id="game" width="960" height="640" aria-label="Pebble game canvas"></canvas>
    <section class="controls">
      <p>${theme.winLine}</p>
      <p><kbd>Mouse</kbd> mira • <kbd>Click</kbd> dispara • <kbd>R</kbd> reinicia</p>
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
const gravity = 0.22;
const damping = 0.992;
const launcher: Vec = { x: W / 2, y: 46 };
let aim: Vec = { x: W / 2, y: 260 };
let score = 0;
let shots = 8;
let pegs: Peg[] = [];
let ball: Ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 9, active: false };
let message = 'Mire e dispare.';

function makeLevel() {
  const level: Peg[] = [];
  const rows = [6, 7, 8, 7, 6];
  rows.forEach((count, row) => {
    const y = 165 + row * 72;
    const start = W / 2 - ((count - 1) * 82) / 2;
    for (let i = 0; i < count; i += 1) {
      const special = (row + i) % 5 === 0 ? 'anchor' : (row * i) % 4 === 0 ? 'spark' : 'story';
      level.push({ x: start + i * 82, y: y + Math.sin(i + row) * 16, radius: 17, hit: false, kind: special });
    }
  });
  return level;
}

function reset() {
  score = 0;
  shots = 8;
  pegs = makeLevel();
  ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 9, active: false };
  message = 'Mire e dispare.';
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(score);
  shotsEl.textContent = String(shots);
  targetsEl.textContent = String(pegs.filter((p) => p.kind === 'story' && !p.hit).length);
}

function fire() {
  if (ball.active || shots <= 0) return;
  const dx = aim.x - launcher.x;
  const dy = Math.max(80, aim.y - launcher.y);
  const len = Math.hypot(dx, dy) || 1;
  const power = 11.5;
  ball = {
    x: launcher.x,
    y: launcher.y,
    vx: (dx / len) * power,
    vy: (dy / len) * power,
    radius: 9,
    active: true,
  };
  shots -= 1;
  message = 'Boa sorte.';
  syncHud();
}

function update() {
  if (!ball.active) return;
  ball.vy += gravity;
  ball.vx *= damping;
  ball.vy *= damping;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.radius || ball.x > W - ball.radius) {
    ball.vx *= -0.9;
    ball.x = Math.max(ball.radius, Math.min(W - ball.radius, ball.x));
  }
  if (ball.y < ball.radius) {
    ball.vy *= -0.9;
    ball.y = ball.radius;
  }

  for (const peg of pegs) {
    if (peg.hit) continue;
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const dist = Math.hypot(dx, dy);
    const min = ball.radius + peg.radius;
    if (dist < min) {
      peg.hit = true;
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * 1.04;
      ball.vy = (ball.vy - 2 * dot * ny) * 1.04;
      ball.x = peg.x + nx * min;
      ball.y = peg.y + ny * min;
      score += peg.kind === 'story' ? 100 : peg.kind === 'spark' ? 50 : 25;
      message = peg.kind === 'story' ? 'Alvo narrativo limpo!' : 'Ricochete!';
      syncHud();
    }
  }

  if (ball.y > H + 80) {
    ball.active = false;
    ball.x = launcher.x;
    ball.y = launcher.y;
    ball.vx = 0;
    ball.vy = 0;
    const remaining = pegs.filter((p) => p.kind === 'story' && !p.hit).length;
    message = remaining === 0 ? 'Rodada vencida!' : shots > 0 ? 'Mire o próximo disparo.' : 'Fim de rodada. Pressione R.';
  }
}

function draw() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(0.62, '#25153d');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawBucket();
  drawLauncher();

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

function drawBucket() {
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(W / 2 - 88, H - 26, 176, 16);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '700 14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('BONUS', W / 2, H - 32);
}

function drawLauncher() {
  const dx = aim.x - launcher.x;
  const dy = aim.y - launcher.y;
  const len = Math.hypot(dx, dy) || 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(launcher.x, launcher.y);
  ctx.lineTo(launcher.x + (dx / len) * 105, launcher.y + (dy / len) * 105);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = theme.launcher;
  ctx.beginPath();
  ctx.arc(launcher.x, launcher.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b2f00';
  ctx.font = '700 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('PEB', launcher.x, launcher.y + 4);
}

function drawPeg(peg: Peg) {
  ctx.save();
  ctx.globalAlpha = peg.hit ? 0.16 : 1;
  ctx.fillStyle = theme.pegs[peg.kind];
  ctx.beginPath();
  ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBall() {
  ctx.fillStyle = theme.ball;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.stroke();
}

function drawMessage() {
  ctx.fillStyle = 'rgba(15,23,42,0.72)';
  ctx.fillRect(24, H - 64, 420, 40);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 16px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(message, 42, H - 39);
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
