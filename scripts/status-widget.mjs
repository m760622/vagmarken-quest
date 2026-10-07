// Writes a one-page status widget (device, memory, model, context window, last request, repo) as HTML.
//   node scripts/status-widget.mjs --out <file.html> [--model <name>] [--ctx-used <tokens>] [--ctx-total <tokens>]
//        [--fragment] [--ctx-window <tokens> --ctx-now <tokens>] [--calls <n>] [--input <tokens>] [--output <tokens>] [--cache <tokens>]
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
// In a container /proc/meminfo describes the host, so prefer the cgroup limit and usage (v2, then v1) when they are lower.
const readNum = f => { try { const t = readFileSync(f, 'utf8').trim(); return /^\d+$/.test(t) ? Number(t) : null; } catch { return null; } };
const stat = f => { try { return Object.fromEntries(readFileSync(f, 'utf8').trim().split('\n').map(l => l.split(' '))); } catch { return {}; } };
const cg = [['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory.stat', 'inactive_file'],
  ['/sys/fs/cgroup/memory/memory.limit_in_bytes', '/sys/fs/cgroup/memory/memory.usage_in_bytes', '/sys/fs/cgroup/memory/memory.stat', 'total_inactive_file']]
  .map(([lim, cur, st, key]) => ({ lim: readNum(lim), cur: readNum(cur), cache: Number(stat(st)[key] || 0) / 1024 }))
  .find(c => c.lim !== null && c.cur !== null && c.lim / 1024 < mem.MemTotal);
if (cg) { mem.MemTotal = cg.lim / 1024; mem.MemAvailable = Math.max(0, mem.MemTotal - Math.max(0, cg.cur / 1024 - cg.cache)); }
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
const levelText = { ok: 'طبيعي', warn: 'مرتفع', crit: 'حرج' };
const level = p => (p >= 90 ? 'crit' : p >= 70 ? 'warn' : 'ok');
const bar = (p, c) => `<div class="bar ${level(p)}" style="--c:var(--c-${c})"><i style="width:${Math.max(p, p > 0 ? 1.5 : 0).toFixed(1)}%"></i></div>`;
const meter = (label, p, detail, c) => p === null
  ? `<div class="meter"><div class="row"><span>${label}</span><span class="tag">غير معروف</span></div><div class="mut">${detail}</div></div>`
  : `<div class="meter"><div class="row"><span>${label}</span><b class="v ${level(p)}">${ltr(p.toFixed(1) + '%')}</b></div>${bar(p, c)}<div class="mut"><span class="lv ${level(p)}">${levelText[level(p)]}</span>${detail ? ' ' + detail : ''}</div></div>`;
const tile = (k, v) => `<div class="tile"><span class="mut">${esc(k)}</span><b>${ltr(v)}</b></div>`;

