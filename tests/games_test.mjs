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
const conns = [];
class FakeConn extends Emitter {
  constructor(peerId) { super(); this.peer = peerId; this.open = false; this.other = null; conns.push(this); }
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
    // Like PeerJS: nobody has that id, so this peer reports 'peer-unavailable'
    if (!host) { setTimeout(() => this.emit('error', { type: 'peer-unavailable', message: 'Could not connect to peer ' + id }), 2); return mine; }
    setTimeout(() => {
      host.emit('connection', theirs);
      setTimeout(() => { mine.open = theirs.open = true; theirs.emit('open'); mine.emit('open'); }, 2);
    }, 2);
    return mine;
  }
}

// ---- One pretend phone showing one game page ----
const opened = [];
async function openGame(game, query, player = 'guest', opts = {}) {
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
      if (!opts.noPeer) w.Peer = FakePeer;
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
// Black Hole
// =====================================================================
const pieceCount = (g, who) => g.get(`board.filter(b => b && b.owner === '${who}').length`);
test('black hole vs computer', async () => {
  const g = await openGame('black-hole', 'type=cpu');
  check(g.$$('.node').length === 21 && g.$$('.num-btn').length === 10, 'Black Hole: 21 circles and your numbers 1 to 10');
  check(g.text('#bh-hint') === 'Tap a number, then an empty circle', 'Black Hole: a hint says what to do first', g.text('#bh-hint'));
  g.click(g.$$('.node')[0]);
  check(g.get('board[0]') === null && g.text('#bh-hint') === 'Pick a number first', 'Black Hole: tapping a circle before a number says "Pick a number first" instead of nothing', g.text('#bh-hint'));
  g.click(g.$$('.num-btn')[9]);
  check(g.text('#bh-hint') === 'Now tap an empty circle for your 10', 'Black Hole: after picking, the hint says where to put it', g.text('#bh-hint'));
  g.click(g.$$('.node')[0]);
  check(g.get('board[0].num') === 10 && g.$$('.node')[0].classList.contains('mine-x'), 'Black Hole: your number goes in the circle, in your colour');
  await until(() => pieceCount(g, 'O') === 1);
  check(pieceCount(g, 'O') === 1 && g.$$('.node.mine-o').length === 1, "Black Hole: the computer places one number, in its own colour");

  // Reset while the computer is thinking: only the new game's moves happen
  g.click(g.$$('.num-btn')[0]);
  g.click(g.$$('.node')[g.get('board.findIndex(b => b === null)')]);
  g.click('#reset-btn');
  await tick(80);
  check(pieceCount(g, 'X') === 0 && pieceCount(g, 'O') === 1 && g.get('currentPlayer') === 'X',
    'Black Hole: after Reset the old computer move never lands; the computer starts the new game with one move', `X ${pieceCount(g, 'X')}, O ${pieceCount(g, 'O')}`);

  // Play the whole game
  for (let i = 0; i < 40 && g.get('active'); i++) {
    await until(() => !g.get('active') || g.get('currentPlayer') === 'X');
    if (!g.get('active')) break;
    g.click(g.$$('.num-btn')[0]);
    g.click(g.$$('.node')[g.get('board.findIndex(b => b === null)')]);
    await tick(5);
  }
  check(g.modalOpen() && g.$$('.node.black-hole').length === 1, 'Black Hole: after all 20 numbers the last circle becomes the Black Hole');
  check(/ wins, \d+ to \d+$|^It's a draw, /.test(g.text('#turn-info')), 'Black Hole: the turn line shows the result and score', g.text('#turn-info'));

  // Scoring: numbers touching the Black Hole don't count
  g.run(`board = Array(21).fill(null).map((b, i) => i === 0 ? null : { num: (i % 10) + 1, owner: i % 2 ? 'X' : 'O' });
         p1Nums = []; p2Nums = []; active = false; calculateWinner();`);
  const expect = { X: 0, O: 0 };
  for (let i = 3; i < 21; i++) expect[i % 2 ? 'X' : 'O'] += (i % 10) + 1; // circles 1 and 2 touch circle 0
  check(g.text('#score-summary') === `Guest: ${expect.X} | Computer: ${expect.O}`, 'Black Hole: the two circles touching the Black Hole are left out of the score', g.text('#score-summary'));
});

test('black hole online', async () => {
  const { host, guest } = await onlineTable('black-hole');
  await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
  check(guest.text('#reset-btn') === 'Host can restart', "Black Hole online: the joiner's Reset says only the host can restart");
  const play = async (p, numIdx, node) => {
    await until(() => p.get('canMove()'));
    p.click(p.$$('.num-btn')[numIdx]);
    p.click(p.$$('.node')[node]);
  };
  await play(host, 4, 0);
  await until(() => guest.get('board[0]') && guest.get('currentPlayer') === 'O');
  await play(guest, 6, 1);
  await until(() => host.get('board[1]') && guest.get('board[1]'));
  check(host.get('board[1].num') === 7 && host.get('board[1].owner') === 'O' && guest.get('board[0].num') === 5,
    'Black Hole online: each move shows on both phones with the right owner');
  check(host.get('p2Nums.includes(7)') === false && guest.get('p2Nums.includes(7)') === false, 'Black Hole online: a used number is gone from both phones');
});

// =====================================================================
// Chutes & Ladders
// =====================================================================
// Every spin is a 4 (Math.random 0.5) and there are no hidden squares, so moves are predictable
const fixDice = g => g.run('Math.random = () => 0.5; hiddenSpecials = {};');
test('chutes and ladders vs computer', async () => {
  const g = await openGame('chutes-and-ladders', 'type=cpu');
  check(g.get('typeof (window.AudioManager && window.AudioManager.play)') === 'function', 'Chutes & Ladders: the game sounds exist now (they were silent)');
  fixDice(g);
  g.click('#roll-btn');
  await until(() => g.get('currentPlayer') === 'O');
  check(g.get('p1Pos') === 14, 'Chutes & Ladders: a 4 from the start lands on 4 and climbs the ladder to 14', g.get('p1Pos'));
  check(g.$('#roll-btn').disabled && g.text('#roll-btn') === 'Wait for your turn', "Chutes & Ladders: SPIN says to wait during the computer's turn", g.text('#roll-btn'));
  await until(() => g.get('currentPlayer') === 'X' && !g.get('rollingNow'), 5000);
  check(g.get('p2Pos') === 14, 'Chutes & Ladders: the computer spins on its own turn', g.get('p2Pos'));

  // Reset in the middle of a spin
  g.click('#roll-btn');
  await tick(10);
  g.click('#reset-btn');
  check(g.get('p1Pos') === 0 && g.get('p2Pos') === 0 && !g.get('rollingNow'), 'Chutes & Ladders: Reset during a spin really starts a new game (it used to do nothing)', `${g.get('p1Pos')} / ${g.get('p2Pos')}`);
  await until(() => g.get('currentPlayer') === 'X' && !g.get('rollingNow'), 5000);
  await tick(50);
  check(g.get('p1Pos') === 0 && g.get('p2Pos') === 14, "Chutes & Ladders: after Reset the computer only takes its own spin, never yours", `${g.get('p1Pos')} / ${g.get('p2Pos')}`);

  // Needing an exact roll, then winning
  g.run('p1Pos = 98; movePawn("p1", 98);');
  g.click('#roll-btn');
  await until(() => g.text('#game-info').startsWith('Need'));
  check(g.text('#game-info') === 'Need exactly 2 to reach 100', 'Chutes & Ladders: too big a roll near 100 says what number is needed', g.text('#game-info'));
  await until(() => g.get('currentPlayer') === 'X' && !g.get('rollingNow'), 5000);
  check(g.get('p1Pos') === 98, 'Chutes & Ladders: ...and the pawn stays put');
  g.run('p1Pos = 96;');
  g.click('#roll-btn');
  await until(() => !g.get('active'), 5000);
  check(g.modalOpen() && g.text('#turn-info') === 'Guest wins!', 'Chutes & Ladders: landing on 100 wins, and the turn line says so', g.text('#turn-info'));
});

test('chutes and ladders online', async () => {
  const { host, guest } = await onlineTable('chutes-and-ladders');
  check(host.text('#roll-btn') === 'Wait for a player' || host.get('player2ID'), 'Chutes & Ladders online: the host waits for a player');
  await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
  fixDice(host); fixDice(guest);
  check(guest.text('#reset-btn') === 'Host can restart', "Chutes & Ladders online: the joiner's Reset says only the host can restart (it did nothing before)");
  await until(() => host.get('canMove()'));
  host.click('#roll-btn');
  await until(() => guest.get('p1Pos') === 14 && guest.get('currentPlayer') === 'O' && !guest.get('rollingNow'), 5000);
  check(guest.get('p1Pos') === 14, "Chutes & Ladders online: the host's spin moves their pawn on the joiner's phone too");
  guest.click('#roll-btn');
  await until(() => host.get('p2Pos') === 14 && host.get('currentPlayer') === 'X' && !host.get('rollingNow'), 5000);
  check(host.get('p2Pos') === 14 && guest.get('p2Pos') === 14, "Chutes & Ladders online: the joiner's spin shows on both phones");
});

// =====================================================================
// Sorry
// =====================================================================
// Every roll is a 1 (Math.random 0.1), so a pawn can always leave Start and moves are predictable
const rollOnes = g => g.run('Math.random = () => 0.1;');
const sorryIdle = g => !g.get('isMoving') && !g.get('isRolling');
test('sorry vs computer', async () => {
  const g = await openGame('sorry', 'type=cpu');
  rollOnes(g);
  check(!g.$('#dice-container').classList.contains('disabled') && g.text('#dice-label') === 'Guest: tap to roll', 'Sorry: on your turn the dice is bright and says tap to roll', g.text('#dice-label'));
  g.click('#dice-container');
  await until(() => g.get('currentRoll') === 1);
  check(g.text('#game-info') === 'You rolled a 1! Tap a glowing pawn to move it.', 'Sorry: after your roll it says what to do next', g.text('#game-info'));
  check(g.$('#pawn-p1-0').classList.contains('selectable') && g.text('#dice-label') === 'Tap a glowing pawn', 'Sorry: ...and your pawns that can move glow');
  g.click('#pawn-p1-0');
  await until(() => g.get('currentPlayer') === 'O' && sorryIdle(g));
  check(g.get('p1Pawns[0]') === 2, 'Sorry: a 1 takes your pawn out of Start', g.get('p1Pawns[0]'));
  check(g.$('#dice-container').classList.contains('disabled') && g.text('#dice-label') === "Computer's turn", "Sorry: on the computer's turn the dice greys out and says whose turn it is (it looked tappable before)", g.text('#dice-label'));
  await until(() => g.text('#game-info').startsWith('Computer rolled'), 3000);
  check(g.text('#game-info') === 'Computer rolled a 1.', "Sorry: the computer's roll says who rolled (it used to tell you to pick a pawn)", g.text('#game-info'));
  await until(() => g.get('currentPlayer') === 'X' && sorryIdle(g), 3000);
  check(g.get('p2Pawns[0]') === 28 && g.get('p1Pawns[0]') === 2, 'Sorry: the computer moves its own pawn on its turn');

  // Reset while your pawn is still moving
  g.click('#dice-container');
  await until(() => g.get('currentRoll') === 1);
  g.click('#pawn-p1-0');
  check(g.get('isMoving'), 'Sorry: (your pawn is on its way)');
  g.click('#reset-btn');
  check(g.get('p1Pawns.every(p => p === -1) && p2Pawns.every(p => p === -1)') && !g.get('isMoving'), 'Sorry: Reset in the middle of a move starts a new game (it used to do nothing)', `${g.get('p1Pawns')} / ${g.get('p2Pawns')}`);
  await until(() => g.get('currentPlayer') === 'X' && sorryIdle(g), 3000);
  await tick(30);
  check(g.get('p1Pawns.every(p => p === -1)') && g.get('p2Pawns[0]') === 28, 'Sorry: the half-done move never lands on the new board, and the computer only takes its own turn', `${g.get('p1Pawns')} / ${g.get('p2Pawns')}`);

  // Finishing the last pawn wins
  g.run('p1Pawns = [106, 106, 106, 105]; render();');
  g.click('#dice-container');
  await until(() => g.get('currentRoll') === 1);
  g.click('#pawn-p1-3');
  await until(() => !g.get('active'), 3000);
  check(g.modalOpen() && g.text('#turn-info') === 'Guest wins!', 'Sorry: getting all four pawns home wins, and the turn line says so', g.text('#turn-info'));
  check(g.$('#dice-container').classList.contains('disabled'), 'Sorry: ...and the dice greys out until Play Again');
});

test('sorry roll with no move', async () => {
  const g = await openGame('sorry', 'type=cpu');
  g.run('Math.random = () => 0.7;'); // every roll is a 5
  g.click('#dice-container');
  await until(() => g.get('currentRoll') === 5);
  check(g.text('#game-info') === 'You rolled a 5. It takes a 1 or 2 to leave Start.' && g.text('#dice-label') === 'Turn passes…', 'Sorry: a roll with no move says who rolled and why (it said "Tap a glowing pawn" with nothing to tap)', `${g.text('#game-info')} / ${g.text('#dice-label')}`);
  await until(() => g.get('currentPlayer') === 'X' && g.text('#game-info').startsWith('Computer'), 3000);
  check(g.text('#game-info') === 'Computer rolled a 5. It takes a 1 or 2 to leave Start.', "Sorry: ...and the computer's turn says the same, so you know whose turn was passed", g.text('#game-info'));
});

test('sorry online', async () => {
  const host = await openGame('sorry', 'type=online&role=host', 'tim');
  await until(() => host.get('NetworkManager.roomID') && host.get('NetworkManager.peer'));
  rollOnes(host);
  host.click('#dice-container');
  await tick(20);
  check(host.get('currentRoll') === null && host.text('#dice-label') === 'Waiting for a player', 'Sorry online: the host can\'t roll before anyone joins (it could, and the game ran with nobody there)', host.text('#dice-label'));
  const guest = await openGame('sorry', `type=online&role=client&host=${host.get('NetworkManager.roomID')}`, 'ariel');
  await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
  await tick(20);
  rollOnes(guest);
  check(guest.text('#reset-btn') === 'Host can restart', "Sorry online: the joiner's Reset says only the host can restart (it did nothing before)", guest.text('#reset-btn'));
  check(guest.$('#dice-container').classList.contains('disabled') && guest.text('#dice-label') === "Tim's turn", "Sorry online: the joiner's dice is grey on the host's turn", guest.text('#dice-label'));
  host.click('#dice-container');
  await until(() => host.get('currentRoll') === 1 && guest.get('currentRoll') === 1);
  check(guest.text('#game-info') === 'Tim rolled a 1.', "Sorry online: the joiner sees who rolled", guest.text('#game-info'));
  host.click('#pawn-p1-0');
  await until(() => guest.get('currentPlayer') === 'O' && sorryIdle(guest) && host.get('currentPlayer') === 'O', 3000);
  check(guest.get('p1Pawns[0]') === 2, "Sorry online: the host's move shows on the joiner's phone");
  // A made-up roll from the joining phone is ignored
  guest.run("NetworkManager.sendMove({ type: 'ROLL', roll: 9 })");
  await tick(30);
  check(host.get('currentRoll') === null, 'Sorry online: the host ignores a roll that isn\'t 1 to 6', host.get('currentRoll'));
  guest.click('#dice-container');
  await until(() => guest.get('currentRoll') === 1 && host.get('currentRoll') === 1, 3000);
  guest.click('#pawn-p2-0');
  await until(() => host.get('currentPlayer') === 'X' && sorryIdle(host) && sorryIdle(guest), 3000);
  check(host.get('p2Pawns[0]') === 28 && guest.get('p2Pawns[0]') === 28, "Sorry online: the joiner's move shows on both phones");
});

// =====================================================================
// Uno No Mercy
// =====================================================================
const C = (color, value) => ({ color, value });
const setHand = (g, cards, more = '') => g.run(`myHand = ${JSON.stringify(cards)}; ${more} render();`);
// Tap the card in this phone's hand with that value (and colour)
function tapCard(g, value, color) {
  const i = g.get(`myHand.findIndex(c => c.value === ${JSON.stringify(value)}${color ? ` && c.color === '${color}'` : ''})`);
  g.click(g.$$('#player-hand .card')[i]);
}
const pickerOpen = g => g.$('#color-picker-modal').style.display === 'flex';
test('uno vs computer', async () => {
  const g = await openGame('uno-no-mercy', 'type=cpu');
  setHand(g, [C('red', '5'), C('blue', '9'), C('wild', 'Wild'), C('wild', 'Wild Color Roulette'), C('green', '8')],
    `discard = ${JSON.stringify(C('red', '3'))}; cpuHand = ${JSON.stringify([C('blue', '1'), C('blue', '2'), C('yellow', '4')])};`);
  const cards = g.$$('#player-hand .card');
  check(cards[0].classList.contains('big') && cards[3].classList.contains('small'), 'Uno: long card names like Wild Color Roulette get smaller text so they fit on the card');

  // The colour picker
  tapCard(g, 'Wild');
  check(pickerOpen(g) && g.text('#color-picker-title') === 'Pick a color', 'Uno: tapping a wild card opens the colour picker');
  tapCard(g, '5', 'red');
  check(g.get('discard.value') === '3' && g.get('myHand.length') === 5, 'Uno: while the colour picker is open, another card can\'t be played (it could, and then the colour went on the wrong card)', `${g.get('discard.value')} / ${g.get('myHand.length')}`);
  g.click('#color-cancel');
  check(!pickerOpen(g) && g.get('myHand.length') === 5 && g.get('currentPlayer') === 'X', 'Uno: Cancel closes the colour picker and keeps the card in your hand');
  tapCard(g, 'Wild');
  g.click('.color-opt.color-blue');
  check(g.get('discard.color') === 'blue' && g.get('discard.value') === 'Wild' && g.get("!myHand.some(c => c.value === 'Wild')"), 'Uno: picking a colour plays the wild card you tapped, in that colour');
  check(g.$$('#player-hand .card').every(c => c.classList.contains('off')) && g.$('#deck').classList.contains('off'), "Uno: on the computer's turn your cards and the deck are faded (they looked playable)");
  await until(() => g.get('currentPlayer') === 'X' && g.get('cpuHand.length') === 2, 3000);

  // Color Roulette: one colour pick, then the computer draws until it gets that colour
  tapCard(g, 'Wild Color Roulette');
  check(g.text('#color-picker-title') === 'Pick a color: they draw until they get it', 'Uno: Color Roulette says what the colour is for');
  g.click('.color-opt.color-green');
  check(!pickerOpen(g) && g.get('rouletteTarget') === 'green' && g.get('discard.color') === 'green', 'Uno: Color Roulette asks for a colour once (it asked twice)', `${pickerOpen(g)} / ${g.get('rouletteTarget')}`);
  await until(() => g.get('currentPlayer') === 'X' && !g.get('rouletteTarget'), 3000);
  check(g.get('cpuHand[cpuHand.length - 1].color') === 'green', '...and the computer draws until it gets that colour');

  // The deck shows how many cards a draw stack makes you take
  g.run('drawStack = 4; render();');
  check(g.text('#deck') === 'DRAW +4', 'Uno: the deck shows DRAW +4 when you have to take 4', g.text('#deck'));
  g.run('drawStack = 0;');

  // Playing your last card wins
  setHand(g, [C('green', '5')], `discard = ${JSON.stringify(C('green', '3'))};`);
  tapCard(g, '5');
  await until(() => !g.get('active'));
  check(g.modalOpen() && g.text('#turn-info') === 'Guest wins!', 'Uno: emptying your hand wins, and the turn line says so', g.text('#turn-info'));
});

test('uno pass the phone', async () => {
  const g = await openGame('uno-no-mercy', 'type=local');
  setHand(g, [C('red', 'Reverse'), C('red', '1')], `discard = ${JSON.stringify(C('red', '3'))};`);
  tapCard(g, 'Reverse');
  check(g.get('currentPlayer') === 'X' && !g.get('handHidden'), 'Uno (one phone): a Reverse lets you go again, same as a Skip (it passed the turn)');
});

test('uno online', async () => {
  const host = await openGame('uno-no-mercy', 'type=online&role=host', 'tim');
  await until(() => host.get('NetworkManager.roomID') && host.get('NetworkManager.peer'));
  check(!host.get('canMove()') && host.$('#deck').classList.contains('off') && host.text('#turn-info') === 'Waiting for someone to join…', "Uno online: the host can't play before anyone joins", host.text('#turn-info'));
  const guest = await openGame('uno-no-mercy', `type=online&role=client&host=${host.get('NetworkManager.roomID')}`, 'ariel');
  await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
  await tick(20);
  check(guest.text('#reset-btn') === 'Host can restart', "Uno online: the joiner's Reset says only the host can restart (it did nothing before)", guest.text('#reset-btn'));

  // Known cards on both phones
  setHand(host, [C('red', '5'), C('blue', '1'), C('red', 'Draw 2'), C('yellow', '6')],
    `currentPlayer = 'X'; discard = ${JSON.stringify(C('red', '3'))}; opponentHandCount = 2; broadcast();`);
  setHand(guest, [C('blue', '9'), C('blue', '8')], `deck.push(${JSON.stringify(C('red', '4'))}, ${JSON.stringify(C('green', '2'))});`);
  await tick(10);
  tapCard(host, '5', 'red');
  await until(() => guest.get('currentPlayer') === 'O' && guest.get('discard.value') === '5');
  guest.click('#deck'); // draws green 2, then red 4 (which can be played)
  await until(() => host.get('opponentHandCount') === 4, 1500);
  check(guest.get('myHand.length') === 4, "Uno online: the cards Player 2 draws go into Player 2's hand (they went into the host's hand)", guest.get('myHand.length'));
  check(host.get('myHand.length') === 3 && host.get('opponentHandCount') === 4, "Uno online: ...the host's hand stays the same, and the host keeps count of Player 2's cards", `${host.get('myHand.length')} / ${host.get('opponentHandCount')}`);
  tapCard(guest, '4', 'red');
  await until(() => host.get('discard.value') === '4' && host.get('currentPlayer') === 'X');
  check(host.get('opponentHandCount') === 3, "Uno online: the host's count goes down when Player 2 plays", host.get('opponentHandCount'));

  // A draw card: Player 2 takes the cards into their own hand
  tapCard(host, 'Draw 2');
  await until(() => guest.get('drawStack') === 2 && guest.get('currentPlayer') === 'O');
  check(guest.text('#deck') === 'DRAW +2', 'Uno online: Player 2 sees DRAW +2', guest.text('#deck'));
  guest.click('#deck');
  await until(() => host.get('currentPlayer') === 'X' && host.get('drawStack') === 0);
  check(guest.get('myHand.length') === 5 && host.get('myHand.length') === 2 && host.get('opponentHandCount') === 5, 'Uno online: a Draw 2 puts 2 cards in Player 2\'s hand, not the host\'s', `${guest.get('myHand.length')} / ${host.get('myHand.length')} / ${host.get('opponentHandCount')}`);

  // Mercy rule for Player 2: 25 cards ends the game on both phones
  setHand(guest, Array.from({ length: 23 }, () => C('blue', '9')));
  host.run('opponentHandCount = 23;');
  setHand(host, [C('red', 'Draw 2'), C('blue', '1')]);
  tapCard(host, 'Draw 2');
  await until(() => guest.get('drawStack') === 2 && guest.get('currentPlayer') === 'O');
  guest.click('#deck');
  await until(() => !host.get('active'), 1500);
  check(!host.get('active') && host.text('#turn-info') === 'Tim wins! (Mercy rule)', "Uno online: when Player 2 reaches 25 cards the host's game ends too (it kept going)", host.text('#turn-info'));
  check(guest.modalOpen() && !guest.get('active'), '...and Player 2 sees the game is over');

  // Play Again deals Player 2 a new hand
  host.run('resetGame()');
  await until(() => guest.get('myHand.length') === 7, 1500);
  check(guest.get('myHand.length') === 7 && !guest.modalOpen() && host.get('opponentHandCount') === 7, 'Uno online: Play Again deals Player 2 a fresh hand of 7 (they kept their old cards)', guest.get('myHand.length'));

  // A 7 swaps hands, and the host's count follows
  setHand(host, [C('red', '7'), C('blue', '1'), C('blue', '2')], `currentPlayer = 'X'; discard = ${JSON.stringify(C('red', '3'))}; opponentHandCount = 4; broadcast();`);
  setHand(guest, [C('green', '1'), C('green', '2'), C('green', '3'), C('green', '4')]);
  await tick(10);
  tapCard(host, '7', 'red');
  await until(() => host.get('myHand.length') === 4 && guest.get('myHand.length') === 2);
  check(host.get('opponentHandCount') === 2, "Uno online: after a 7 swaps hands, the host's count of Player 2's cards is right (it kept the old number)", host.get('opponentHandCount'));
});

// =====================================================================
// Lobby (the front page): join box and sign-up messages. Nothing is sent anywhere.
// =====================================================================
async function openLobby() {
  let html = readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="([\w-]+\.js)(\?v=[^"]*)?"><\/script>/g,
    (m, file) => `<script>${readFileSync(path.join(root, file), 'utf8')}</script>`);
  const errors = [], alerts = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && (e.detail || e.message || e))));
  const dom = new JSDOM(html, {
    url: 'https://wubs.test/webbs-games/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.alert = msg => alerts.push(String(msg));
      w.Peer = FakePeer;
      w.scrollTo = () => {};
      Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
        configurable: true, get() { return this.textContent; }, set(v) { this.textContent = v; }
      });
    }
  });
  const w = dom.window;
  await new Promise(r => w.document.readyState === 'complete' ? r() : w.addEventListener('load', r));
  await tick(5);
  const p = { w, errors, alerts, $: sel => w.document.querySelector(sel), run: code => w.eval(code),
    text: sel => (w.document.querySelector(sel)?.textContent || '').trim() };
  opened.push(p);
  return p;
}
const typeInto = (p, sel, value) => { const el = p.$(sel); el.value = value; el.dispatchEvent(new p.w.Event('input', { bubbles: true })); return el.value; };
test('lobby join box and sign-up messages', async () => {
  const p = await openLobby();
  p.run('joinTablePrompt()');
  check(typeInto(p, '#join-table-pin', 'a1b2c3d') === '123', 'Lobby: the Table PIN box keeps only digits', p.$('#join-table-pin').value);
  check(typeInto(p, '#join-table-pin', '123456') === '1234', 'Lobby: ...and stops at 4 digits', p.$('#join-table-pin').value);
  typeInto(p, '#join-table-pin', '12');
  p.run('performAutoJoin()');
  check(p.alerts.length === 0 && p.text('#join-status') === "Type the 4-digit PIN from the host's screen.", 'Lobby: a short PIN gets a message in the box, not a pop-up', p.alerts.join(' | ') || p.text('#join-status'));
  p.run('openSignup()');
  await p.run('submitSignup()');
  check(p.alerts.length === 0 && p.text('#signup-status') === 'Fill in your name, favorite animal and favorite game.', 'Lobby: an empty Request Profile form says what\'s missing in the form, not a pop-up', p.alerts.join(' | ') || p.text('#signup-status'));
});

