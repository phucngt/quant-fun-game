import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(HERE + '/../src/logic.js', 'utf8') + '\nthis.QL = QuantLogic;', ctx);
const QL = ctx.QL;
const bars = JSON.parse(fs.readFileSync(HERE + '/../assets/bars.json'));
const scen = JSON.parse(fs.readFileSync(HERE + '/scenarios.json'));
const py = JSON.parse(fs.readFileSync(HERE + '/py_snapshots.json'));
function norm(s) { // strip JS-only fields
  const o = JSON.parse(JSON.stringify(s));
  delete o.blocked;
  o.log = o.log.map(({ role, text, blocked }) => blocked ? { role, text, blocked } : { role, text });
  o.fills = o.fills.map(({ index, ...r }) => r);
  return o;
}
let maxDiff = 0, bad = [], steps = 0;
function cmp(a, b, p) {
  if (typeof a === 'number' && typeof b === 'number') { const d = Math.abs(a - b); maxDiff = Math.max(maxDiff, d); if (d > 1e-9) bad.push(p + ' ' + a + ' vs ' + b); return; }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (a !== b) bad.push(p + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); return; }
  if (Array.isArray(a) !== Array.isArray(b)) { bad.push(p + ' array mismatch'); return; }
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join() !== kb.join()) { bad.push(p + ' keys ' + ka + ' vs ' + kb); return; }
  for (const k of ka) cmp(a[k], b[k], p + '.' + k);
}
function step(desk, name, data, out) {
  try { desk.action(name, data); out.push({ snap: norm(desk.snapshot()) }); return true; }
  catch (e) { out.push({ error: e.message }); return false; }
}
for (const s of scen) {
  const desk = new QL.Desk(bars), out = [{ snap: norm(desk.snapshot()) }];
  for (const op of s.ops) {
    const a = op.a;
    if (a === 'next') for (let i = 0; i < (op.n || 1); i++) step(desk, 'next', {}, out);
    else if (a === 'until_proposal') {
      for (let i = 0; i < 400; i++) {
        if (!step(desk, 'next', {}, out) || desk.proposal) break;
        if (desk.log.length && desk.log[desk.log.length - 1].blocked) break;
      }
    } else if (a === 'auto') {
      for (let i = 0; i < 800; i++) {
        if (desk.proposal) step(desk, op.policy === 'approve' ? 'approve' : 'skip', {}, out);
        else if (!step(desk, 'next', {}, out)) break;
      }
    } else if (a === 'allocation') step(desk, 'allocation', { value: op.v }, out);
    else if (a === 'raw') step(desk, op.name, {}, out);
    else step(desk, a, {}, out);
  }
  const P = py[s.name];
  if (P.length !== out.length) { bad.push(s.name + ' length ' + P.length + ' vs ' + out.length); continue; }
  P.forEach((p, i) => {
    steps++;
    const j = out[i];
    if (('error' in p) !== ('error' in j)) { bad.push(s.name + '#' + i + ' error presence'); return; }
    if (p.error !== undefined) { if (p.error !== j.error) bad.push(s.name + '#' + i + ' msg ' + p.error + ' vs ' + j.error); return; }
    cmp(norm(p.snap), j.snap, s.name + '#' + i);
  });
}
console.log(`scenarios=${scen.length} steps_compared=${steps} max_abs_diff=${maxDiff} mismatches=${bad.length}`);
if (bad.length) { console.log(bad.slice(0, 20).join('\n')); process.exit(1); }
