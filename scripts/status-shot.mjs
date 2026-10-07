// Screenshots an HTML file at phone width (400px, dark) and crops to the .w widget. Needs playwright and Chromium at /opt/pw-browsers/chromium.
//   node scripts/status-shot.mjs <abs/in.html> <out.png>
import { createRequire } from 'node:module';
const req = createRequire(process.cwd() + '/');
let pw; try { pw = req('playwright'); } catch { pw = req('@playwright/test'); }
const [,, inp, outp] = process.argv;
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 400, height: 640 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await p.goto('file://' + inp);
const h = await p.evaluate(() => Math.ceil(document.querySelector(".w").getBoundingClientRect().bottom) + 12);
await p.screenshot({ path: outp, clip: { x: 0, y: 0, width: 400, height: Math.min(h, 640) } });
await b.close();