// =====================================================================
// Every game: a phone leaves an online table (closed the page, lost signal, phone slept)
// =====================================================================
const TITLES = { 'tic-tac-toe': 'Tic-Tac-Toe', '357': '357', 'mancala': 'Mancala', 'black-hole': 'Black Hole',
  'chutes-and-ladders': 'Chutes & Ladders', 'sorry': 'Sorry', 'uno-no-mercy': 'Uno No Mercy' };
for (const [game, title] of Object.entries(TITLES)) {
  test(`${game} player leaves`, async () => {
    const { host, guest } = await onlineTable(game);
    await until(() => guest.get('myRole') === 'player2' && host.get('player2ID'));
    const pin = host.get('NetworkManager.roomID');
    guest.run('NetworkManager.conn.close()');
    await until(() => /left/.test(host.text('#turn-info')));
    check(new RegExp(`left\\. They can rejoin with PIN ${pin}`).test(host.text('#turn-info')),
      `${title}: when Player 2's phone leaves, the host's phone says so and how to get back in (it kept waiting for their turn)`, host.text('#turn-info'));
    await until(() => guest.$('#net-notice'));
    check(/Lost connection/.test(guest.text('#net-notice')) && guest.alerts.length === 0,
      `${title}: the phone that lost the link says so on the page, not in a pop-up`, guest.alerts.join(' | '));
    const back = await openGame(game, `type=online&role=client&host=${pin}`, 'cassie');
    await until(() => back.get('myRole') === 'player2' && host.get('player2ID') === 'cassie', 4000);
    check(back.get('myRole') === 'player2' && host.get('player2ID') === 'cassie',
      `${title}: someone can take the empty seat with the same PIN`);
    await until(() => !/left/.test(host.text('#turn-info')));
    check(!/left|Waiting for someone/.test(host.text('#turn-info')), `${title}: the host's turn line is back to normal`, host.text('#turn-info'));
    if (game === 'uno-no-mercy') {
      await until(() => host.get('opponentHandCount') === 7 && back.get('myHand.length') === 7);
      check(host.get('opponentHandCount') === 7 && back.get('myHand.length') === 7,
        "Uno No Mercy: a new player at the table gets a fresh deal, and the host's count of their cards matches",
        `${host.get('opponentHandCount')} vs ${back.get('myHand.length')}`);
    }
  });
}

