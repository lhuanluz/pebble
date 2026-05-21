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

> O PDF enviado no Slack não ficou acessível para download pelo Forge. A camada temática está isolada no código para receber nomes, estética, frases e fases do PEIDE assim que o arquivo estiver acessível.

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

1. Importar o conteúdo do `PEIDE VOL 1.pdf` para criar um theme pack real.
2. Separar engine, levels e theme em módulos próprios.
3. Adicionar fases, tela inicial e progressão.
4. Ajustar física/fun factor com playtests curtos.
