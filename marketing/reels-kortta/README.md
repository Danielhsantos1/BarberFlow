# Reels do Kortta (9:16 · 1080×1920 · 38 s)

Vídeo publicitário gerado por código: uma composição HTML animada quadro a quadro
(`composition.html`), capturada com Playwright e encodada com ffmpeg. As telas usadas
são capturas reais do sistema (`assets/`) e a landing page é recriada a partir do
código real de `artifacts/barberflow/src/App.tsx`.

| Arquivo | O que é |
| --- | --- |
| `kortta-reels.mp4` | Vídeo final (trilha + legendas embutidas, sem locução) |
| `legendas.srt` | Legendas com os tempos da narração |
| `roteiro-locucao.md` | Roteiro de voz com marcações de tempo para gravar a locução |
| `composition.html` | A animação (abra no navegador e chame `render(t)` para inspecionar um instante) |
| `scripts/music.py` | Trilha sintetizada (numpy), sincronizada com os cortes |
| `scripts/render.cjs` | Renderiza os 1140 quadros e gera o MP4 sem áudio |
| `scripts/preview.cjs` | Gera quadros soltos para conferência: `node scripts/preview.cjs <pasta> 1.5 13 29` |

## Gerar de novo

```bash
cd marketing/reels-kortta
python3 scripts/music.py music.wav
node scripts/render.cjs noaudio.mp4
ffmpeg -i noaudio.mp4 -i music.wav -c:v copy -c:a aac -b:a 192k -af loudnorm=I=-14:TP=-1.5 -shortest -movflags +faststart kortta-reels.mp4
```

Requer Node com Playwright/Chromium, Python 3 com numpy e scipy, e ffmpeg.

## Adicionar a locução depois de gravada

Grave seguindo `roteiro-locucao.md` (um arquivo `locucao.wav` começando em 0 s) e misture
com a trilha abaixada (“ducking”):

```bash
ffmpeg -i kortta-reels.mp4 -i locucao.wav -filter_complex "[0:a]volume=0.35[m];[m][1:a]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k kortta-reels-com-voz.mp4
```
