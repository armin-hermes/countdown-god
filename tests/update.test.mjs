// v1.2.0: in-app update check, theme follows the device on first run,
// PWA install/widget hidden in the APK, native body class.
// The native plugin calls are stubbed by the harness (opts.native); the
// real AppUpdater Java plugin is exercised only by the CI build + device.
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

const tick = () => new Promise(r => setTimeout(r, 10));
const wait = async (n = 3) => { for (let i = 0; i < n; i++) await tick(); };
const release = (tag, apkUrl) => ({ tag_name: tag, assets: apkUrl ? [{ name: 'app-debug.apk', browser_download_url: apkUrl }] : [] });
const modeOf = (a) => a.sandbox.document.documentElement.dataset.mode;

// ---------- 1: fresh install follows the device theme ----------
{
  const light = loadApp({}, { matchMediaLight: true });
  assert.strictEqual(modeOf(light), 'light', 'fresh install on a light device starts light, got ' + modeOf(light));
  const dark = loadApp({}, { matchMediaLight: false });
  assert.strictEqual(modeOf(dark), 'dark', 'fresh install on a dark device starts dark, got ' + modeOf(dark));
  const noMM = loadApp({});
  assert.strictEqual(modeOf(noMM), 'dark', 'without matchMedia the old dark default stays, got ' + modeOf(noMM));
  console.log('Update 1 OK: first-run theme follows the device');
}

// ---------- 2: a saved theme choice always wins over the device ----------
{
  const a = loadApp({ 'god.ui.v1': JSON.stringify({ mode: 'light' }) }, { matchMediaLight: false });
  assert.strictEqual(modeOf(a), 'light', 'saved light stays light on a dark device');
  const b = loadApp({ 'god.ui.v1': JSON.stringify({ mode: 'dark' }) }, { matchMediaLight: true });
  assert.strictEqual(modeOf(b), 'dark', 'saved dark stays dark on a light device');
  console.log('Update 2 OK: saved theme wins over the device setting');
}

// ---------- 3: on the web the update section is hidden, PWA install stays ----------
{
  const a = loadApp({});
  assert.strictEqual(a.qs('#updateLbl').style.display, 'none', 'update label hidden on the web');
  assert.strictEqual(a.qs('#updateRow').style.display, 'none', 'update row hidden on the web');
  assert.strictEqual(a.qs('#updateState').style.display, 'none', 'update state hidden on the web');
  assert.notStrictEqual(a.qs('#installWidgetSection').style.display, 'none', 'PWA install/widget stays visible on the web');
  a.qs('#updateCheckBtn').onclick();
  await wait();
  assert.ok(a.qs('#updateState').textContent.includes('فقط در نسخه اندروید'), 'web check shows the android-only note, got ' + a.qs('#updateState').textContent);
  console.log('Update 3 OK: web hides the updater, keeps PWA install');
}

// ---------- 4: native gets the .native class, hides PWA install, shows its version ----------
{
  const a = loadApp({}, { native: true, appVersion: '1.2.0' });
  assert.ok(a.sandbox.document.body.classList.contains('native'), 'native adds the .native body class');
  assert.strictEqual(a.qs('#installWidgetSection').style.display, 'none', 'PWA install/widget hidden in the APK');
  assert.notStrictEqual(a.qs('#updateLbl').style.display, 'none', 'update section visible in the APK');
  await wait();
  assert.ok(a.qs('#updateVer').textContent.includes('1.2.0'), 'current version shown, got ' + a.qs('#updateVer').textContent);
  console.log('Update 4 OK: native hides PWA install and shows its version');
}

// ---------- 5: a newer release downloads + installs that release APK ----------
{
  const a = loadApp({}, { native: true, appVersion: '1.2.0', fetchImpl: async () => ({ ok: true, json: async () => release('v1.3.0', 'https://example.test/app.apk') }) });
  a.qs('#updateCheckBtn').onclick();
  await wait();
  assert.strictEqual(a.nativeCalls.installApk.length, 1, 'installApk called once for a newer release');
  assert.strictEqual(a.nativeCalls.installApk[0].url, 'https://example.test/app.apk', 'installs the release APK URL');
  assert.ok(a.qs('#updateState').textContent.includes('نصب شروع شد'), 'state says the install started, got ' + a.qs('#updateState').textContent);
  console.log('Update 5 OK: newer release triggers the APK install');
}

// ---------- 6: same or older release installs nothing ----------
{
  const same = loadApp({}, { native: true, appVersion: '1.2.0', fetchImpl: async () => ({ ok: true, json: async () => release('v1.2.0', 'https://example.test/app.apk') }) });
  same.qs('#updateCheckBtn').onclick();
  await wait();
  assert.strictEqual(same.nativeCalls.installApk.length, 0, 'no install for the same version');
  assert.ok(same.qs('#updateState').textContent.includes('به‌روز هستی'), 'same version reports up-to-date, got ' + same.qs('#updateState').textContent);
  const older = loadApp({}, { native: true, appVersion: '1.2.0', fetchImpl: async () => ({ ok: true, json: async () => release('v1.1.0', 'https://example.test/app.apk') }) });
  older.qs('#updateCheckBtn').onclick();
  await wait();
  assert.strictEqual(older.nativeCalls.installApk.length, 0, 'no install for an older release');
  console.log('Update 6 OK: same/older releases install nothing');
}

// ---------- 7: release without an APK, or a failed fetch, fails soft ----------
{
  const noApk = loadApp({}, { native: true, appVersion: '1.2.0', fetchImpl: async () => ({ ok: true, json: async () => release('v1.3.0', null) }) });
  noApk.qs('#updateCheckBtn').onclick();
  await wait();
  assert.strictEqual(noApk.nativeCalls.installApk.length, 0, 'no install without an APK asset');
  assert.ok(noApk.qs('#updateState').textContent.includes('ناموفق بود'), 'missing APK shows a failure note, got ' + noApk.qs('#updateState').textContent);
  const badNet = loadApp({}, { native: true, appVersion: '1.2.0', fetchImpl: async () => { throw new Error('offline'); } });
  badNet.qs('#updateCheckBtn').onclick();
  await wait();
  assert.strictEqual(badNet.nativeCalls.installApk.length, 0, 'no install when the network fails');
  assert.ok(badNet.qs('#updateState').textContent.includes('ناموفق بود'), 'network failure shows a failure note, got ' + badNet.qs('#updateState').textContent);
  console.log('Update 7 OK: missing APK / failed fetch fail soft');
}

console.log('ALL UPDATE TESTS PASSED');
