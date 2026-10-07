// Writes a one-page status widget (device, memory, model, context window, last request, repo) as HTML.
//   node scripts/status-widget.mjs --out <file.html> [--model <name>] [--ctx-used <tokens>] [--ctx-total <tokens>]
//        [--fragment] [--calls <n>] [--input <tokens>] [--output <tokens>] [--cache <tokens>]
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

// Numbers and units stay left-to-right inside the right-to-left page, so "0.4 / 15.7 GB" and "25K / 15M" read in order.
const ltr = s => `<span class="n">${esc(s)}</span>`;
const level = p => (p >= 90 ? 'crit' : p >= 70 ? 'warn' : 'ok');
const bar = p => `<div class="bar ${level(p)}"><i style="width:${Math.max(p, p > 0 ? 1.5 : 0).toFixed(1)}%"></i></div>`;
const meter = (label, p, detail) => `<div class="meter"><div class="row"><span>${label}</span><span class="big ${level(p)}">${ltr(p.toFixed(1) + '%')}</span></div>${bar(p)}<div class="mut">${detail}</div></div>`;
const tile = (k, v) => `<div class="tile"><span class="mut">${esc(k)}</span><b>${ltr(v)}</b></div>`;

const memPct = pct(memUsed, mem.MemTotal), diskPct = pct(diskUsed, diskTotal);
const now = new Date().toISOString().slice(11, 16) + ' UTC';

// --fragment: no doctype/html/head/body, for publishing as a claude.ai Artifact (the host adds the skeleton).
const fragment = args.includes('--fragment');
const head = fragment ? '' : '<!doctype html>\n<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n';
writeFileSync(out, `${head}<title>حالة الجلسة</title>
<style>
:root{--bg:#0e0f12;--card:#17181c;--line:#2a2c32;--fg:#f2f3f5;--mut:#9094a0;--acc:#4b7bec;--ok:#3ddc97;--warn:#f5a524;--crit:#ff6b6b;color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f4f5f7;--card:#fff;--line:#dcdee3;--fg:#15161a;--mut:#5f636e;--acc:#2f5fd0;--ok:#0f8f5b;--warn:#a85f00;--crit:#c62828;color-scheme:light}}
:root[data-theme="light"]{--bg:#f4f5f7;--card:#fff;--line:#dcdee3;--fg:#15161a;--mut:#5f636e;--acc:#2f5fd0;--ok:#0f8f5b;--warn:#a85f00;--crit:#c62828;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,"Segoe UI",Tahoma,sans-serif;padding:16px}
.w{max-width:680px;margin:0 auto;display:grid;gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;min-width:0}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
h1{font-size:18px;margin:0}.mut{color:var(--mut);font-size:13px}.big{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.n{direction:ltr;unicode-bidi:isolate;display:inline-block;font-variant-numeric:tabular-nums}
.bar{height:8px;border-radius:8px;background:var(--line);overflow:hidden;margin:6px 0 4px}.bar i{display:block;height:100%;border-radius:8px;background:var(--acc)}
.bar.warn i{background:var(--warn)}.bar.crit i{background:var(--crit)}
.big.warn{color:var(--warn)}.big.crit{color:var(--crit)}
.meter+.meter{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.tag{font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 8px;color:var(--mut);white-space:nowrap}.tag.ok{color:var(--ok);border-color:var(--ok)}.tag.warn{color:var(--warn);border-color:var(--warn)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.two .big{font-size:18px;overflow-wrap:anywhere}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.tile{display:flex;flex-direction:column;gap:2px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;min-width:0}.tile b{font-size:17px}
@media(max-width:380px){.tiles{grid-template-columns:repeat(2,1fr)}}
</style>${fragment ? '' : '</head><body>'}<div class="w" dir="rtl">
<div class="card"><div class="row"><h1>حالة الجلسة</h1><span class="tag">حاوية سحابية · ${n} أنوية · ${ltr(now)}</span></div>
<div class="mut" style="margin:2px 0 14px">${ltr(type() + ' ' + release() + ' · ' + arch())}</div>
${meter('المعالج (متوسط الحمل)', cpuPct, '')}
${meter(`الذاكرة <span class="tag ${level(memPct)}">متاحة ${(100 - memPct).toFixed(0)}%</span>`, memPct, ltr(`${gb(memUsed)} / ${gb(mem.MemTotal)}`))}
${meter('القرص', diskPct, ltr(`${gb(diskUsed)} / ${gb(diskTotal)}`))}</div>
<div class="two">
<div class="card"><div class="mut">النموذج الحالي</div><div class="big">${ltr(model)}</div></div>
<div class="card"><div class="mut">Node</div><div class="big">${ltr(process.version)}</div></div></div>
<div class="card">${meter('توكنز الجلسة المستهلكة', ctxPct ?? 0, ltr(`${tok(ctxUsed)} / ${tok(ctxTotal)}`))}</div>
<div class="card"><span class="mut">الطلب السابق</span><div class="tiles">${tile('نداءات', tok(num(arg('calls'))))}${tile('مخزن', tok(num(arg('cache'))))}${tile('إدخال', tok(num(arg('input'))))}${tile('مخرج', tok(num(arg('output'))))}</div></div>
<div class="card"><div class="row"><span><b>${ltr(pkg.name)}</b> <span class="tag">${ltr('v' + pkg.version)}</span> <span class="tag ${dirty ? 'warn' : 'ok'}">${dirty ? `${dirty} ملفات معدّلة` : 'مستقر'}</span></span><span class="mut">${ltr(branch)}</span></div>
<div class="mut" style="margin-top:6px">${ltr(last)}</div></div>
</div>${fragment ? '' : '</body></html>'}
`);
console.log(`wrote ${out}`);
