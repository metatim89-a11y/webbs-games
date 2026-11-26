// End-to-end: sign-up, approval, private messages, family chat, lobby, invite -> join. Real Firebase, two browsers.
import { launch, openPage, sleep } from './cdp.mjs';
import { execSync } from 'node:child_process';
const S = process.argv[2];
const SITE = 'http://localhost:8123';
const DB = 'https://x300-506418-default-rtdb.firebaseio.com';
const token = () => execSync('gcloud auth print-access-token').toString().trim();
const admin = async (method, path, body) => (await fetch(`${DB}/${path}.json?access_token=${token()}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).json();

const results = [];
const step = (name, ok) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name); };

const A = await launch(9311, `${S}/prof-a`);
const B = await launch(9312, `${S}/prof-b`);
const C = await launch(9313, `${S}/prof-c`);
try {
  const a = await openPage(A, `${SITE}/index.html`);
  const b = await openPage(B, `${SITE}/index.html`);
  for (const [p, name, pin] of [[a, 'Zzt One', '1357'], [b, 'Zzt Two', '2468']]) {
    await p.waitFor(`window.WebbsCloud && WebbsCloud.available`, 15000, 'cloud loaded');
    await p.eval(`openSignup();
      document.getElementById('signup-name').value=${JSON.stringify(name)};
      document.getElementById('signup-animal').value='Duck';
      document.getElementById('signup-game').value='Sorry';
      document.getElementById('signup-pin').value='${pin}';
      document.getElementById('signup-pin2').value='${pin}';
      submitSignup(); true`);
    await p.waitFor(`document.getElementById('pending-note').style.display === 'block'`, 20000, name + ' signed up');
  }
  step('both sign up and see "Tim needs to approve"', true);
  step('unapproved player has no Messages button', await a.eval(`document.getElementById('messages-btn').style.display === 'none'`));

  await admin('PUT', 'players/zztone/approved', true);
  await admin('PUT', 'players/zzttwo/approved', true);
  await a.waitFor(`document.getElementById('messages-btn').style.display !== 'none'`, 15000, 'A approved live');
  await b.waitFor(`document.getElementById('messages-btn').style.display !== 'none'`, 15000, 'B approved live');
  step('approval shows up instantly (no re-login)', true);

  // Private messages
  await a.eval(`FamilyUI.openMessages(); true`);
  await a.waitFor(`[...document.querySelectorAll('.dm-contact-name')].some(e => e.textContent === 'Zzt Two')`, 15000, 'contact list');
  await a.eval(`[...document.querySelectorAll('.dm-contact')].find(e => e.textContent.includes('Zzt Two')).click(); true`);
  await a.waitFor(`document.getElementById('dm-compose').style.display === 'block'`, 5000);
  await a.eval(`document.getElementById('dm-input').value = 'Hi Two! Want to play Sorry?'; document.getElementById('dm-send').click(); true`);
  await a.waitFor(`[...document.querySelectorAll('.dm-bubble.mine')].some(e => e.textContent.includes('Want to play Sorry'))`, 10000, 'own bubble');
  step('A sends a private message', true);

  await b.waitFor(`document.getElementById('messages-badge').textContent === '1'`, 15000, 'B unread badge');
  step('B gets an unread badge (1)', true);
  await b.eval(`FamilyUI.openMessages(); true`);
  await b.waitFor(`document.querySelector('.dm-contact.unread')`, 10000, 'unread contact');
  await b.eval(`document.querySelector('.dm-contact.unread').click(); true`);
  await b.waitFor(`[...document.querySelectorAll('.dm-bubble.theirs')].some(e => e.textContent.includes('Want to play Sorry'))`, 10000, 'B sees message');
  step('B reads the message', true);
  await b.eval(`document.querySelector('.dm-emoji-btn').click(); true`);
  await a.waitFor(`[...document.querySelectorAll('.dm-bubble.theirs')].some(e => e.textContent.includes('👍'))`, 10000, 'A sees reply');
  step('B replies with 👍 and A sees it live', true);
  await b.waitFor(`document.getElementById('messages-badge').style.display === 'none'`, 10000, 'badge cleared');
  step('badge clears after reading', true);
  await b.shot(`${S}/dm-thread.png`);
  await b.eval(`document.getElementById('dm-back').click(); true`);
  await sleep(600);
  await b.shot(`${S}/dm-list.png`);
  await a.eval(`FamilyUI.closeMessages(); true`); await b.eval(`FamilyUI.closeMessages(); true`);

  // Family chat
  await a.eval(`document.getElementById('msg-input').value = 'Game night at 7!'; document.getElementById('msg-send').click(); true`);
  await b.waitFor(`document.getElementById('messages').textContent.includes('Game night at 7!')`, 10000, 'board');
  step('family chat reaches the other phone', true);

  // Host a table, invite, join
  await a.goto(`${SITE}/games/sorry/index.html?player=zztone&type=online&role=host`);
  await a.waitFor(`/^\\d{4}$/.test(document.getElementById('table-pin-value').innerText)`, 30000, 'host pin');
  const pin = await a.eval(`document.getElementById('table-pin-value').innerText`);
  await b.waitFor(`document.getElementById('open-tables').textContent.includes('Zzt One')`, 15000, 'lobby row');
  step(`lobby shows "Zzt One · Sorry" (table ${pin}) on B`, true);
  await a.waitFor(`!!document.getElementById('invite-family')`, 10000, 'invite chips');
  await a.eval(`[...document.querySelectorAll('.invite-chip')].find(e => e.textContent === 'Zzt Two').click(); true`);
  await sleep(2500);
  await b.waitFor(`document.getElementById('invite-inbox').textContent.includes('invited you to Sorry')`, 10000, 'invite card');
  step('B gets "Zzt One invited you to Sorry"', true);
  await b.shot(`${S}/invite.png`);
  await b.eval(`document.querySelector('.invite-join').click(); true`);
  await b.waitFor(`location.href.includes('role=client')`, 30000, 'B redirected into game');
  await b.waitFor(`typeof myRole !== 'undefined' && myRole === 'player2'`, 30000, 'B is player 2');
  await a.waitFor(`player2ID === 'zzttwo'`, 15000, 'host sees zzttwo');
  step('B taps Join and is player 2 in Sorry', true);
  step('joiner sees host name', (await b.eval(`document.getElementById('turn-info').innerText`)).includes('ZZT ONE'));
  const tables = await admin('GET', 'tables');
  step('table leaves the lobby once full', !tables || !tables[pin]);

  // A stranger (guest) sees none of it
  const c = await openPage(C, `${SITE}/index.html`);
  await c.waitFor(`window.WebbsCloud && WebbsCloud.available`, 15000);
  await c.eval(`initLogin('guest'); true`);
  await sleep(2500);
  step('guest sees no messages, lobby or invites', await c.eval(`document.getElementById('family-features').style.display === 'none' && document.getElementById('messages-btn').style.display === 'none'`));
  const errs = [a, b, c].flatMap(p => p.logs.filter(l => /EXCEPTION/.test(l)));
  step('no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''), errs.length === 0);
} catch (e) {
  step('crashed: ' + e.message, false);
} finally {
  A.close(); B.close(); C.close();
  // Clean up every trace of the test players
  const players = (await admin('GET', 'players')) || {};
  const uids = ['zztone', 'zzttwo'].map(id => players[id]?.uid).filter(Boolean);
  const upd = {};
  for (const id of ['zztone', 'zzttwo']) for (const root of ['logins', 'players', 'reads', 'history', 'invites']) upd[`${root}/${id}`] = null;
  uids.forEach(u => { upd[`uids/${u}`] = null; });
  upd['dms/zztone__zzttwo'] = null;
  const board = (await admin('GET', 'board')) || {};
  Object.entries(board).forEach(([k, v]) => { if (String(v.from).startsWith('zzt')) upd[`board/${k}`] = null; });
  const tables = (await admin('GET', 'tables')) || {};
  Object.entries(tables).forEach(([k, v]) => { if (String(v.host).startsWith('zzt')) upd[`tables/${k}`] = null; });
  await admin('PATCH', '', upd);
  if (uids.length) {
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/projects/x300-506418/accounts:batchDelete', {
      method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'x-goog-user-project': 'x300-506418', 'Content-Type': 'application/json' },
      body: JSON.stringify({ localIds: uids, force: true }) });
    console.log('deleted test accounts:', r.status);
  }
  console.log(`${results.filter(Boolean).length}/${results.length} steps passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
