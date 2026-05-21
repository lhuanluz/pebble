import { PeideAudio } from './audio';
import { characters, comboNames, levels, type Character, type LevelDef, type PegKind } from './content';

type Vec = { x: number; y: number };
type Peg = Vec & { radius: number; hit: boolean; kind: PegKind; pulse: number };
type Ball = Vec & { vx: number; vy: number; radius: number; active: boolean };
type GameState = 'start' | 'playing' | 'level-clear' | 'game-over' | 'finished';

const W = 960;
const H = 640;
const airFriction = 0.9992;
const wallBounce = 0.82;
const pegBounce = 0.84;
const launcher: Vec = { x: W / 2, y: 46 };

export class PebbleGame {
  private ctx: CanvasRenderingContext2D;
  private audio = new PeideAudio();
  private aim: Vec = { x: W / 2, y: 260 };
  private ball: Ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false };
  private pegs: Peg[] = [];
  private levelIndex = 0;
  private characterIndex = 0;
  private score = 0;
  private shots = 0;
  private shotScore = 0;
  private shotHits = 0;
  private combo = 1;
  private message = 'Clique para começar a ruptura.';
  private state: GameState = 'start';
  private raf = 0;

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
    this.canvas.addEventListener('pointermove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.aim = {
        x: ((event.clientX - rect.left) / rect.width) * W,
        y: ((event.clientY - rect.top) / rect.height) * H,
      };
    });
    this.canvas.addEventListener('pointerdown', () => this.primaryAction());
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r') this.restart();
      if (event.key === ' ') this.primaryAction();
      if (event.key === 'ArrowLeft') this.pickCharacter(-1);
      if (event.key === 'ArrowRight') this.pickCharacter(1);
    });
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
    this.ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false };
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
        const kind: PegKind = villain ? 'villain' : (row + i) % 7 === 0 ? 'anchor' : (row * 3 + i) % 5 === 0 ? 'spark' : 'story';
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
      pegs.push({ x: 145 + i * 58, y: 565 + Math.sin(i) * 8, radius: 11, hit: false, kind: i % 3 === 0 ? 'spark' : 'anchor', pulse: i });
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

  private shotVector(power = this.level.power) {
    const dx = this.aim.x - launcher.x;
    const dy = Math.max(90, this.aim.y - launcher.y);
    const len = Math.hypot(dx, dy) || 1;
    return { vx: (dx / len) * power, vy: (dy / len) * power };
  }

  private fire() {
    if (this.ball.active || this.shots <= 0) return;
    const shot = this.shotVector();
    this.ball = { x: launcher.x, y: launcher.y, vx: shot.vx, vy: shot.vy, radius: 8, active: true };
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
    if (this.ball.active) {
      for (let i = 0; i < 2; i += 1) this.stepPhysics();
    }
    for (const peg of this.pegs) peg.pulse += 0.035;
  }

  private stepPhysics() {
    this.ball.vy += this.level.gravity;
    this.ball.vx *= airFriction;
    this.ball.vy *= airFriction;
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    if (this.ball.x < this.ball.radius || this.ball.x > W - this.ball.radius) {
      this.ball.vx *= -wallBounce;
      this.ball.x = Math.max(this.ball.radius, Math.min(W - this.ball.radius, this.ball.x));
      this.audio.tone(120, 0.035, 'square', 0.018);
    }
    if (this.ball.y < this.ball.radius) {
      this.ball.vy *= -wallBounce;
      this.ball.y = this.ball.radius;
      this.audio.tone(140, 0.035, 'square', 0.018);
    }

    const collisions = this.pegs
      .filter((peg) => !peg.hit)
      .map((peg) => ({ peg, dist: Math.hypot(this.ball.x - peg.x, this.ball.y - peg.y) }))
      .filter(({ peg, dist }) => dist < this.ball.radius + peg.radius)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);
    for (const { peg, dist } of collisions) this.collidePeg(peg, dist);

    if (this.ball.y > H + 80) this.endShot();
  }

  private collidePeg(peg: Peg, dist: number) {
    peg.hit = true;
    const dx = this.ball.x - peg.x;
    const dy = this.ball.y - peg.y;
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const min = this.ball.radius + peg.radius;
    const incoming = this.ball.vx * nx + this.ball.vy * ny;
    if (incoming < 0) {
      this.ball.vx = (this.ball.vx - 2 * incoming * nx) * pegBounce;
      this.ball.vy = (this.ball.vy - 2 * incoming * ny) * pegBounce;
    } else {
      this.ball.vx += nx * 0.16;
      this.ball.vy += ny * 0.16;
    }
    this.ball.x = peg.x + nx * (min + 0.4);
    this.ball.y = peg.y + ny * (min + 0.4);

    const base = peg.kind === 'villain' ? 500 : peg.kind === 'story' ? 100 : peg.kind === 'spark' ? 60 : 35;
    const points = base * this.combo;
    this.score += points;
    this.shotScore += points;
    this.shotHits += 1;
    this.combo = Math.min(8, this.combo + 1);
    this.audio.fart(peg.kind, this.combo);
    this.spawnGas(peg.x, peg.y, peg.kind);
    this.syncHud();
  }

  private endShot() {
    this.ball.active = false;
    this.ball = { x: launcher.x, y: launcher.y, vx: 0, vy: 0, radius: 8, active: false };
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
    const color = kind === 'villain' ? '#a855f7' : kind === 'spark' ? '#22d3ee' : '#a3e635';
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
    this.drawGas();
    this.drawBall();
    this.drawMessage();
    if (this.state !== 'playing') this.drawOverlay();
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
    const dx = this.aim.x - launcher.x;
    const dy = this.aim.y - launcher.y;
    const len = Math.hypot(dx, dy) || 1;
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
      vy += this.level.gravity;
      vx *= airFriction;
      vy *= airFriction;
      px += vx * 2;
      py += vy * 2;
      if (px < 10 || px > W - 10 || py > H) break;
      if (i % 3 === 0) {
        this.ctx.globalAlpha = Math.max(0.08, 0.55 - i * 0.008);
        this.ctx.beginPath();
        this.ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  private drawPeg(peg: Peg) {
    this.ctx.save();
    this.ctx.globalAlpha = peg.hit ? 0.1 : 1;
    const color = peg.kind === 'villain' ? '#a855f7' : peg.kind === 'spark' ? this.level.palette.accent : peg.kind === 'anchor' ? '#facc15' : this.level.palette.peg;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = peg.hit ? 0 : 10 + Math.sin(peg.pulse) * 4;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(peg.x, peg.y, peg.radius + Math.sin(peg.pulse) * 0.8, 0, Math.PI * 2);
    this.ctx.fill();
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

  private drawBall() {
    this.ctx.save();
    this.ctx.shadowColor = '#bef264';
    this.ctx.shadowBlur = this.ball.active ? 16 : 8;
    this.ctx.fillStyle = '#ecfccb';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = '#111827';
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
    const helper = this.state === 'start' ? '←/→ troca personagem • clique para começar' : this.state === 'level-clear' ? 'Clique para avançar' : 'Pressione R ou clique para reiniciar';
    this.ctx.fillText(helper, W / 2, 310);
    this.ctx.fillStyle = this.character.color;
    this.ctx.font = '800 18px system-ui';
    this.ctx.fillText(`${this.character.name} — ${this.character.role}`, W / 2, 350);
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
