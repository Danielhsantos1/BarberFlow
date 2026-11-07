// Renderiza composition.html quadro a quadro (30 fps, 1080x1920) e envia para o ffmpeg.
// Uso: node scripts/render.cjs <saida-video-sem-audio.mp4>
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const out = process.argv[2] || path.join(root, 'video-noaudio.mp4');
  const FPS = 30;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto('file://' + path.join(root, 'composition.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const duration = await page.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('ok', out);
})();
