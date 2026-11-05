import assert from 'node:assert';
import { loadApp, fa } from './harness.mjs';

const now = Date.now();
const wdToday = String(new Date().getDay());
const wdTomorrow = String(new Date(Date.now()+864e5).getDay());

// ---------- Scenario 1: pre-seeded study + multi-task plan ----------
{
  const plan = [
    {wd:wdToday, day:'', subj:'ریاضی', goal:30, note:'درسنامه فصل ۳', done:false, ts:now-3000},
    {wd:wdToday, day:'', subj:'ریاضی', goal:40, note:'تست‌زنی', done:false, ts:now-2000},
    {wd:wdToday, day:'', subj:'فیزیک', goal:60, note:'فصل ۱', done:false, ts:now-1000},
    {wd:wdTomorrow, day:'', subj:'ریاضی', goal:90, note:'برنامه فردا', done:false, ts:now-500},
  ];
  const study = [ {subj:'ریاضی', mins:50, ts:now}, {subj:'فیزیک', mins:20, ts:now} ];
  const { qs, store } = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': JSON.stringify(study) });
  const list = qs('#planList').innerHTML;
  assert.ok(list.includes(fa(30)+' از '+fa(30)), 'task1 fully deducted (30/30)');
  assert.ok(list.includes('کامل شد'), 'task1 marked complete');
  assert.ok(list.includes(fa(20)+' از '+fa(40)), 'task2 gets overflow 20/40 (FIFO)');
  assert.ok(list.includes(fa(20)+' دقیقه مانده'), 'task2 shows 20 min remaining');
  assert.ok(list.includes(fa(20)+' از '+fa(60)), 'physics syncs independently (20/60)');
  assert.ok(list.includes(fa(0)+' از '+fa(90)), "tomorrow's task untouched by today's study");
  assert.ok(list.includes(fa(50)+' از '+fa(70)), 'math group header: 50 of 70');
  const sync = qs('#planSyncInfo').innerHTML;
  assert.ok(sync.includes(fa(70)+' دقیقه مطالعه'), 'sync box shows today total 70');
  assert.strictEqual(qs('#succPct').textContent, fa(32)+'%', 'weekly success is minute-based: 70/220 = 32%');

  // add a 3rd math task for today -> allowed (multi-task), gets 0 (pool exhausted)
  qs('#planDay').value = wdToday; qs('#planSubj').value='ریاضی'; qs('#planMins').value='25'; qs('#planNote').value='مرور';
  qs('#planAdd').onclick();
  let saved = JSON.parse(store.get('god.plan.v1'));
  assert.strictEqual(saved.length, 5, 'third math task for same day added');
  assert.ok(qs('#planList').innerHTML.includes('مرور'), 'new task rendered');
  assert.ok(qs('#planList').innerHTML.includes(fa(0)+' از '+fa(25)), 'third task gets remaining pool 0');

  // exact duplicate blocked
  qs('#planDay').value = wdToday; qs('#planSubj').value='ریاضی'; qs('#planMins').value='25'; qs('#planNote').value='مرور';
  qs('#planAdd').onclick();
  saved = JSON.parse(store.get('god.plan.v1'));
  assert.strictEqual(saved.length, 5, 'exact duplicate task blocked');
  console.log('Scenario 1 OK: multi-task + FIFO deduction + remaining + weekly %');
}

// ---------- Scenario 2: real timer finish feeds the plan ----------
{
  const plan = [ {wd:wdToday, day:'', subj:'ریاضی', goal:30, note:'جلسه امروز', done:false, ts:now-1000} ];
  const app = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': '[]' });
  const { qs, store } = app;
  qs('#btnStart').onclick();              // start 25-min focus on ریاضی (default subject)
  app.advance(26*60*1000);                 // time passes beyond the session length
  app.pump();                              // interval tick -> finishT() logs the session
  const slog = JSON.parse(store.get('god.study.v1')||'[]');
  assert.ok(slog.length===1 && slog[0].subj==='ریاضی' && slog[0].mins===25, 'finished 25-min session logged under ریاضی, got '+JSON.stringify(slog));
  const list = qs('#planList').innerHTML;
  assert.ok(list.includes(fa(25)+' از '+fa(30)), 'plan auto-deducted: 25 of 30 done');
  assert.ok(list.includes(fa(5)+' دقیقه مانده'), 'plan shows exactly 5 min remaining');
  console.log('Scenario 2 OK: real timer finish (25 min) auto-deducted from today plan -> 5 min remaining');
}
console.log('ALL TESTS PASSED');
