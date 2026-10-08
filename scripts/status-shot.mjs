// Screenshots an HTML file at phone width (400px, dark) and crops to the .w widget. Needs the playwright package (not a dependency of this app) and a Chromium: CHROMIUM_PATH, else /opt/pw-browsers/chromium, else playwright's own browser.
//   node scripts/status-shot.mjs <abs/in.html> <out.png>
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
let pw; try { pw = req('playwright'); } catch { try { pw = req('@playwright/test'); } catch { console.error('status-shot: playwright is not installed here; send the artifact link instead of an image.'); process.exit(1); } }
const [,, inp, outp] = process.argv;
const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await pw.chromium.launch(exe ? { executablePath: exe } : {}).catch(e => { console.error('status-shot: cannot start Chromium (' + e.message.split('\n')[0] + '); send the artifact link instead of an image.'); process.exit(1); });
const p = await b.newPage({ viewport: { width: 400, height: 2000 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await p.goto('file://' + inp);
const h = await p.evaluate(() => Math.ceil(document.querySelector(".w").getBoundingClientRect().bottom) + 12);
await p.screenshot({ path: outp, clip: { x: 0, y: 0, width: 400, height: h } });
await b.close();
