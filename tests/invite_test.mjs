// End-to-end: host opens an online Sorry table, a second browser taps the invite link and lands in the game.
import { launch, openPage, sleep } from './cdp.mjs';
const S = process.argv[2];
const SITE = 'http://localhost:8123';

const a = await launch(9301, `${S}/prof-host`);
const b = await launch(9302, `${S}/prof-join`);
let ok = false;
try {
  const host = await openPage(a, `${SITE}/games/sorry/index.html?player=tim&type=online&role=host`);
  await host.waitFor(`/^\\d{4}$/.test(document.getElementById('table-pin-value').innerText)`, 30000, 'host PIN');
  await host.waitFor(`!!document.getElementById('invite-share-btn')`, 5000, 'invite button');
  const link = await host.eval('NetworkManager.inviteLink()');
  console.log('invite link:', link);

  const join = await openPage(b, link);
  await join.waitFor(`!!document.getElementById('join-banner')`, 10000, 'join banner');
  console.log('banner:', await join.eval(`document.getElementById('join-banner').innerText`));
  await join.eval(`initLogin('guest')`);
  await join.waitFor(`location.href.includes('role=client')`, 30000, 'redirect into the game');
  console.log('joiner now at:', await join.eval('location.pathname + location.search'));
  await join.waitFor(`typeof myRole !== 'undefined' && myRole === 'player2'`, 30000, 'joined as player 2');
  await host.waitFor(`player2ID !== null`, 10000, 'host sees player 2');
  console.log('host turn text:', await host.eval(`document.getElementById('turn-info').innerText`));
  console.log('joiner turn text:', await join.eval(`document.getElementById('turn-info').innerText`));

  // Host plays a few turns; the joiner's board must follow
  for (let t = 0; t < 6; t++) {
    const turn = await host.eval('currentPlayer');
    const actor = turn === 'X' ? host : join;
    await actor.waitFor(`!isMoving && !isRolling && !currentRoll`, 15000, 'ready to roll');
    await actor.eval('handleRoll()');
    await actor.waitFor(`currentRoll || currentPlayer !== ${JSON.stringify(turn)}`, 15000, 'rolled');
    const sel = await actor.eval('getSelectablePawns()');
    if (sel && sel.length) await actor.eval(`handlePawnClick(currentPlayer === 'X' ? 'p1' : 'p2', ${sel[0]})`);
    await host.waitFor(`currentPlayer !== ${JSON.stringify(turn)}`, 15000, 'turn passed on host');
    await join.waitFor(`currentPlayer !== ${JSON.stringify(turn)} && !isMoving`, 15000, 'turn passed on joiner');
  }
  await sleep(1500);
  const hs = await host.eval('JSON.stringify([p1Pawns, p2Pawns, currentPlayer])');
  const js = await join.eval('JSON.stringify([p1Pawns, p2Pawns, currentPlayer])');
  console.log('host  state:', hs);
  console.log('joiner state:', js);
  ok = hs === js;
  console.log(ok ? 'PASS: both phones agree after 6 turns' : 'FAIL: phones disagree');
  console.log('host errors:', host.logs.filter(l => /EXCEPTION|DIALOG/.test(l)));
  console.log('join errors:', join.logs.filter(l => /EXCEPTION|DIALOG/.test(l)));
} catch (e) {
  console.log('FAIL:', e.message);
} finally { a.close(); b.close(); }
process.exit(ok ? 0 : 1);
