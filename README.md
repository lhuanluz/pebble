# Pebble

Um protótipo web arcade inspirado em *Peggle*, com tema planejado para o material `PEIDE VOL 1.pdf`.

## Status

MVP inicial jogável:

- Mira com mouse
- Disparo com click ou espaço
- Física simples com gravidade/ricochete
- Pegs por tipo (`story`, `spark`, `anchor`)
- Pontuação, tiros restantes e alvos restantes
- Reset com `R`

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

1. Separar engine, levels e theme em módulos próprios.
2. Adicionar fases, tela inicial e progressão.
3. Criar arte própria inspirada no clima do PEIDE sem depender do PDF bruto.
4. Ajustar física/fun factor com playtests curtos.
