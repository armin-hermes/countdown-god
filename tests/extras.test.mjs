// Full-pack extras: keep-awake setting + backup export/import.
// The native plugins are absent in the harness (web), so these tests cover
// the setting persistence, the import validation + restore, and the export
// fallback path — the native share/keep-awake calls are guarded no-ops here.
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

const tick = () => new Promise(r => setTimeout(r, 10));

// ---------- 1: keep-awake checkbox defaults on, persists when toggled ----------
{
  const a = loadApp({});
  assert.strictEqual(a.qs('#keepAwakeChk').checked, true, 'keep-awake defaults to on');
  assert.strictEqual(a.qs('#keepAwakeRow').style.display, 'none', 'keep-awake row hidden on the web');
  const b = loadApp({ 'god.ui.v1': JSON.stringify({ keepAwake: false }) });
  assert.strictEqual(b.qs('#keepAwakeChk').checked, false, 'seeded keepAwake:false shows unchecked');
  const chk = b.qs('#keepAwakeChk');
  chk.checked = true;
  chk.onchange();
  const saved = JSON.parse(b.store.get('god.ui.v1'));
  assert.strictEqual(saved.keepAwake, true, 'toggling the checkbox persists keepAwake:true');
  console.log('Extras 1 OK: keep-awake defaults on, toggle persists');
}

// ---------- 2: export without Blob support fails soft, never throws ----------
{
  const app = loadApp({});
  app.qs('#backupExportBtn').onclick();
  assert.ok(app.qs('#toastBox').innerHTML.includes('پشتیبانی نمی‌کند'), 'export shows a fallback toast, got ' + app.qs('#toastBox').innerHTML);
  console.log('Extras 2 OK: export degrades gracefully without Blob');
}

// ---------- 3: importing a valid backup replaces plan + study ----------
{
  const before = loadApp({
    'god.plan.v1': JSON.stringify([{ wd: '0', subj: 'ریاضی', goal: 10, note: 'قدیمی', done: false, ts: 1 }]),
    'god.study.v1': JSON.stringify([{ subj: 'ریاضی', mins: 5, ts: 1 }]),
  });
  const backup = JSON.stringify({
    app: 'countdown-god', version: 1, exportedAt: '2026-11-16T00:00:00.000Z',
    data: {
      'god.plan.v1': [{ wd: '1', subj: 'فیزیک', goal: 45, note: 'از بک‌آپ', done: false, ts: 2 }],
      'god.study.v1': [{ subj: 'فیزیک', mins: 30, ts: 2 }],
    },
  });
  const fileEl = before.qs('#backupFile');
  fileEl.files = [{ text: () => Promise.resolve(backup) }];
  fileEl.onchange();
  await tick();
  const plan = JSON.parse(before.store.get('god.plan.v1'));
  const study = JSON.parse(before.store.get('god.study.v1'));
  assert.strictEqual(plan.length, 1, 'plan replaced by backup');
  assert.strictEqual(plan[0].subj, 'فیزیک', 'imported plan is the backup one');
  assert.strictEqual(plan[0].note, 'از بک‌آپ', 'imported task note matches');
  assert.strictEqual(study[0].mins, 30, 'imported study log matches');
  assert.ok(before.qs('#toastBox').innerHTML.includes('بازیابی شد'), 'restore toast shown');
  console.log('Extras 3 OK: valid backup import replaces plan + study');
}

// ---------- 4: invalid backup files are rejected, data untouched ----------
{
  const app = loadApp({
    'god.plan.v1': JSON.stringify([{ wd: '0', subj: 'ریاضی', goal: 10, note: 'دست‌نخورده', done: false, ts: 1 }]),
  });
  const fileEl = app.qs('#backupFile');
  fileEl.files = [{ text: () => Promise.resolve('this is not json') }];
  fileEl.onchange();
  await tick();
  assert.ok(app.qs('#toastBox').innerHTML.includes('معتبر نیست'), 'garbage file rejected, got ' + app.qs('#toastBox').innerHTML);
  let plan = JSON.parse(app.store.get('god.plan.v1'));
  assert.strictEqual(plan[0].note, 'دست‌نخورده', 'garbage import left data untouched');

  fileEl.files = [{ text: () => Promise.resolve(JSON.stringify({ app: 'something-else', data: {} })) }];
  fileEl.onchange();
  await tick();
  assert.ok(app.qs('#toastBox').innerHTML.includes('ساعت مطالعه نیست'), 'wrong-app file rejected, got ' + app.qs('#toastBox').innerHTML);
  plan = JSON.parse(app.store.get('god.plan.v1'));
  assert.strictEqual(plan[0].note, 'دست‌نخورده', 'wrong-app import left data untouched');
  console.log('Extras 4 OK: invalid backups rejected, data untouched');
}

console.log('ALL EXTRAS TESTS PASSED');
