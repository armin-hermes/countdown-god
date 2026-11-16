// Session persistence: the timer survives the app being closed/killed.
// A running session is saved with timestamps (endAt/startStamp/otStart),
// so on reload the remaining time is recomputed from the real clock.
import assert from 'node:assert';
import { loadApp, fa } from './harness.mjs';

const now = Date.now();
function sess(o) {
  return JSON.stringify(Object.assign(
    { mode: 'focus', subj: 'ریاضی', total: 1500, remain: 1500, running: false,
      endAt: 0, startStamp: 0, elapsed0: 0, overtime: false, ot0: 0, otStart: 0,
      savedAt: now - 1000 }, o));
}

// ---------- A: running focus session resumes with the real remaining time ----------
{
  const app = loadApp({ 'god.session.v1': sess({ running: true, endAt: now + 20 * 60 * 1000 - 500 }) });
  assert.strictEqual(app.qs('#clock').textContent, '20:00', 'restored countdown at 20:00, got ' + app.qs('#clock').textContent);
  assert.strictEqual(app.qs('#state').textContent, 'در حال تمرکز', 'restored session is running');
  app.advance(60 * 1000); app.pump();
  assert.strictEqual(app.qs('#clock').textContent, '19:00', 'restored timer keeps counting down, got ' + app.qs('#clock').textContent);
  console.log('Scenario A OK: running focus session restored at 20:00, counts down');
}

// ---------- B: focus ended while away -> overtime from the real zero moment ----------
{
  const app = loadApp({ 'god.session.v1': sess({ running: true, endAt: now - 3 * 60 * 1000 + 500 }) });
  assert.strictEqual(app.qs('#clock').textContent, '+03:00', 'overtime restored at +03:00, got ' + app.qs('#clock').textContent);
  assert.strictEqual(app.qs('#state').textContent, 'اضافه‌کار', 'overtime state restored');
  app.qs('#btnStart').onclick(); // end session
  const slog = JSON.parse(app.store.get('god.study.v1') || '[]');
  assert.ok(slog.length === 1 && slog[0].subj === 'ریاضی' && slog[0].mins === 28, 'session logged as 25+3=28 min, got ' + JSON.stringify(slog));
  console.log('Scenario B OK: focus ended away -> +03:00 overtime -> end logs 28 min');
}

// ---------- C: break ended while away -> back to a fresh focus timer, nothing logged ----------
{
  const app = loadApp({ 'god.session.v1': sess({ mode: 'break', total: 300, remain: 300, running: true, endAt: now - 60 * 1000 }) });
  assert.strictEqual(app.qs('#clock').textContent, '25:00', 'fresh focus countdown after break ended away, got ' + app.qs('#clock').textContent);
  assert.strictEqual(app.qs('#faceSubj').textContent, 'ریاضی', 'subject restored, not break label');
  const slog = JSON.parse(app.store.get('god.study.v1') || '[]');
  assert.strictEqual(slog.length, 0, 'no phantom minutes logged for the missed break');
  console.log('Scenario C OK: break ended away -> fresh 25:00 focus, nothing logged');
}

// ---------- D: session abandoned >12h ago is dropped, never logs phantom minutes ----------
{
  const app = loadApp({ 'god.session.v1': sess({ running: true, endAt: now - 2 * 864e5, savedAt: now - 2 * 864e5 }) });
  assert.strictEqual(app.qs('#clock').textContent, '25:00', 'stale session dropped -> fresh timer, got ' + app.qs('#clock').textContent);
  const slog = JSON.parse(app.store.get('god.study.v1') || '[]');
  assert.strictEqual(slog.length, 0, 'stale session logged nothing');
  const saved = JSON.parse(app.store.get('god.session.v1'));
  assert.strictEqual(saved.running, false, 'fresh state saved after dropping the stale session');
  console.log('Scenario D OK: >12h stale session dropped, fresh timer, nothing logged');
}

// ---------- E: pause persists; reload shows the paused timer ----------
{
  const a = loadApp({ 'god.study.v1': '[]' });
  a.qs('#btnStart').onclick();
  a.advance(5 * 60 * 1000); a.pump();
  a.qs('#btnPause').onclick();
  const saved = JSON.parse(a.store.get('god.session.v1'));
  assert.strictEqual(saved.running, false, 'paused session saved as not running');
  assert.ok(Math.abs(saved.remain - 1200) < 2, 'paused remain ~1200s, got ' + saved.remain);
  const b = loadApp(Object.fromEntries(a.store));
  assert.strictEqual(b.qs('#clock').textContent, '20:00', 'paused timer restored at 20:00, got ' + b.qs('#clock').textContent);
  assert.strictEqual(b.qs('#state').textContent, 'مکث', 'restored state is paused');
  console.log('Scenario E OK: pause -> reload restores paused 20:00');
}

// ---------- F: running session round-trip through a reload ----------
{
  const a = loadApp({ 'god.study.v1': '[]' });
  a.qs('#btnStart').onclick();
  a.advance(5 * 60 * 1000); a.pump();
  const b = loadApp(Object.fromEntries(a.store));
  b.advance(5 * 60 * 1000); b.pump(); // harness clock resets on reload; re-advance the same 5 min
  assert.strictEqual(b.qs('#clock').textContent, '20:00', 'running session survives reload at 20:00, got ' + b.qs('#clock').textContent);
  b.advance(60 * 1000); b.pump();
  assert.strictEqual(b.qs('#clock').textContent, '19:00', 'still counting after reload, got ' + b.qs('#clock').textContent);
  console.log('Scenario F OK: running session survives reload, keeps counting');
}

// ---------- G: free stopwatch running restores from its start timestamp ----------
{
  const app = loadApp({ 'god.session.v1': sess({ mode: 'free', total: 0, remain: 0, running: true, startStamp: now - 10 * 60 * 1000 + 500 }) });
  assert.strictEqual(app.qs('#clock').textContent, '10:00', 'stopwatch restored at 10:00, got ' + app.qs('#clock').textContent);
  app.advance(60 * 1000); app.pump();
  assert.strictEqual(app.qs('#clock').textContent, '11:00', 'stopwatch keeps counting up, got ' + app.qs('#clock').textContent);
  console.log('Scenario G OK: free stopwatch restored at 10:00, counts up');
}

// ---------- H: paused overtime restores as-is ----------
{
  const app = loadApp({ 'god.session.v1': sess({ running: false, overtime: true, ot0: 300 }) });
  assert.strictEqual(app.qs('#clock').textContent, '+05:00', 'paused overtime restored at +05:00, got ' + app.qs('#clock').textContent);
  console.log('Scenario H OK: paused overtime restored at +05:00');
}

console.log('ALL SESSION TESTS PASSED');
