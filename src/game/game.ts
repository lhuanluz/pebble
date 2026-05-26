import { PeideAudio } from './audio';
import { achievementDefs, characters, comboNames, dialogueLines, levels, type Character, type LevelDef, type PegKind } from './content';

type Vec = { x: number; y: number };
type Peg = Vec & { radius: number; hit: boolean; kind: PegKind; pulse: number };
type Ball = Vec & { vx: number; vy: number; radius: number; active: boolean };
type FloatingText = Vec & { text: string; life: number; color: string };
type TrailDot = Vec & { life: number; radius: number; color: string };
type GameState = 'start' | 'playing' | 'level-clear' | 'game-over' | 'finished';

const W = 960;
const H = 640;
const airFriction = 0.9992;
const wallBounce = 0.68;
const pegBounce = 0.48;
const physicsSteps = 1;
const movementScale = 0.52;
const slowmoFrameSkip = 2;
const launcher: Vec = { x: W / 2, y: 46 };

export class PebbleGame {
  private ctx: CanvasRenderingContext2D;
  private audio = new PeideAudio();
  private aim: Vec = { x: W / 2, y: 260 };
  private balls: Ball[] = [{ x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false }];
  private get ball() { return this.balls[0]; }
  private pegs: Peg[] = [];
  private levelIndex = 0;
  private characterIndex = 0;
  private score = 0;
  private shots = 0;
  private shotScore = 0;
  private shotHits = 0;
  private combo = 1;
  private fever = 0;
  private slowmo = 0;
  private shake = 0;
  private bestScore = Number(localStorage.getItem('pebble-best-score') || 0);
  private achievements = new Set<string>(JSON.parse(localStorage.getItem('pebble-achievements') || '[]') as string[]);
  private message = 'Clique para começar a ruptura.';
  private state: GameState = 'start';
  private raf = 0;
  private floatingTexts: FloatingText[] = [];
  private trails: TrailDot[] = [];
  private activeBall: Ball | null = null;
  private frame = 0;

  private canvas: HTMLCanvasElement;
  private hud: { score: HTMLElement; shots: HTMLElement; targets: HTMLElement; level: HTMLElement; character: HTMLElement };

  constructor(
    canvas: HTMLCanvasElement,
    hud: { score: HTMLElement; shots: HTMLElement; targets: HTMLElement; level: HTMLElement; character: HTMLElement },
  ) {
    this.canvas = canvas;
    this.hud = hud;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Missing 2D context');
    this.ctx = context;
    this.bind();
    this.loadLevel(0);
  }

  start() {
    this.loop();
  }

  private get level(): LevelDef {
    return levels[this.levelIndex];
  }

  private get character(): Character {
    return characters[this.characterIndex];
  }

  private bind() {
    this.canvas.addEventListener('pointermove', (event) => this.updateAim(event));
    this.canvas.addEventListener('pointerdown', (event) => {
      this.updateAim(event);
      this.primaryAction();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r') this.restart();
      if (event.key === ' ') this.primaryAction();
      if (event.key === 'ArrowLeft') this.pickCharacter(-1);
      if (event.key === 'ArrowRight') this.pickCharacter(1);
      if (this.state === 'start' && /^[1-5]$/.test(event.key)) {
        this.loadLevel(Number(event.key) - 1);
        this.message = this.level.scene;
      }
    });
  }

