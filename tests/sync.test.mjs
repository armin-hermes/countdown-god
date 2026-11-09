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

// ---------- Scenario 2: countdown end -> overtime -> user ends -> logged ----------
{
  const plan = [ {wd:wdToday, day:'', subj:'ریاضی', goal:30, note:'جلسه امروز', done:false, ts:now-1000} ];
  const app = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': '[]' });
  const { qs, store } = app;
  qs('#btnStart').onclick();              // start 25-min focus on ریاضی (default subject)
  app.advance(26*60*1000);                 // 25 min pass + 1 min into overtime
  app.pump();                              // tick -> countdown hits zero -> overtime begins
  let slog = JSON.parse(store.get('god.study.v1')||'[]');
  assert.strictEqual(slog.length, 0, 'nothing logged yet: overtime keeps the session open');
  assert.ok(qs('#clock').textContent.startsWith('+'), 'overtime clock shows +, got '+qs('#clock').textContent);
  qs('#btnStart').onclick();               // primary button is now "end session"
  slog = JSON.parse(store.get('god.study.v1')||'[]');
  assert.ok(slog.length===1 && slog[0].subj==='ریاضی' && slog[0].mins===26, 'session logged as 25+1=26 min, got '+JSON.stringify(slog));
  const list = qs('#planList').innerHTML;
  assert.ok(list.includes(fa(26)+' از '+fa(30)), 'plan auto-deducted 26 of 30');
  assert.ok(list.includes(fa(4)+' دقیقه مانده'), 'plan shows exactly 4 min remaining');
  console.log('Scenario 2 OK: countdown -> overtime (+1) -> end logs 26 min -> plan 26/30, 4 remaining');
}

