// Tim's side: made admin while signed in (no reload), sees "wants to join" on the main menu,
// taps Approve, and the new player gets Messages + the Game Lobby live. Real Firebase, two browsers.
import { launch, openPage, sleep } from './cdp.mjs';
import { execSync } from 'node:child_process';
const S = process.argv[2];
const SITE = process.argv[3] || 'http://localhost:8123';
const DB = 'https://x300-506418-default-rtdb.firebaseio.com';
const token = () => execSync('gcloud auth print-access-token').toString().trim();
const admin = async (method, path, body) => (await fetch(`${DB}/${path}.json?access_token=${token()}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const results = []; const step = (n, ok) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n); };
const IDS = ['zztboss', 'zztkid'];

async function signup(p, name, pin) {
  await p.waitFor(`window.WebbsCloud && WebbsCloud.available`, 15000, 'cloud loaded');
  await p.eval(`openSignup();
    document.getElementById('signup-name').value=${JSON.stringify(name)};
    document.getElementById('signup-animal').value='Cat';
    document.getElementById('signup-game').value='Mancala';
    document.getElementById('signup-pin').value='${pin}';
    document.getElementById('signup-pin2').value='${pin}';
    submitSignup(); true`);
  await p.waitFor(`document.getElementById('pending-note').style.display === 'block'`, 20000, name + ' signed up');
}

const A = await launch(9331, `${S}/prof-boss`);
const B = await launch(9332, `${S}/prof-kid`);
try {
  const a = await openPage(A, `${SITE}/index.html`);
  const b = await openPage(B, `${SITE}/index.html`);
  await signup(a, 'Zzt Boss', '1470');
  const uid = (await admin('GET', 'players/zztboss')).uid;
  await admin('PATCH', '', { [`admins/${uid}`]: true, 'players/zztboss/approved': true });
  await a.waitFor(`WebbsCloud.me && WebbsCloud.me.admin && document.getElementById('messages-btn').style.display !== 'none'`, 15000, 'admin live');
  step('made admin while signed in: no reload needed', true);
  step('"waiting for Tim" note is gone for the admin', await a.eval(`document.getElementById('pending-note').style.display === 'none'`));
  await a.waitFor(`document.getElementById('game-lobby').textContent.includes('Game Lobby') && document.getElementById('open-tables').style.display === 'block'`, 10000, 'lobby');
  step('Game Lobby shows even when nobody is hosting', await a.eval(`document.getElementById('open-tables').textContent.includes('No one is waiting')`));

  await signup(b, 'Zzt Kid', '2580');
  await a.waitFor(`document.getElementById('admin-approvals').textContent.includes('Zzt Kid')`, 15000, 'approval card');
  step('Tim sees "1 person wants to join" with the new name, on the main menu', await a.eval(`document.getElementById('admin-approvals').textContent.includes('1 person wants')`));
  await a.shot(`${S}/approve-card.png`);
  step('the new player does not see the lobby yet', await b.eval(`document.getElementById('open-tables').style.display === 'none'`));

  await a.eval(`document.querySelector('.approval-yes').click(); true`);
  await a.waitFor(`document.getElementById('admin-approvals').style.display === 'none'`, 15000, 'card gone');
  step('tapping Approve clears the card', true);
  await b.waitFor(`document.getElementById('messages-btn').style.display !== 'none' && document.getElementById('open-tables').style.display === 'block'`, 15000, 'kid approved live');
  step('new player gets Messages and the Game Lobby right away', true);
  await b.shot(`${S}/kid-approved.png`);

  const errs = [a, b].flatMap(p => p.logs.filter(l => /EXCEPTION/.test(l)));
  step('no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''), errs.length === 0);
} catch (e) { step('crashed: ' + e.message, false); }
finally {
  A.close(); B.close();
  const players = (await admin('GET', 'players')) || {};
  const uids = IDS.map(id => players[id]?.uid).filter(Boolean);
  const upd = {};
  for (const id of IDS) for (const root of ['logins', 'players', 'reads', 'history', 'invites']) upd[`${root}/${id}`] = null;
  uids.forEach(u => { upd[`uids/${u}`] = null; upd[`admins/${u}`] = null; });
  await admin('PATCH', '', upd);
  if (uids.length) await fetch('https://identitytoolkit.googleapis.com/v1/projects/x300-506418/accounts:batchDelete', { method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'x-goog-user-project': 'x300-506418', 'Content-Type': 'application/json' },
    body: JSON.stringify({ localIds: uids, force: true }) });
  console.log(`${results.filter(Boolean).length}/${results.length} passed (test accounts removed)`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