const memPct = pct(memUsed, mem.MemTotal), diskPct = pct(diskUsed, diskTotal);
const today = new Date();
const TZ = 'Europe/Stockholm'; // Swedish time (CET/CEST)
const now = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ, timeZoneName: 'short' });
const dateAr = today.toLocaleDateString('ar-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: TZ });
const claudeMd = (() => { try { const t = readFileSync('CLAUDE.md', 'utf8'); return { lines: t.split('\n').length, tokens: Math.round(Buffer.byteLength(t) / 4) }; } catch { return null; } })();
const ctxWin = num(arg('ctx-window')), ctxNow = num(arg('ctx-now'));
const ctxNowPct = ctxWin && ctxNow !== null ? pct(ctxNow, ctxWin) : null;

// --fragment: no doctype/html/head/body, for publishing as a claude.ai Artifact (the host adds the skeleton).
const fragment = args.includes('--fragment');
const head = fragment ? '' : '<!doctype html>\n<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n';
writeFileSync(out, `${head}<title>حالة الجلسة</title>
<style>
:root{--bg:#0e0f12;--card:#17181c;--line:#2a2c32;--fg:#f2f3f5;--mut:#9094a0;--acc:#4b7bec;--ok:#3ddc97;--warn:#f5a524;--crit:#ff6b6b;--c-cpu:#5b8def;--c-mem:#a78bfa;--c-disk:#2dd4bf;--c-tok:#fbbf24;--c-model:#f472b6;--c-node:#84cc16;--c-req:#fb923c;--c-repo:#38bdf8;color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f4f5f7;--card:#fff;--line:#dcdee3;--fg:#15161a;--mut:#5f636e;--acc:#2f5fd0;--ok:#0f8f5b;--warn:#a85f00;--crit:#c62828;--c-cpu:#2f5fd0;--c-mem:#7c3aed;--c-disk:#0d9488;--c-tok:#b45309;--c-model:#be185d;--c-node:#4d7c0f;--c-req:#c2410c;--c-repo:#0369a1;color-scheme:light}}
:root[data-theme="light"]{--bg:#f4f5f7;--card:#fff;--line:#dcdee3;--fg:#15161a;--mut:#5f636e;--acc:#2f5fd0;--ok:#0f8f5b;--warn:#a85f00;--crit:#c62828;--c-cpu:#2f5fd0;--c-mem:#7c3aed;--c-disk:#0d9488;--c-tok:#b45309;--c-model:#be185d;--c-node:#4d7c0f;--c-req:#c2410c;--c-repo:#0369a1;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,"Segoe UI",Tahoma,sans-serif;padding:12px 16px}
.w{max-width:680px;margin:0 auto;display:grid;gap:8px}
.card{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--c,var(--acc));border-radius:12px;padding:8px 12px;min-width:0}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
h1{font-size:16px;margin:0}.mut{color:var(--mut);font-size:12px}.v{font-size:15px}
.n{direction:ltr;unicode-bidi:isolate;display:inline-block;font-variant-numeric:tabular-nums}
.bar{height:6px;border-radius:6px;background:var(--line);overflow:hidden;margin:3px 0 2px}.bar i{display:block;height:100%;border-radius:6px;background:var(--c,var(--acc))}
.bar.warn i{background:var(--warn)}.bar.crit i{background:var(--crit)}
.v.warn,.lv.warn{color:var(--warn)}.v.crit,.lv.crit{color:var(--crit)}.lv.ok{color:var(--ok)}.lv{font-weight:600;margin-inline-end:6px}
.foot{text-align:center;line-height:1.7;padding:2px 4px}
.tag{font-size:11px;border:1px solid var(--line);border-radius:6px;padding:0 6px;color:var(--mut);white-space:nowrap}.tag.ok{color:var(--ok);border-color:var(--ok)}.tag.warn{color:var(--warn);border-color:var(--warn)}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:6px}.three .mut{font-size:11px}
.k{color:var(--c);font-weight:700}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:4px}.tile{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:8px;padding:2px 8px;min-width:0}.tile b{font-size:14px}
@media(max-width:380px){.tiles{grid-template-columns:repeat(2,1fr)}}
</style>${fragment ? '' : '</head><body>'}<div class="w" dir="rtl">
<div class="card"><div class="row"><h1>حالة الجلسة</h1><span class="mut">${esc(dateAr)} · ${ltr(now)} (السويد)</span></div>
<div class="row"><span class="mut">${ltr(type() + ' ' + release() + ' · ' + arch())}</span><span class="tag">حاوية سحابية · ${n} أنوية</span></div>
<div class="three">
${meter('المعالج', cpuPct, 'متوسط الحمل', 'cpu')}
${meter('الذاكرة', memPct, ltr(`${gb(memUsed)} / ${gb(mem.MemTotal)}`), 'mem')}
${meter('القرص', diskPct, ltr(`${gb(diskUsed)} / ${gb(diskTotal)}`), 'disk')}</div></div>
<div class="card" style="--c:var(--c-tok)">${meter('توكنز الجلسة', ctxPct, `${ltr(`${tok(ctxUsed)} / ${tok(ctxTotal)}`)} · ${ctxNowPct === null ? 'نافذة السياق: غير متاحة لي' : `نافذة السياق ${ltr(`${tok(ctxNow)} / ${tok(ctxWin)}`)} (${ltr(ctxNowPct.toFixed(1) + '%')})`}${claudeMd ? ` · CLAUDE.md ${`${claudeMd.lines} سطرًا ≈ ${ltr(tok(claudeMd.tokens))}`}` : ''}`, 'tok')}</div>
<div class="card" style="--c:var(--c-model)"><div class="row"><span><span class="mut">النموذج</span> <b class="k" style="--c:var(--c-model)">${ltr(model)}</b></span><span><span class="mut">Node</span> <b class="k" style="--c:var(--c-node)">${ltr(process.version)}</b></span></div></div>
<div class="card" style="--c:var(--c-req)"><span class="mut">الطلب السابق</span><div class="tiles">${tile('نداءات', tok(num(arg('calls'))))}${tile('مخزن', tok(num(arg('cache'))))}${tile('إدخال', tok(num(arg('input'))))}${tile('مخرج', tok(num(arg('output'))))}</div></div>
<div class="card" style="--c:var(--c-repo)"><div class="row"><span><b>${ltr(pkg.name)}</b> <span class="tag">${ltr('v' + pkg.version)}</span> <span class="tag ${dirty ? 'warn' : 'ok'}">${dirty ? `${dirty} ملفات معدّلة` : 'مستقر'}</span></span><span class="mut">${ltr(branch)}</span></div>
<div class="mut">${ltr(last)}</div></div>
<div class="mut foot">لقطة وقت التوليد ${ltr(now)} (السويد) · لا تحديث تلقائي، اكتب «جججج» لتحديثها<br>— تعني أن القياس غير متاح لي</div>
</div>${fragment ? '' : '</body></html>'}
`);
console.log(`wrote ${out}`);
