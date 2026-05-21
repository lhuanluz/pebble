# Pebble

Um protótipo web arcade inspirado em *Peggle*, com tema planejado para o material `PEIDE VOL 1.pdf`.

## Status

Protótipo jogável evoluído:

- Mira com mouse/toque
- Disparo com click ou espaço
- Física lenta estilo Peggle, com ricochete controlado
- Cinco fases inspiradas no PEIDE: quarto gamer, Bolão, Planeta Eg, fábrica e fenda final
- Personagens selecionáveis: Diego, Digueu, Felipinho, Bolão e Criador, agora com retratos estilizados em canvas
- Pegs por tipo (`story`, `spark`, `anchor`, `villain`, `multiball`, `slowmo`, `bumper`)
- Power-ups: multibola, câmera lenta, bumpers, fever mode, bucket/bueiro com bônus de tiro
- Física mais arcade: ricochetes de bumper, shake de impacto, rastro da bola e slow-motion em jogadas fortes
- Som procedural de peido por impacto/combo
- Partículas de gás, pontuação flutuante, badges locais, high score local e tela de resultado
- Pontuação, tiros, fase, personagem, recorde e alvos restantes
- Reset com `R`

Deploy: https://pebble-ten.vercel.app

> O PDF de referência foi usado apenas localmente para orientar a direção visual/textual. O arquivo fonte e renders extraídos não são versionados no repo público.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Próximos passos

1. Criar sprites/arte própria para personagens e pegs especiais.
2. Adicionar persistência de high score local.
3. Balancear quantidade de tiros/fases com playtests.
4. Evoluir para fases com obstáculos reais, não só pegs.
