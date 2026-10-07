// Writes a one-page status widget (device, memory, model, context window, last request, repo) as HTML.
//   node scripts/status-widget.mjs --out <file.html> [--model <name>] [--ctx-used <tokens>] [--ctx-total <tokens>]
//        [--calls <n>] [--input <tokens>] [--output <tokens>] [--cache <tokens>]
// Device, memory, disk and repo are read live; the model, context and request numbers can only come from the
// caller, and show "—" when left out. Claude prints it when the user types "جججج" (see CLAUDE.md).
import { writeFileSync, readFileSync } from 'node:fs';
import { cpus, type, release, arch, loadavg } from 'node:os';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const out = arg('out');
if (!out) { console.error('usage: status-widget.mjs --out <file.html> [options]'); process.exit(2); }

const run = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => (v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const tok = n => (n === null ? '—' : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(n));
const gb = kb => `${(kb / 1048576).toFixed(1)} GB`;
const pct = (a, b) => (b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0);

const n = cpus().length;
const cpuPct = Math.min(100, (loadavg()[0] / n) * 100);
const mem = Object.fromEntries(readFileSync('/proc/meminfo', 'utf8').split('\n').filter(Boolean).map(l => { const [k, v] = l.split(':'); return [k, parseInt(v, 10)]; }));
const memUsed = mem.MemTotal - mem.MemAvailable;
const disk = run('df', ['-Pk', '/home']).split('\n')[1]?.split(/\s+/) || [];
const diskTotal = Number(disk[1]) || 0, diskUsed = Number(disk[2]) || 0;

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const branch = run('git', ['branch', '--show-current']) || '—';
const dirty = run('git', ['status', '--short']).split('\n').filter(Boolean).length;
const last = run('git', ['log', '-1', '--format=%h · %s']);

const ctxUsed = num(arg('ctx-used')), ctxTotal = num(arg('ctx-total'));
const ctxPct = ctxUsed !== null && ctxTotal ? pct(ctxUsed, ctxTotal) : null;
const model = arg('model') || '—';

const bar = p => `<div class="bar"><i style="width:${p.toFixed(1)}%"></i></div>`;
const chip = (k, v) => `<span class="chip">${esc(k)}: <b>${esc(v)}</b></span>`;

writeFileSync(out, `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>حالة الجلسة</title>
<style>
:root{--bg:#0e0f12;--card:#17181c;--line:#26272c;--fg:#f2f3f5;--mut:#8b8e97;--acc:#4b7bec;--ok:#3ddc97;--warn:#f5a524}
@media (prefers-color-scheme:light){:root{--bg:#f4f5f7;--card:#fff;--line:#dcdee3;--fg:#15161a;--mut:#656873;--acc:#2f5fd0;--ok:#0f8f5b;--warn:#b26a00}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,"Segoe UI",Tahoma,sans-serif;padding:16px}
.w{max-width:680px;margin:0 auto;display:grid;gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
h1{font-size:17px;margin:0}.mut{color:var(--mut);font-size:13px}.big{font-size:20px;font-weight:700}
.bar{height:8px;border-radius:8px;background:var(--line);overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;background:var(--acc);border-radius:8px}
.tag{font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 8px;color:var(--mut)}.ok{color:var(--ok);border-color:var(--ok)}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{border:1px solid var(--line);border-radius:8px;padding:6px 12px;font-size:14px}.chip b{font-size:16px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:520px){.two{grid-template-columns:1fr}}
</style></head><body><div class="w">
<div class="card"><div class="row"><h1>${esc(type())} ${esc(release())} · ${esc(arch())}</h1><span class="mut">حاوية سحابية · ${n} أنوية</span></div>
<div class="row" style="margin-top:8px"><span class="mut">المعالج (متوسط الحمل)</span><span class="big">${cpuPct.toFixed(1)}%</span></div>${bar(cpuPct)}
<div class="row" style="margin-top:14px"><span>الذاكرة: <span class="tag ok">متاحة ${(100 - pct(memUsed, mem.MemTotal)).toFixed(0)}%</span></span><span class="mut">${gb(memUsed)} من ${gb(mem.MemTotal)}</span></div>${bar(pct(memUsed, mem.MemTotal))}
<div class="row" style="margin-top:14px"><span>القرص</span><span class="mut">${gb(diskUsed)} من ${gb(diskTotal)}</span></div>${bar(pct(diskUsed, diskTotal))}</div>
<div class="two">
<div class="card"><div class="mut">النموذج الحالي</div><div class="big">${esc(model)}</div></div>
<div class="card"><div class="mut">Node</div><div class="big">${esc(process.version)}</div></div></div>
<div class="card"><div class="row"><span>توكنز الجلسة المستهلكة${ctxPct === null ? '' : `: <b>${ctxPct.toFixed(1)}%</b>`}</span><span class="mut">${tok(ctxUsed)} من ${tok(ctxTotal)}</span></div>${bar(ctxPct ?? 0)}</div>
<div class="card"><div class="row"><span class="mut">الطلب السابق</span><div class="chips">${chip('نداءات', tok(num(arg('calls'))))}${chip('مخزن', tok(num(arg('cache'))))}${chip('إدخال', tok(num(arg('input'))))}${chip('مخرج', tok(num(arg('output'))))}</div></div></div>
<div class="card"><div class="row"><span>المستودع: <b>${esc(pkg.name)}</b> <span class="tag">v${esc(pkg.version)}</span> <span class="tag ${dirty ? '' : 'ok'}">${dirty ? `${dirty} ملفات معدلة` : 'مستقر'}</span></span><span class="mut" dir="ltr">${esc(branch)}</span></div>
<div class="mut" dir="ltr" style="margin-top:6px">${esc(last)}</div></div>
</div></body></html>
`);
console.log(`wrote ${out}`);
