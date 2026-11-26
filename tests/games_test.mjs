// Game rules test: every game page runs in a pretend browser (jsdom), with the site's real scripts.
// Online games run on two pretend phones joined by a pretend PeerJS link, like tests/chat_test.mjs.
// Timers run 40 times faster, so the computer's turns and the animations take a moment, not minutes.
//   npm install --no-save jsdom      (once; it's only needed for this test)
//   node tests/games_test.mjs        (all games)
//   node tests/games_test.mjs uno    (only tests whose name has "uno" in it)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch { console.log('This test needs jsdom. Run:  npm install --no-save jsdom  then try again.'); process.exit(2); }

const SPEED = 40;
const only = (process.argv[2] || '').toLowerCase();
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
let failures = 0, step = 0;
function check(ok, label, detail = '') {
  step++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}. ${label}${ok || !detail ? '' : ' (' + detail + ')'}`);
  if (!ok) failures++;
}
// Wait until cond() is true (checked every few ms), up to `ms` real milliseconds
async function until(cond, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (cond()) return true; } catch (e) {} await tick(5); }
  return false;
}

// ---- Pretend PeerJS (same idea as tests/chat_test.mjs) ----
const peers = new Map();
class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach(fn => fn(...a)); }
}
class FakeConn extends Emitter {
  constructor(peerId) { super(); this.peer = peerId; this.open = false; this.other = null; }
  send(data) {
    if (!this.open) throw new Error('send on a closed connection');
    const copy = structuredClone(data), other = this.other;
    setTimeout(() => other.open && other.emit('data', copy), 1);
  }
  close() {
    [this, this.other].forEach(c => { if (c.open) { c.open = false; setTimeout(() => c.emit('close'), 1); } });
  }
}
let nextId = 1;
class FakePeer extends Emitter {
  constructor(id) {
    super();
    this.id = id || 'anon-' + nextId++;
    peers.set(this.id, this);
    setTimeout(() => this.emit('open', this.id), 1);
  }
  connect(id) {
    const host = peers.get(id);
    const mine = new FakeConn(id), theirs = new FakeConn(this.id);
    mine.other = theirs; theirs.other = mine;
    setTimeout(() => {
      host.emit('connection', theirs);
      setTimeout(() => { mine.open = theirs.open = true; theirs.emit('open'); mine.emit('open'); }, 2);
    }, 2);
    return mine;
  }
}

// ---- One pretend phone showing one game page ----
const opened = [];
async function openGame(game, query, player = 'guest') {
  let html = readFileSync(path.join(root, 'games', game, 'index.html'), 'utf8');
  // PeerJS and Firebase come from the internet; here the pretend PeerJS stands in and Firebase is simply missing
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="\.\.\/\.\.\/([\w-]+\.js)(\?v=[^"]*)?"><\/script>/g,
    (m, file) => `<script>${readFileSync(path.join(root, file), 'utf8')}</script>`);
  const errors = [], alerts = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(html, {
    url: `https://wubs.test/webbs-games/games/${game}/index.html?player=${player}&${query}`,
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const real = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms = 0, ...a) => real(fn, Math.ceil(ms / SPEED), ...a);
      w.alert = msg => alerts.push(String(msg));
      w.confirm = () => true;
      w.prompt = () => null;
      w.Peer = FakePeer;
      w.scrollTo = () => {};
      // jsdom has no innerText; the games use it, so map it to textContent like a browser would for plain text
      Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
        configurable: true, get() { return this.textContent; }, set(v) { this.textContent = v; }
      });
      w.sessionStorage.setItem('webbs_active_player', player);
    }
  });
  const w = dom.window;
  await new Promise(r => w.document.readyState === 'complete' ? r() : w.addEventListener('load', r));
  await tick(5);
  const p = {
    w, errors, alerts,
    $: sel => w.document.querySelector(sel),
    $$: sel => [...w.document.querySelectorAll(sel)],
    get: expr => w.eval(expr),
    run: code => w.eval(code),
    text: sel => (w.document.querySelector(sel)?.textContent || '').trim(),
    click: sel => { const el = typeof sel === 'string' ? w.document.querySelector(sel) : sel; if (!el) throw new Error('nothing to tap: ' + sel); el.click(); },
    modalOpen: () => w.document.getElementById('game-over-modal')?.style.display === 'flex',
  };
  opened.push(p);
  return p;
}