  private updateAim(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.aim = {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  }

  private primaryAction() {
    this.audio.unlock();
    if (this.state === 'start') {
      this.state = 'playing';
      this.message = `${this.character.name}: ${this.character.quote}`;
      return;
    }
    if (this.state === 'level-clear') {
      this.nextLevel();
      return;
    }
    if (this.state === 'game-over' || this.state === 'finished') {
      this.restart();
      return;
    }
    this.fire();
  }

  private pickCharacter(direction: number) {
    if (this.state !== 'start') return;
    this.characterIndex = (this.characterIndex + direction + characters.length) % characters.length;
    this.message = `${this.character.name}: ${this.character.role}`;
    this.syncHud();
  }

  private restart() {
    this.levelIndex = 0;
    this.score = 0;
    this.state = 'start';
    this.loadLevel(0);
    this.message = 'Clique para começar a ruptura.';
  }

  private nextLevel() {
    if (this.levelIndex >= levels.length - 1) {
      this.state = 'finished';
      this.message = 'Volume 1 fechado. A fenda continua...';
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.state = 'playing';
    this.message = this.level.scene;
  }

  private loadLevel(index: number) {
    this.levelIndex = index;
    this.shots = this.level.shots;
    this.balls = [{ x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false }];
    this.pegs = this.makeLevel(this.level);
    this.shotScore = 0;
    this.shotHits = 0;
    this.combo = 1;
    this.syncHud();
  }

  private makeLevel(level: LevelDef) {
    const pegs: Peg[] = [];
    level.rows.forEach((count, row) => {
      const y = 116 + row * 48;
      const start = W / 2 - ((count - 1) * 61) / 2;
      for (let i = 0; i < count; i += 1) {
        const villain = level.id === 'fenda-final' && row === 3 && i === Math.floor(count / 2);
        const special = (row * 11 + i * 7 + level.id.length) % 17;
        const kind: PegKind = villain ? 'villain' : special === 0 ? 'multiball' : special === 1 ? 'slowmo' : special === 2 ? 'bumper' : (row + i) % 7 === 0 ? 'anchor' : (row * 3 + i) % 5 === 0 ? 'spark' : 'story';
        pegs.push({
          x: start + i * 61 + Math.sin(row * 1.7 + i) * 9,
          y: y + Math.sin(i * 1.3 + row) * 10,
          radius: kind === 'villain' ? 22 : kind === 'anchor' ? 13 : 12,
          hit: false,
          kind,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    });
    for (let i = 0; i < 12; i += 1) {
      pegs.push({ x: 145 + i * 58, y: 565 + Math.sin(i) * 8, radius: 11, hit: false, kind: i % 4 === 0 ? 'bumper' : i % 3 === 0 ? 'spark' : 'anchor', pulse: i });
    }
    return pegs;
  }

  private syncHud() {
    this.hud.score.textContent = String(this.score);
    this.hud.shots.textContent = String(this.shots);
    this.hud.targets.textContent = String(this.targetsLeft());
    this.hud.level.textContent = `${this.levelIndex + 1}/${levels.length}`;
    this.hud.character.textContent = this.character.name;
  }

  private targetsLeft() {
    return this.pegs.filter((p) => (p.kind === 'story' || p.kind === 'villain') && !p.hit).length;
  }

  private pegColor(kind: PegKind) {
    return kind === 'villain' ? '#a855f7' : kind === 'multiball' ? '#fb7185' : kind === 'slowmo' ? '#22d3ee' : kind === 'bumper' ? '#f97316' : kind === 'spark' ? this.level.palette.accent : kind === 'anchor' ? '#facc15' : this.level.palette.peg;
  }

  private aimVector() {
    const dx = this.aim.x - launcher.x;
    const dy = this.aim.y - launcher.y;
    const len = Math.hypot(dx, dy) || 1;
    return { dx, dy, len };
  }

  private shotVector(power = this.level.power) {
    const { dx, dy, len } = this.aimVector();
    return { vx: (dx / len) * power, vy: (dy / len) * power };
  }

  private fire() {
    if (this.balls.some((b) => b.active) || this.shots <= 0) return;
    const shot = this.shotVector();
    this.balls = [{ x: launcher.x, y: launcher.y, vx: shot.vx, vy: shot.vy, radius: 8, active: true }];
    this.shots -= 1;
    this.shotScore = 0;
    this.shotHits = 0;
    this.combo = 1;
    this.message = '';
    this.audio.tone(110, 0.07, 'sawtooth', 0.04);
    this.audio.tone(180, 0.09, 'triangle', 0.03, 0.04);
    this.syncHud();
  }

  private update() {
    this.frame += 1;
    const steps = this.slowmo > 0 && this.frame % slowmoFrameSkip !== 0 ? 0 : physicsSteps;
    for (const ball of this.balls.filter((b) => b.active)) {
      this.activeBall = ball;
      for (let i = 0; i < steps; i += 1) this.stepPhysics();
      if (ball.active) this.trails.push({ x: ball.x, y: ball.y, life: 1, radius: ball.radius, color: this.fever > 0 ? '#fef08a' : '#bef264' });
    }
    this.activeBall = null;
    if (this.balls.some((b) => b.active) && this.balls.every((b) => !b.active || b.y > H + 80)) this.endShot();
    for (const peg of this.pegs) peg.pulse += 0.035;
    this.fever = Math.max(0, this.fever - 1);
    this.slowmo = Math.max(0, this.slowmo - 1);
    this.shake = Math.max(0, this.shake * 0.88 - 0.05);
    for (const t of this.floatingTexts) { t.y -= 0.65; t.life -= 0.018; }
    this.floatingTexts = this.floatingTexts.filter((t) => t.life > 0);
    for (const t of this.trails) t.life -= 0.035;
    this.trails = this.trails.filter((t) => t.life > 0);
  }

  private stepPhysics() {
    const ball = this.activeBall ?? this.ball;
    ball.vy += this.level.gravity * (this.slowmo > 0 ? 0.72 : 1);
    ball.vx *= airFriction;
    ball.vy *= airFriction;
    ball.x += ball.vx * movementScale;
    ball.y += ball.vy * movementScale;

    if (ball.x < ball.radius || ball.x > W - ball.radius) {
      ball.vx *= -wallBounce;
      ball.x = Math.max(ball.radius, Math.min(W - ball.radius, ball.x));
      this.shake += 0.7;
      this.audio.tone(120, 0.035, 'square', 0.018);
    }
    if (ball.y < ball.radius) {
      ball.vy *= -wallBounce;
      ball.y = ball.radius;
      this.audio.tone(140, 0.035, 'square', 0.018);
    }

    const collisions = this.pegs
      .filter((peg) => !peg.hit)
      .map((peg) => ({ peg, dist: Math.hypot(ball.x - peg.x, ball.y - peg.y) }))
      .filter(({ peg, dist }) => dist < ball.radius + peg.radius)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);
    for (const { peg, dist } of collisions) this.collidePeg(peg, dist, ball);

    if (ball.y > H + 80) ball.active = false;
  }

  private collidePeg(peg: Peg, dist: number, ball: Ball) {
    peg.hit = true;
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const min = ball.radius + peg.radius;
    const incoming = ball.vx * nx + ball.vy * ny;
    const bounce = peg.kind === 'bumper' ? 0.72 : pegBounce;
    if (incoming < 0) {
      ball.vx = (ball.vx - 2 * incoming * nx) * bounce;
      ball.vy = (ball.vy - 2 * incoming * ny) * bounce;
    } else {
      ball.vx += nx * (peg.kind === 'bumper' ? 0.28 : 0.04);
      ball.vy += ny * (peg.kind === 'bumper' ? 0.28 : 0.04);
    }
    ball.x = peg.x + nx * (min + 0.4);
    ball.y = peg.y + ny * (min + 0.4);

    if (peg.kind === 'multiball') this.spawnMultiball(ball);
    if (peg.kind === 'slowmo') this.slowmo = 150;
    if (peg.kind === 'bumper') this.shake += 4;

    const base = peg.kind === 'villain' ? 500 : peg.kind === 'story' ? 100 : peg.kind === 'multiball' ? 180 : peg.kind === 'slowmo' ? 160 : peg.kind === 'bumper' ? 140 : peg.kind === 'spark' ? 60 : 35;
    const points = base * this.combo;
    this.score += points;
    this.bestScore = Math.max(this.bestScore, this.score);
    localStorage.setItem('pebble-best-score', String(this.bestScore));
    this.shotScore += points;
    this.shotHits += 1;
    this.combo = Math.min(10, this.combo + 1);
    if (this.combo >= 6) this.fever = 260;
    this.shake += peg.kind === 'villain' ? 9 : 1.6;
    this.audio.fart(peg.kind === 'multiball' || peg.kind === 'slowmo' || peg.kind === 'bumper' ? 'spark' : peg.kind, this.combo);
    this.spawnGas(peg.x, peg.y, peg.kind);
    this.floatingTexts.push({ x: peg.x, y: peg.y - 18, text: `+${points}`, life: 1, color: peg.kind === 'villain' ? '#f0abfc' : '#fef08a' });
    this.checkAchievements();
    if (this.shotHits % 5 === 0) this.message = dialogueLines[(this.shotHits + this.levelIndex) % dialogueLines.length];
    this.syncHud();
  }

  private spawnMultiball(source: Ball) {
    if (this.balls.filter((b) => b.active).length >= 4) return;
    this.balls.push(
      { ...source, vx: source.vx * 0.62 + 1.15, vy: source.vy * 0.7 - 0.7, active: true },
      { ...source, vx: source.vx * 0.62 - 1.15, vy: source.vy * 0.7 - 0.7, active: true },
    );
    this.message = 'MULTIBUFA! Duas bolas extras entraram na fenda.';
  }

  private checkAchievements() {
    for (const achievement of achievementDefs) {
      if (!this.achievements.has(achievement.id) && achievement.test(this.score, this.combo, this.shotHits)) {
        this.achievements.add(achievement.id);
        localStorage.setItem('pebble-achievements', JSON.stringify([...this.achievements]));
        this.floatingTexts.push({ x: W / 2, y: 96, text: `Badge: ${achievement.label}`, life: 1.8, color: '#67e8f9' });
        this.audio.tone(880, 0.16, 'triangle', 0.05);
      }
    }
  }

  private endShot() {
    this.balls = [{ x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false }];
    const remaining = this.targetsLeft();
    this.message = this.endOfShotMessage(remaining);
    if (remaining === 0) {
      this.audio.win();
      this.state = this.levelIndex === levels.length - 1 ? 'finished' : 'level-clear';
    } else if (this.shots <= 0) {
      this.state = 'game-over';
    }
  }

  private endOfShotMessage(remaining: number) {
    if (remaining === 0 && this.levelIndex === levels.length - 1) return `FENDA SELADA! ${this.shotScore} pontos. Mas isso é só o começo...`;
    if (remaining === 0) return `Fase limpa! ${this.shotScore} pontos em ${this.shotHits} peidos cósmicos. Clique para avançar.`;
    if (this.shotHits === 0) return this.shots > 0 ? 'Vácuo total. Nem o bueiro acreditou nesse disparo.' : 'Sem tiros. Pressione R para reabrir os termos.';
    const tier = this.shotScore >= 1400 ? 4 : this.shotScore >= 900 ? 3 : this.shotScore >= 500 ? 2 : this.shotScore >= 200 ? 1 : 0;
    return `${comboNames[tier]}: ${this.shotScore} pontos, ${this.shotHits} impactos. Restam ${remaining} alvos.`;
  }

  private gas: Array<Vec & { life: number; color: string; vx: number; vy: number }> = [];

  private spawnGas(x: number, y: number, kind: PegKind) {
    const color = kind === 'villain' ? '#a855f7' : kind === 'multiball' ? '#fb7185' : kind === 'slowmo' ? '#22d3ee' : kind === 'bumper' ? '#f97316' : kind === 'spark' ? '#22d3ee' : '#a3e635';
    for (let i = 0; i < (kind === 'villain' ? 32 : 14); i += 1) {
      const a = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.8;
      this.gas.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, color });
    }
  }

  private updateGas() {
    for (const g of this.gas) {
      g.x += g.vx;
      g.y += g.vy;
      g.vy -= 0.008;
      g.life -= 0.018;
    }
    this.gas = this.gas.filter((g) => g.life > 0);
  }

  private draw() {
    this.updateGas();
    this.ctx.save();
    if (this.shake > 0.1) this.ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    const p = this.level.palette;
    const gradient = this.ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, p.top);
    gradient.addColorStop(0.45, p.mid);
    gradient.addColorStop(1, p.bottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, W, H);
    this.drawStars();
    this.drawVortex();
    this.drawCity();
    this.drawBucket();
    this.drawLauncher();
    this.drawTrajectory();
    for (const peg of this.pegs) this.drawPeg(peg);
    this.drawTrails();
    this.drawGas();
    this.drawBalls();
    this.drawFloatingTexts();
    this.drawPortraitStrip();
    this.drawMessage();
    if (this.state !== 'playing') this.drawOverlay();
    this.ctx.restore();
  }

  private drawStars() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.22;
    this.ctx.fillStyle = '#fff7ad';
    for (let i = 0; i < 90; i += 1) this.ctx.fillRect((i * 97) % W, 80 + ((i * 53) % (H - 140)), 2, 2);
    this.ctx.restore();
  }

