import './style.css';
import { PebbleGame } from './game/game';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="shell">
    <section class="hud">
      <div>
        <p class="eyebrow">volume 1 • termos de responsabilidade</p>
        <h1>PEBBLE: A Ruptura da Bufa</h1>
        <p>Um pachinko caótico de gás cósmico, motoca elétrica, sapão extradimensional e decisões gamer irreversíveis.</p>
      </div>
      <div class="stats">
        <span>Score <strong id="score">0</strong></span>
        <span>Shots <strong id="shots">0</strong></span>
        <span>Targets <strong id="targets">0</strong></span>
        <span>Level <strong id="level">1/5</strong></span>
        <span>Hero <strong id="character">Diego</strong></span>
      </div>
    </section>
    <canvas id="game" width="960" height="640" aria-label="Pebble game canvas"></canvas>
    <section class="controls">
      <p>Limpe os alvos verdes/roxos para avançar pelas fases do PEIDE.</p>
      <p><kbd>Mouse/toque</kbd> mira • <kbd>Click</kbd>/<kbd>Espaço</kbd> dispara • <kbd>←</kbd><kbd>→</kbd> personagem • <kbd>R</kbd> reinicia</p>
    </section>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const score = document.querySelector<HTMLElement>('#score');
const shots = document.querySelector<HTMLElement>('#shots');
const targets = document.querySelector<HTMLElement>('#targets');
const level = document.querySelector<HTMLElement>('#level');
const character = document.querySelector<HTMLElement>('#character');

if (!canvas || !score || !shots || !targets || !level || !character) {
  throw new Error('Missing game elements');
}

new PebbleGame(canvas, { score, shots, targets, level, character }).start();