// ---------- Scenario 3: free stopwatch + start-from-plan ----------
{
  const plan = [
    {wd:wdToday, day:'', subj:'ریاضی', goal:30, note:'امروز', done:false, ts:now-2000},
    {wd:wdToday, day:'', subj:'فیزیک', goal:45, note:'تست فیزیک', done:false, ts:now-1000},
  ];
  const app = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': '[]' });
  const { qs, store } = app;

  // --- free stopwatch: 10 minutes of math, no cap ---
  qs('#tabFree').onclick();
  assert.strictEqual(qs('#customRow').style.display, 'none', 'free mode hides the custom time input');
  assert.strictEqual(qs('#plenLbl').style.display, 'none', 'free mode hides the length label');
  assert.strictEqual(qs('#presets').style.display, 'none', 'free mode hides the presets');
  qs('#btnStart').onclick();
  app.advance(10*60*1000); app.pump();
  assert.strictEqual(qs('#clock').textContent, '10:00', 'stopwatch counts up to 10:00, got '+qs('#clock').textContent);
  qs('#btnReset').onclick();               // in free mode reset = end & log
  let slog = JSON.parse(store.get('god.study.v1')||'[]');
  assert.ok(slog.length===1 && slog[0].subj==='ریاضی' && slog[0].mins===10, 'free session logged 10 min math, got '+JSON.stringify(slog));
  assert.ok(qs('#planList').innerHTML.includes(fa(10)+' از '+fa(30)), 'stopwatch minutes deducted from plan (10/30)');

  // --- start-from-plan: physics task (45 min) drives subject + length + start ---
  const starts = qs('#planList').querySelectorAll('[data-pstart]');
  assert.strictEqual(starts.length, 2, 'every task row has a start button');
  starts[1].click();
  assert.strictEqual(qs('#customRow').style.display, '', 'focus mode restores the time input');
  assert.strictEqual(qs('#faceSubj').textContent, 'فیزیک', 'timer subject switched to the task subject');
  assert.strictEqual(qs('#clock').textContent, '45:00', 'timer length set from task goal, got '+qs('#clock').textContent);
  app.advance(45*60*1000); app.pump();     // planned time ends -> overtime
  app.advance(5*60*1000); app.pump();      // +5 overtime
  assert.strictEqual(qs('#clock').textContent, '+05:00', 'overtime at +05:00, got '+qs('#clock').textContent);
  qs('#btnStart').onclick();               // end session
  slog = JSON.parse(store.get('god.study.v1')||'[]');
  assert.ok(slog.length===2 && slog[1].subj==='فیزیک' && slog[1].mins===50, 'plan-started session logged 45+5=50 min physics, got '+JSON.stringify(slog));
  assert.ok(qs('#planList').innerHTML.includes('کامل شد'), 'physics task completed through plan-start + overtime sync');
  console.log('Scenario 3 OK: free stopwatch logs & syncs; start-from-plan sets subject+45min, overtime +5, task complete');
}
// ---------- Scenario 4: switching timer tabs mid-session never loses minutes ----------
{
  const plan = [ {wd:wdToday, day:'', subj:'ریاضی', goal:30, note:'امروز', done:false, ts:now-1000} ];

  // 4a: free stopwatch 8 min -> tap focus tab: 8 min logged, plan 8/30, fresh 25:00 countdown
  const a = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': '[]' });
  a.qs('#tabFree').onclick();
  a.qs('#btnStart').onclick();
  a.advance(8*60*1000); a.pump();
  assert.strictEqual(a.qs('#clock').textContent, '08:00', 'stopwatch at 08:00, got '+a.qs('#clock').textContent);
  a.qs('#tabFocus').onclick();
  let slog = JSON.parse(a.store.get('god.study.v1')||'[]');
  assert.ok(slog.length===1 && slog[0].subj==='ریاضی' && slog[0].mins===8, 'tab switch logged the 8 free minutes, got '+JSON.stringify(slog));
  assert.ok(a.qs('#planList').innerHTML.includes(fa(8)+' از '+fa(30)), 'plan deducted the switched-away 8 min (8/30)');
  assert.strictEqual(a.qs('#clock').textContent, '25:00', 'fresh focus countdown after switch, got '+a.qs('#clock').textContent);

  // 4b: countdown 6 min -> tap free tab: 6 min logged, stopwatch starts at 00:00
  const b = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': '[]' });
  b.qs('#btnStart').onclick();
  b.advance(6*60*1000); b.pump();
  b.qs('#tabFree').onclick();
  slog = JSON.parse(b.store.get('god.study.v1')||'[]');
  assert.ok(slog.length===1 && slog[0].subj==='ریاضی' && slog[0].mins===6, 'tab switch logged the 6 countdown minutes, got '+JSON.stringify(slog));
  assert.ok(b.qs('#planList').innerHTML.includes(fa(6)+' از '+fa(30)), 'plan deducted the switched-away 6 min (6/30)');
  assert.strictEqual(b.qs('#clock').textContent, '00:00', 'fresh stopwatch after switch, got '+b.qs('#clock').textContent);

  // 4c: tapping the already-active free tab keeps a paused stopwatch (no silent reset)
  const c = loadApp({ 'god.plan.v1': JSON.stringify(plan), 'god.study.v1': '[]' });
  c.qs('#tabFree').onclick();
  c.qs('#btnStart').onclick();
  c.advance(5*60*1000); c.pump();
  c.qs('#btnPause').onclick();
  assert.strictEqual(c.qs('#clock').textContent, '05:00', 'paused stopwatch at 05:00, got '+c.qs('#clock').textContent);
  c.qs('#tabFree').onclick();
  assert.strictEqual(c.qs('#clock').textContent, '05:00', 're-tapping active tab keeps 05:00, got '+c.qs('#clock').textContent);
  slog = JSON.parse(c.store.get('god.study.v1')||'[]');
  assert.strictEqual(slog.length, 0, 'nothing logged by the re-tap');
  console.log('Scenario 4 OK: tab switches flush minutes to the log + plan; active-tab re-tap preserves paused stopwatch');
}
// ---------- Scenario 5: custom sound dropdown (no native select) ----------
{
  const app = loadApp({ 'god.study.v1': '[]' });
  const { qs } = app;
  assert.strictEqual(qs('#soundCselVal').textContent, 'زنگ مدرسه و آزمون (پرانرژی و رسمی)', 'dropdown shows the default sound label');
  const list = qs('#soundCselList').innerHTML;
  assert.ok(list.includes('data-v="school_bell"') && list.includes('data-v="piano"') && list.includes('data-v="positive"'), 'dropdown renders all sound options');
  assert.ok(list.includes('csel-item on'), 'current sound is marked selected in the dropdown');
  console.log('Scenario 5 OK: custom sound dropdown renders options + current selection');
}
console.log('ALL TESTS PASSED');