  private drawVortex() {
    this.ctx.save();
    this.ctx.translate(W / 2, 112);
    for (let i = 0; i < 42; i += 1) {
      const radius = 18 + i * 3.1;
      this.ctx.rotate(0.1);
      this.ctx.strokeStyle = `rgba(163, 230, 53, ${0.42 - i * 0.007})`;
      this.ctx.lineWidth = Math.max(1, 8 - i * 0.14);
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, i * 0.22, Math.PI * 1.4 + i * 0.22);
      this.ctx.stroke();
    }
    this.ctx.fillStyle = '#020617';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 28, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawCity() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.72;
    for (let i = 0; i < 18; i += 1) {
      const width = 28 + ((i * 13) % 34);
      const height = 50 + ((i * 29) % 120);
      const x = i * 58 - 18;
      const y = H - 72 - height;
      this.ctx.fillStyle = i % 3 === 0 ? '#111827' : '#1f2937';
      this.ctx.fillRect(x, y, width, height);
      this.ctx.fillStyle = '#facc15';
      for (let wy = y + 12; wy < y + height - 8; wy += 20) {
        for (let wx = x + 7; wx < x + width - 6; wx += 14) if ((wx + wy + i) % 3 === 0) this.ctx.fillRect(wx, wy, 4, 5);
      }
    }
    this.ctx.restore();
  }

  private drawBucket() {
    const x = W / 2 + Math.sin(Date.now() / 700) * 210;
    this.ctx.fillStyle = '#65a30d';
    this.ctx.fillRect(x - 96, H - 28, 192, 18);
    this.ctx.fillStyle = '#d9f99d';
    this.ctx.font = '800 13px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('BUEIRO DIMENSIONAL', x, H - 36);
    if (this.ball.active && this.ball.y > H - 44 && Math.abs(this.ball.x - x) < 102) {
      this.shots += 1;
      this.ball.y = H + 99;
      this.message = 'Bônus de bueiro! +1 tiro.';
    }
  }

  private drawLauncher() {
    const { dx, dy, len } = this.aimVector();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([8, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(launcher.x, launcher.y);
    this.ctx.lineTo(launcher.x + (dx / len) * 116, launcher.y + (dy / len) * 116);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = this.character.color;
    this.ctx.beginPath();
    this.ctx.arc(launcher.x, launcher.y, 24, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#111827';
    this.ctx.font = '800 11px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.character.name.slice(0, 3).toUpperCase(), launcher.x, launcher.y + 4);
  }

  private drawTrajectory() {
    if (this.ball.active || this.state !== 'playing') return;
    const shot = this.shotVector();
    let px = launcher.x;
    let py = launcher.y;
    let vx = shot.vx;
    let vy = shot.vy;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(236, 252, 203, 0.58)';
    for (let i = 0; i < 58; i += 1) {
      if (i % 3 === 0) {
        this.ctx.globalAlpha = Math.max(0.08, 0.55 - i * 0.008);
        this.ctx.beginPath();
        this.ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      vy += this.level.gravity;
      vx *= airFriction;
      vy *= airFriction;
      px += vx * physicsSteps * movementScale;
      py += vy * physicsSteps * movementScale;
      if (px < 10 || px > W - 10 || py > H) break;
    }
    this.ctx.restore();
  }

  private drawPeg(peg: Peg) {
    this.ctx.save();
    this.ctx.globalAlpha = peg.hit ? 0.1 : 1;
    const color = this.pegColor(peg.kind);
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = peg.hit ? 0 : 10 + Math.sin(peg.pulse) * 4;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(peg.x, peg.y, peg.radius + Math.sin(peg.pulse) * 0.8, 0, Math.PI * 2);
    this.ctx.fill();
    if (!peg.hit && (peg.kind === 'multiball' || peg.kind === 'slowmo' || peg.kind === 'bumper')) {
      this.ctx.fillStyle = '#020617';
      this.ctx.font = '900 12px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(peg.kind === 'multiball' ? '×2' : peg.kind === 'slowmo' ? '⏱' : '↯', peg.x, peg.y + 1);
    }
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawGas() {
    this.ctx.save();
    for (const g of this.gas) {
      this.ctx.globalAlpha = Math.max(0, g.life * 0.45);
      this.ctx.fillStyle = g.color;
      this.ctx.beginPath();
      this.ctx.arc(g.x, g.y, 4 + (1 - g.life) * 10, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawTrails() {
    this.ctx.save();
    for (const t of this.trails) {
      this.ctx.globalAlpha = t.life * 0.42;
      this.ctx.fillStyle = t.color;
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, t.radius * (1.8 - t.life), 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawBalls() {
    this.ctx.save();
    for (const ball of this.balls) {
      if (!ball.active && ball !== this.ball) continue;
      this.ctx.shadowColor = this.fever > 0 ? '#fde047' : '#bef264';
      this.ctx.shadowBlur = ball.active ? 16 : 8;
      this.ctx.fillStyle = this.fever > 0 ? '#fef08a' : '#ecfccb';
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#111827';
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawFloatingTexts() {
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.font = '900 18px system-ui';
    for (const t of this.floatingTexts) {
      this.ctx.globalAlpha = Math.min(1, t.life);
      this.ctx.fillStyle = t.color;
      this.ctx.fillText(t.text, t.x, t.y);
    }
    this.ctx.restore();
  }

  private drawPortraitStrip() {
    this.ctx.save();
    const x = W - 132;
    const y = 26;
    this.ctx.fillStyle = 'rgba(2,6,23,0.62)';
    this.ctx.fillRect(x - 18, y - 16, 120, 152);
    this.drawPortrait(this.character, x + 42, y + 48, 42);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = '900 15px system-ui';
    this.ctx.fillText(this.character.name, x + 42, y + 104);
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.font = '700 11px system-ui';
    this.ctx.fillText(`Best ${this.bestScore}`, x + 42, y + 124);
    this.ctx.restore();
  }

  private drawPortrait(character: Character, x: number, y: number, size: number) {
    const p = character.portrait;
    this.ctx.save();
    this.ctx.fillStyle = character.color;
    this.ctx.beginPath();
    this.ctx.roundRect(x - size, y - size, size * 2, size * 2, 18);
    this.ctx.fill();
    this.ctx.fillStyle = p.skin;
    this.ctx.beginPath();
    this.ctx.arc(x, y - 2, size * 0.54, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = p.hair;
    this.ctx.beginPath();
    this.ctx.arc(x - 4, y - 18, size * 0.5, Math.PI, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = p.shirt;
    this.ctx.beginPath();
    this.ctx.roundRect(x - size * 0.48, y + 22, size * 0.96, size * 0.5, 10);
    this.ctx.fill();
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    this.ctx.arc(x - 13, y - 2, 3, 0, Math.PI * 2);
    this.ctx.arc(x + 13, y - 2, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = p.accessory;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(x - 13, y - 2, 8, 0, Math.PI * 2);
    this.ctx.arc(x + 13, y - 2, 8, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawMessage() {
    if (!this.message) return;
    this.ctx.fillStyle = 'rgba(15,23,42,0.78)';
    this.ctx.fillRect(24, H - 68, 650, 44);
    this.ctx.fillStyle = '#e5e7eb';
    this.ctx.font = '700 16px system-ui';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(this.message, 42, H - 41);
  }

  private drawOverlay() {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(2,6,23,0.68)';
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#d9f99d';
    this.ctx.font = '900 42px system-ui';
    const title = this.state === 'start' ? 'PEBBLE' : this.state === 'level-clear' ? 'FASE LIMPA' : this.state === 'finished' ? 'CONTINUA...' : 'FIM DE RODADA';
    this.ctx.fillText(title, W / 2, 210);
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.font = '700 22px system-ui';
    this.ctx.fillText(this.state === 'start' ? this.level.title : this.message, W / 2, 260);
    this.ctx.font = '500 16px system-ui';
    this.ctx.fillStyle = '#cbd5e1';
    const helper = this.state === 'start' ? '←/→ troca personagem • 1–5 escolhe fase • clique para começar' : this.state === 'level-clear' ? 'Clique para avançar' : 'Pressione R ou clique para reiniciar';
    this.ctx.fillText(helper, W / 2, 310);
    this.ctx.fillStyle = this.character.color;
    this.ctx.font = '800 18px system-ui';
    this.ctx.fillText(`${this.character.name} — ${this.character.role}`, W / 2, 350);
    this.drawPortrait(this.character, W / 2, 430, 54);
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '700 14px system-ui';
    this.ctx.fillText(`Badges: ${this.achievements.size}/${achievementDefs.length} • Recorde local: ${this.bestScore}`, W / 2, 515);
    this.ctx.restore();
  }

  private loop = () => {
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  destroy() {
    cancelAnimationFrame(this.raf);
  }
}