// A host and a joiner at the same online table
async function onlineTable(game) {
  const host = await openGame(game, 'type=online&role=host', 'tim');
  await until(() => host.get('NetworkManager.roomID') && host.get('NetworkManager.peer'));
  await tick(5);
  const pin = host.get('NetworkManager.roomID');
  const guest = await openGame(game, `type=online&role=client&host=${pin}`, 'ariel');
  return { host, guest };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// =====================================================================
// Tic-Tac-Toe
// =====================================================================
test('tic-tac-toe vs computer', async () => {
  const g = await openGame('tic-tac-toe', 'type=cpu');
  const cells = g.$$('.cell');
  check(g.text('#turn-info') === "Guest's Turn", 'Tic-Tac-Toe: you go first against the computer', g.text('#turn-info'));
  g.click(cells[0]);
  check(g.get('board[0]') === 'X', 'Tic-Tac-Toe: tapping a square puts your X there');
  g.click(cells[1]);
  check(g.get('board[1]') === '', "Tic-Tac-Toe: you can't tap again while the computer is thinking");
  await until(() => g.get('board.filter(v => v === "O").length') === 1);
  check(g.get('board.filter(v => v === "O").length') === 1 && g.get('currentPlayer') === 'X', 'Tic-Tac-Toe: the computer answers with one O');

  // Reset straight after your move: the computer's pending move must not land on the new board
  const empty = g.get('board.indexOf("")');
  g.click(cells[empty]);
  g.click('#reset-btn');
  await tick(60);
  const xs = g.get('board.filter(v => v === "X").length'), os = g.get('board.filter(v => v === "O").length');
  check(xs === 0 && os <= 1, 'Tic-Tac-Toe: after Reset the old computer move never lands on the new board', `X ${xs}, O ${os}`);
  check(g.get('board.filter(v => v === "X").length') === 0, 'Tic-Tac-Toe: the computer never plays X for you');

  // Play a full game (you take the first empty square each time) until it ends
  for (let i = 0; i < 30 && g.get('active'); i++) {
    await until(() => !g.get('active') || g.get('currentPlayer') === 'X');
    if (!g.get('active')) break;
    g.click(cells[g.get('board.indexOf("")')]);
    await tick(5);
  }
  check(g.modalOpen(), 'Tic-Tac-Toe: the game ends with the winner screen');
  check(/wins!|draw/i.test(g.text('#turn-info')), 'Tic-Tac-Toe: the turn line shows the result, not "Your Turn"', g.text('#turn-info'));
  g.click('#play-again-btn');
  await until(() => g.get('active'));
  check(!g.modalOpen() && g.get('board.join("")').length <= 1, 'Tic-Tac-Toe: Play Again starts a clean board');
});

test('tic-tac-toe online', async () => {
  const { host, guest } = await onlineTable('tic-tac-toe');
  check(host.text('#turn-info') === 'Waiting for someone to join…' || host.get('player2ID'), 'Tic-Tac-Toe online: the host waits for a player before playing');
  await until(() => host.get('player2ID') && guest.get('myRole') === 'player2');
  check(guest.get('myRole') === 'player2', 'Tic-Tac-Toe online: the second phone joins as Player 2');
  check(guest.$('#reset-btn').disabled && guest.text('#reset-btn') === 'Host can restart', "Tic-Tac-Toe online: the joiner's Reset is greyed out and says why", guest.text('#reset-btn'));
  const H = host.$$('.cell'), G = guest.$$('.cell');
  // X: 0, 1, 2 wins along the top; O: 3, 4
  const moves = [[host, H, 0], [guest, G, 3], [host, H, 1], [guest, G, 4], [host, H, 2]];
  for (const [p, cells, i] of moves) {
    await until(() => p.get('canMove()'));
    p.click(cells[i]);
    await until(() => host.get(`board[${i}]`) !== '' && guest.get(`board[${i}]`) !== '');
  }
  await until(() => guest.modalOpen() && host.modalOpen());
  check(host.modalOpen() && guest.modalOpen(), 'Tic-Tac-Toe online: both phones see the winner screen');
  check(guest.$('#play-again-btn').disabled && guest.text('#play-again-btn') === 'Waiting for host…', "Tic-Tac-Toe online: the joiner's Play Again says it waits for the host", guest.text('#play-again-btn'));
  host.click('#play-again-btn');
  await until(() => !guest.modalOpen() && guest.get('active'));
  check(!guest.modalOpen() && guest.get('board.join("")') === '', "Tic-Tac-Toe online: the host's Play Again clears the joiner's screen too");
});

// =====================================================================
// 357 (Nim)
// =====================================================================
const pieces = (g, row) => g.$$(`#row-${row} .nim-piece`);
test('357 vs computer', async () => {
  const g = await openGame('357', 'type=cpu');
  check(g.$$('.nim-piece').length === 15 && pieces(g, 2).length === 7, '357: the board starts with rows of 3, 5 and 7');
  check(g.$('#end-turn-btn').disabled && g.text('#end-turn-btn') === 'Tap pieces first', '357: Take is greyed out and says to tap pieces first', g.text('#end-turn-btn'));
  g.click(pieces(g, 2)[4]); // the 5th of 7: takes it and the two to its right
  check(g.get('selectedCount') === 3 && g.text('#end-turn-btn') === 'Take 3', '357: tapping a piece picks it and the ones to its right, and Take says how many', g.text('#end-turn-btn'));
  g.click('#end-turn-btn');
  check(g.get('piles.join()') === '3,5,4', '357: Take removes them from that row only', g.get('piles.join()'));
  check(g.text('#end-turn-btn') === 'Wait for your turn', "357: during the computer's turn Take says to wait", g.text('#end-turn-btn'));
  g.click(pieces(g, 0)[0]);
  check(g.get('selectedCount') === 0, "357: you can't pick pieces during the computer's turn");
  // Reset while the computer is thinking: its move must not land on the new board
  g.click('#reset-btn');
  await tick(60);
  // The computer starts this game (starts take turns), so it makes exactly one move and then it's your turn
  const changedRows = g.get('piles.filter((p, i) => p !== [3, 5, 7][i]).length');
  check(changedRows === 1 && g.get('currentPlayer') === 'X', "357: Reset while the computer thinks, and it makes only its own one move in the new game", g.get('piles.join()') + ' turn ' + g.get('currentPlayer'));
  // Play to the end: take a whole row each turn
  for (let i = 0; i < 30 && g.get('active'); i++) {
    await until(() => !g.get('active') || g.get('currentPlayer') === 'X');
    if (!g.get('active')) break;
    const row = g.get('piles.findIndex(p => p > 0)');
    g.click(pieces(g, row)[0]);
    g.click('#end-turn-btn');
    await tick(5);
  }
  check(g.modalOpen() && /wins!/.test(g.text('#turn-info')), '357: taking the last piece ends the game, and the turn line shows the winner', g.text('#turn-info'));
});

test('357 online', async () => {
  const { host, guest } = await onlineTable('357');
  await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
  check(guest.$('#reset-btn').disabled && guest.text('#reset-btn') === 'Host can restart', "357 online: the joiner's Reset says only the host can restart");
  const turn = async (p, row, idx) => {
    await until(() => p.get('canMove()'));
    p.click(pieces(p, row)[idx]);
    p.click('#end-turn-btn');
    await tick(20);
  };
  await turn(host, 2, 0);    // host takes the 7-row
  await until(() => guest.get('piles.join()') === '3,5,0');
  check(guest.get('piles.join()') === '3,5,0', "357 online: the host's move shows on the joiner's phone");
  await turn(guest, 1, 0);   // joiner takes the 5-row
  await until(() => host.get('piles.join()') === '3,0,0');
  check(host.get('piles.join()') === '3,0,0', "357 online: the joiner's move shows on the host's phone");
  await turn(host, 0, 0);    // host takes the last row and wins
  await until(() => guest.modalOpen());
  check(guest.modalOpen() && /Tim wins!/.test(guest.text('#turn-info')), '357 online: both phones show who won', guest.text('#turn-info'));
});

// =====================================================================
// Mancala
// =====================================================================
const stones = g => g.get('board.reduce((a, b) => a + b, 0)');
test('mancala vs computer', async () => {
  const g = await openGame('mancala', 'type=cpu');
  check(/Guest: bottom row, store on the right/.test(g.text('#label-bottom')) && /Computer: top row/.test(g.text('#label-top')),
    'Mancala: labels say whose row and store is whose', g.text('#label-bottom') + ' / ' + g.text('#label-top'));
  g.click('#pit-2'); // 4 stones: 3, 4, 5 and the last one in your store
  await until(() => !g.get('sowingNow'));
  check(g.get('board.slice(0, 7).join()') === '4,4,0,5,5,5,1' && g.get('currentPlayer') === 0,
    'Mancala: last stone in your own store gives you another turn', g.get('board.join()'));
  g.click('#pit-12');
  check(g.get('sowingNow') === 0 && g.get('board[12]') === 4, "Mancala: you can't pick the computer's pits");
  g.click('#pit-0'); // lands in pit 4, turn passes to the computer
  await until(() => g.get('currentPlayer') === 1 && !g.get('sowingNow'));
  check(g.$('#pit-0').classList.contains('disabled') && g.$('#pit-3').classList.contains('disabled'), "Mancala: on the computer's turn your pits look faded");
  await until(() => g.get('currentPlayer') === 0 && !g.get('sowingNow'), 5000);
  check(stones(g) === 48, 'Mancala: the computer takes its turn and no stones appear or vanish', stones(g));

  // Reset in the middle of dropping stones: nothing from the old move lands on the new board
  g.click('#pit-5');
  await tick(3);
  g.click('#reset-btn');
  await tick(150);
  await until(() => !g.get('sowingNow'), 5000);
  check(stones(g) === 48, 'Mancala: Reset in the middle of a move gives a clean board (still 48 stones)', `${stones(g)} stones: ${g.get('board.join()')}`);

  // A capture that ends the game: one stone into the empty pit 1 takes the 5 opposite it
  await until(() => g.get('currentPlayer') === 0 && !g.get('sowingNow'), 5000);
  g.run('board = [1,0,0,0,0,0,0, 0,0,0,0,5,2,0]; render();');
  g.click('#pit-0');
  await until(() => !g.get('active'));
  check(g.get('board[6]') === 6 && g.get('board[13]') === 2, 'Mancala: landing in your empty pit captures the stones opposite', g.get('board.join()'));
  check(g.modalOpen() && g.text('#turn-info') === 'Guest wins, 6 to 2', 'Mancala: when a side is empty the game ends and shows the score', g.text('#turn-info'));
});

test('mancala online', async () => {
  const { host, guest } = await onlineTable('mancala');
  check(host.text('#turn-info') === 'Waiting for someone to join…' || host.get('player2ID'), 'Mancala online: the host waits for a player');
  await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
  check(guest.text('#reset-btn') === 'Host can restart', "Mancala online: the joiner's Reset says only the host can restart");
  const settled = () => !host.get('sowingNow') && !guest.get('sowingNow') && host.get('board.join()') === guest.get('board.join()');
  host.click('#pit-2');               // extra turn
  await until(settled, 5000);
  host.click('#pit-0');               // now Player 2's turn
  await until(() => settled() && guest.get('currentPlayer') === 1, 5000);
  check(guest.get('currentPlayer') === 1 && guest.text('#turn-info') === 'YOUR TURN', "Mancala online: after the host's turn it's the joiner's turn");
  guest.click('#pit-9');
  await until(() => settled() && host.get('currentPlayer') === 0, 5000);
  check(settled() && stones(host) === 48, 'Mancala online: both phones show the same board after each move', host.get('board.join()') + ' | ' + guest.get('board.join()'));
});

// =====================================================================
for (const t of tests) {
  if (only && !t.name.includes(only)) continue;
  console.log(`\n--- ${t.name} ---`);
  try { await t.fn(); }
  catch (e) { check(false, `${t.name} ran to the end`, e.stack || String(e)); }
  for (const p of opened) {
    check(p.errors.length === 0, `${t.name}: no script errors on the page`, p.errors.slice(0, 3).join(' | '));
    p.w.close();
  }
  opened.length = 0;
}
console.log(failures ? `\n${failures} check(s) failed` : `\nAll ${step} checks passed`);
process.exit(failures ? 1 : 0);
