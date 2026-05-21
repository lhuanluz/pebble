export type PegKind = 'story' | 'spark' | 'anchor' | 'villain';

export type Character = {
  id: string;
  name: string;
  role: string;
  color: string;
  quote: string;
};

export type LevelDef = {
  id: string;
  title: string;
  scene: string;
  objective: string;
  rows: number[];
  palette: { top: string; mid: string; bottom: string; peg: string; accent: string };
  gravity: number;
  power: number;
  shots: number;
};

export const characters: Character[] = [
  { id: 'diego', name: 'Diego', role: 'o sobrevivente do quarto gamer', color: '#60a5fa', quote: 'Eu só queria jogar, mano.' },
  { id: 'digueu', name: 'Digueu', role: 'teórico da fenda fedida', color: '#fb7185', quote: 'Isso aí é responsabilidade quântica.' },
  { id: 'felipinho', name: 'Felipinho', role: 'analista de caos', color: '#c084fc', quote: 'Eu falei que o Discord dava problema.' },
  { id: 'bolao', name: 'Bolão', role: 'motoca e gerador de portal', color: '#f59e0b', quote: 'Com 10.000 W não tem erro.' },
];

export const levels: LevelDef[] = [
  {
    id: 'quarto-gamer',
    title: 'Fase 1 — Termos de Responsabilidade',
    scene: 'Quarto gamer, monitor ligado e um portal verde abrindo onde não devia.',
    objective: 'Neutralize os pegs verdes antes que a fenda engula o setup.',
    rows: [7, 8, 9, 8, 7, 6],
    palette: { top: '#050816', mid: '#052e16', bottom: '#111827', peg: '#a3e635', accent: '#22d3ee' },
    gravity: 0.105,
    power: 6.8,
    shots: 10,
  },
  {
    id: 'chamado-bolao',
    title: 'Fase 2 — Chamem o Bolão',
    scene: 'Rua à noite, motoca elétrica, gerador de portal e muita confiança injustificada.',
    objective: 'Use ricochetes longos para carregar o gerador improvisado.',
    rows: [8, 9, 10, 9, 8, 7, 6],
    palette: { top: '#020617', mid: '#0f2857', bottom: '#111827', peg: '#38bdf8', accent: '#f59e0b' },
    gravity: 0.098,
    power: 6.5,
    shots: 11,
  },
  {
    id: 'planeta-eg',
    title: 'Fase 3 — Planeta Eg',
    scene: 'Um mundo verde, industrial, fedido e com cheiro de problema narrativo.',
    objective: 'Abra caminho sem respirar fundo.',
    rows: [8, 10, 11, 10, 9, 8, 7, 6],
    palette: { top: '#03140a', mid: '#365314', bottom: '#111827', peg: '#84cc16', accent: '#fde047' },
    gravity: 0.112,
    power: 6.7,
    shots: 11,
  },
  {
    id: 'fabrica-producao',
    title: 'Fase 4 — Produção Overload',
    scene: 'Tanques blup blup, sirenes, intrusos e pressão intestinal subindo.',
    objective: 'Atinja os pegs de overload para quebrar a produção.',
    rows: [9, 10, 11, 12, 11, 10, 9, 8],
    palette: { top: '#07130b', mid: '#14532d', bottom: '#18181b', peg: '#4ade80', accent: '#ef4444' },
    gravity: 0.118,
    power: 6.6,
    shots: 12,
  },
  {
    id: 'fenda-final',
    title: 'Fase 5 — O Criador da Fenda',
    scene: 'No escuro entre universos, um cientista estranho explica que isso é só o começo.',
    objective: 'Acerte o núcleo vilão e feche o volume 1 com estilo.',
    rows: [9, 11, 12, 13, 12, 11, 10, 9, 7],
    palette: { top: '#030712', mid: '#1a2e05', bottom: '#000000', peg: '#bef264', accent: '#a855f7' },
    gravity: 0.1,
    power: 6.4,
    shots: 13,
  },
];

export const comboNames = [
  'Microbufa registrada',
  'Peidinho eficiente',
  'Bufa encadeada',
  'Combo fedoretto',
  'Catástrofe intestinal quântica',
];
