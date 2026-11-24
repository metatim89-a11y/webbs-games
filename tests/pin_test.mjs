// PIN flow: new player makes a PIN (typed twice), logs out, wrong PIN refused, right PIN works.
import { launch, openPage, sleep } from './cdp.mjs';
import { execSync } from 'node:child_process';
const S = process.argv[2];
const DB = 'https://x300-506418-default-rtdb.firebaseio.com';
const token = () => execSync('gcloud auth print-access-token').toString().trim();
const admin = async (method, path, body) => (await fetch(`${DB}/${path}.json?access_token=${token()}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const results = []; const step = (n, ok) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const typePin = (p, pin) => p.eval(`clearPin(); '${pin}'.split('').forEach(d => appendPin(d)); submitPin(); true`);
const msg = p => p.eval(`document.getElementById('pin-msg').innerText`);

const A = await launch(9321, `${S}/prof-pin`);
try {
  const p = await openPage(A, 'http://localhost:8123/index.html');
  await p.waitFor(`window.WebbsCloud && WebbsCloud.available`, 15000);
  await p.eval(`initLogin('zztpin'); true`);
  await p.waitFor(`document.getElementById('pin-msg').innerText.startsWith('Make a 4-digit PIN')`, 10000, 'create prompt');
  step('new player is asked to make a PIN', true);
  await typePin(p, '1111'); await sleep(300);
  step('asked to type it again', (await msg(p)) === 'Type the same PIN again');
  await typePin(p, '2222'); await sleep(300);
  step('mismatch is caught', (await msg(p)).startsWith("Those didn't match"));
  await typePin(p, '4321'); await sleep(200); await typePin(p, '4321');
  await p.waitFor(`document.getElementById('main-menu').style.display === 'block'`, 20000, 'logged in');
  step('PIN made and logged in', await p.eval(`WebbsCloud.me && WebbsCloud.me.id === 'zztpin'`));
  await p.eval(`logout(); true`); await sleep(2500);
  await p.waitFor(`window.WebbsCloud && WebbsCloud.available`, 15000);
  step('logout signs out of the family account', await p.eval(`!WebbsCloud.me`));
  await p.eval(`localStorage.removeItem('pin_zztpin'); initLogin('zztpin'); true`); // a different phone: no saved PIN
  await p.waitFor(`document.getElementById('pin-msg').innerText.startsWith('Enter PIN')`, 10000, 'enter prompt');
  step('on a new phone it asks for the existing PIN (not a new one)', true);
  await typePin(p, '9999');
  await p.waitFor(`document.getElementById('pin-msg').innerText === 'Wrong PIN, try again'`, 15000, 'wrong pin');
  step('wrong PIN refused', true);
  await typePin(p, '4321');
  await p.waitFor(`document.getElementById('main-menu').style.display === 'block'`, 15000, 'logged in again');
  step('right PIN works from any phone', true);
} catch (e) { step('crashed: ' + e.message, false); }
finally {
  A.close();
  const pl = (await admin('GET', 'players/zztpin')) || {};
  await admin('PATCH', '', { 'players/zztpin': null, 'logins/zztpin': null, ...(pl.uid ? { [`uids/${pl.uid}`]: null } : {}) });
  if (pl.uid) await fetch('https://identitytoolkit.googleapis.com/v1/projects/x300-506418/accounts:batchDelete', { method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'x-goog-user-project': 'x300-506418', 'Content-Type': 'application/json' },
    body: JSON.stringify({ localIds: [pl.uid], force: true }) });
  console.log(`${results.filter(Boolean).length}/${results.length} passed (test account removed)`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