test('online play without the network script', async () => {
  const g = await openGame('tic-tac-toe', 'type=online&role=host', 'tim', { noPeer: true });
  await until(() => g.$('#net-notice'));
  check(/Couldn't load online play/.test(g.text('#net-notice')), 'Online table: when the online-play script fails to load, the page says so (it showed nothing)', g.errors.join(' | '));
  g.errors.length = 0;
  const c = await openGame('tic-tac-toe', 'type=cpu', 'guest', { noPeer: true });
  c.click(c.$$('.cell')[4]);
  check(c.get('board[4]') === 'X', "Vs computer: still plays when the online-play script didn't load");
});

test('joining a PIN nobody is hosting', async () => {
  const g = await openGame('tic-tac-toe', 'type=online&role=client&host=4321', 'ariel');
  await until(() => g.$('#net-notice'), 3000);
  check(/No table with PIN 4321/.test(g.text('#net-notice')) && g.alerts.length === 0,
    'Joining: a PIN nobody is hosting says so right away on the page (it waited 15 seconds, then a pop-up)', g.alerts.join(' | ') || g.text('#net-notice'));
});

// =====================================================================
for (const t of tests) {
  if (only && !t.name.includes(only)) continue;
  console.log(`\n--- ${t.name} ---`);
  try { await t.fn(); }
  catch (e) { check(false, `${t.name} ran to the end`, e.stack || String(e)); }
  // Hang up every pretend connection first, so no message arrives at a page after it's closed
  conns.forEach(c => { c.open = false; });
  conns.length = 0;
  peers.clear();
  for (const p of opened) {
    check(p.errors.length === 0, `${t.name}: no script errors on the page`, p.errors.slice(0, 3).join(' | '));
    p.w.close();
  }
  opened.length = 0;
}
console.log(failures ? `\n${failures} check(s) failed` : `\nAll ${step} checks passed`);
process.exit(failures ? 1 : 0);
