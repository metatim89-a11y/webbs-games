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
