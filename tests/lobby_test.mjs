// Lobby, "Who's playing?", Game Lobby tables, invites, chat controls and help, on pretend phones.
// Every page runs in jsdom with the site's real scripts. A pretend PeerJS joins the phones (like
// tests/games_test.mjs), and a pretend family server stands in for Firebase: one shared in-memory
// database that every pretend phone reads and writes, so a table one phone hosts shows on another.
// Nothing here touches the real family server.
//   npm install --no-save jsdom      (once)
//   node tests/lobby_test.mjs
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
async function until(cond, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (cond()) return true; } catch (e) {} await tick(5); }
  return false;
}

// ---- Pretend PeerJS ----
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
    if (!host) { setTimeout(() => this.emit('error', { type: 'peer-unavailable' }), 2); return mine; }
    setTimeout(() => {
      host.emit('connection', theirs);
      setTimeout(() => { mine.open = theirs.open = true; theirs.emit('open'); mine.emit('open'); }, 2);
    }, 2);
    return mine;
  }
}

// ---- Pretend family server (the parts of Firebase the site uses) ----
// oldRules: the family server still has the rules from before Nov 26, when only approved family could read open tables
const world = { data: {}, listeners: [], oldRules: false };
function resetWorld() {
  world.listeners = [];
  world.oldRules = false;
  world.data = {
    uids: { 'u-tim': 'tim', 'u-ariel': 'ariel', 'u-zed': 'zed' },
    players: {
      tim: { name: 'Tim', approved: true, uid: 'u-tim' },
      ariel: { name: 'Ariel', approved: true, uid: 'u-ariel' },
      zed: { name: 'Zed', approved: false, uid: 'u-zed' },
    },
    admins: { 'u-tim': true },
  };
}
const parts = p => String(p || '').split('/').filter(Boolean);
function read(p) { let n = world.data; for (const k of parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; }
function write(p, v) {
  const ks = parts(p); let n = world.data;
  for (const k of ks.slice(0, -1)) { if (typeof n[k] !== 'object' || n[k] === null) n[k] = {}; n = n[k]; }
  const last = ks.at(-1);
  if (v === null || v === undefined) delete n[last]; else n[last] = structuredClone(v);
  // Like Firebase, a spot left empty disappears
  for (let i = ks.length - 1; i > 0; i--) {
    const up = read(ks.slice(0, i).join('/'));
    if (up && typeof up === 'object' && !Object.keys(up).length) { const pp = read(ks.slice(0, i - 1).join('/')) || world.data; delete pp[ks[i - 1]]; } else break;
  }
  // Tell everyone watching this spot, anything under it, or anything above it
  world.listeners.filter(l => l.path === p || l.path.startsWith(p + '/') || p.startsWith(l.path + '/') || l.path === '')
    .forEach(l => setTimeout(() => world.listeners.includes(l) && l.fn(snap(l.path)), 1));
}
let pushCount = 0;
function snap(p) {
  const v = read(p);
  return {
    key: parts(p).at(-1) || null,
    val: () => (v === null ? null : structuredClone(v)),
    exists: () => v !== null,
    forEach(cb) { if (v && typeof v === 'object') for (const k of Object.keys(v).sort()) { if (cb(snap(p + '/' + k)) === true) break; } },
    ref: ref(p),
  };
}
const approvedUid = uid => !!(uid && (world.data.admins || {})[uid] || (read(`players/${read(`uids/${uid}`)}`) || {}).approved);
function ref(p, who = () => null) {
  p = parts(p).join('/');
  const r = {
    key: parts(p).at(-1) || null,
    get: async () => snap(p),
    set: async v => write(p, v),
    update: async v => { for (const [k, x] of Object.entries(v)) write(p + '/' + k, x); },
    remove: async () => write(p, null),
    push(v) { const key = 'k' + String(++pushCount).padStart(5, '0'); const child = ref(p + '/' + key, who); if (v !== undefined) write(p + '/' + key, v); return Object.assign(Promise.resolve(child), child); },
    child: k => ref(p + '/' + k, who),
    on(ev, fn, onErr) {
      if (world.oldRules && p === 'tables' && !approvedUid(who())) { setTimeout(() => onErr && onErr({ code: 'PERMISSION_DENIED' }), 1); return fn; }
      const l = { path: p, fn }; world.listeners.push(l); setTimeout(() => world.listeners.includes(l) && fn(snap(p)), 1); return fn;
    },
    off(ev, fn) { world.listeners = world.listeners.filter(l => !(l.path === p && (!fn || l.fn === fn))); },
    onDisconnect: () => ({ remove() {}, set() {} }),
    limitToLast: () => r, orderByChild: () => r, orderByKey: () => r,
  };
  return r;
}
function fakeFirebase(uid) {
  const auth = {
    currentUser: uid ? { uid } : null,
    setPersistence: async () => {},
    onAuthStateChanged(fn) { setTimeout(() => fn(this.currentUser), 1); },
    async signOut() { this.currentUser = null; },
    async signInWithEmailAndPassword() { throw { code: 'auth/wrong-password' }; },
  };
  const fb = {
    apps: [],
    initializeApp() { fb.apps.push({}); },
    auth: Object.assign(() => auth, { Auth: { Persistence: { SESSION: 'session' } } }),
    database: Object.assign(() => ({ ref: p => ref(p, () => auth.currentUser && auth.currentUser.uid) }), { ServerValue: { get TIMESTAMP() { return Date.now(); } } }),
  };
  return fb;
}

// ---- One pretend phone showing one page ----
const opened = [];
async function openPage(page, query = '', player = 'guest', opts = {}) {
  const file = page === 'lobby' ? 'index.html' : page === 'games' ? 'games.html' : `games/${page}/index.html`;
  let html = readFileSync(path.join(root, file), 'utf8');
  html = html.replace(/<script src="https?:[^"]*"><\/script>/g, '');
  html = html.replace(/<script src="(?:\.\.\/\.\.\/)?([\w-]+\.js)(\?v=[^"]*)?"><\/script>/g,
    (m, f) => `<script>${readFileSync(path.join(root, f), 'utf8')}</script>`);
  const errors = [], went = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const t = String(e && (e.detail || e.message || e)); if (!/navigation/i.test(t)) errors.push(t); });
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(html, {
    url: `https://wubs.test/webbs-games/${file}?${query}`,
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const real = w.setTimeout.bind(w);
      w.setTimeout = (fn, ms = 0, ...a) => real(fn, Math.ceil(ms / SPEED), ...a);
      w.alert = () => {}; w.confirm = () => true; w.prompt = () => null; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      if (!opts.noPeer) w.Peer = FakePeer;
      if (opts.uid !== undefined) w.firebase = fakeFirebase(opts.uid);
      Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
        configurable: true, get() { return this.textContent; }, set(v) { this.textContent = v; }
      });
      if (player) w.sessionStorage.setItem('webbs_active_player', player);
      Object.entries(opts.local || {}).forEach(([k, v]) => w.localStorage.setItem(k, v));
      w.localStorage.setItem('webbs_help_seen', JSON.stringify(opts.seen || { 'tic-tac-toe': 1, '357': 1, mancala: 1, 'black-hole': 1, 'chutes-and-ladders': 1, sorry: 1, 'uno-no-mercy': 1 }));
      if (!opts.tour) w.localStorage.setItem('webbs_tour_done', '1');
    }
  });
  const w = dom.window;
  await new Promise(r => w.document.readyState === 'complete' ? r() : w.addEventListener('load', r));
  await tick(10);
  // Where a tap leads: the picker and the lobby both send page changes through one function
  if (w.SeatPicker) w.SeatPicker.navigate = url => went.push(url);
  w.eval('typeof goTo === "function" && (goTo = url => window.__went.push(url))');
  w.__went = went;
  const p = {
    w, errors, went,
    $: sel => w.document.querySelector(sel),
    $$: sel => [...w.document.querySelectorAll(sel)],
    get: expr => w.eval(expr),
    text: sel => (w.document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim(),
    click: sel => { const el = typeof sel === 'string' ? w.document.querySelector(sel) : sel; if (!el) throw new Error('nothing to tap: ' + sel); el.click(); },
    shown: sel => { const el = w.document.querySelector(sel); if (!el) return false; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { if (n.hidden || n.style.display === 'none') return false; } return true; },
  };
  opened.push(p);
  return p;
}
function closeAll() { opened.splice(0).forEach(p => { try { p.w.close(); } catch (e) {} }); peers.clear(); }

const GAMES = ['tic-tac-toe', '357', 'mancala', 'black-hole', 'chutes-and-ladders', 'sorry', 'uno-no-mercy'];
const TITLES = { 'tic-tac-toe': 'Tic-Tac-Toe', '357': '357 (Nim)', mancala: 'Mancala', 'black-hole': 'Black Hole', 'chutes-and-ladders': 'Chutes & Ladders', sorry: 'Sorry!', 'uno-no-mercy': 'Uno No Mercy' };
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const noErrors = (p, label) => check(p.errors.length === 0, `${label}: no script errors on the page`, p.errors.slice(0, 2).join(' | '));

// =====================================================================
// Who's playing? (games list)
// =====================================================================
test('picker: every game and every choice', async () => {
  const g = await openPage('games', 'player=guest', 'guest', { uid: null });
  check(g.$$('#game-list .game-card').length === 7, 'Games list: one card for each of the 7 games');
  check(g.$('.app-bar .back-btn') && g.$('.app-bar .bar-tools #help-btn') && g.$('.app-bar .bar-tools #sound-btn'),
    'Games list: the same top bar as the lobby and the games (Back, ❓ Help, 🔊)');
  for (const game of GAMES) {
    g.click(`[data-game="${game}"]`);
    check(g.$('#seat-picker').style.display === 'flex' && g.text('#seat-title') === TITLES[game] && g.$$('#seat-two .seat-opt').length === 3,
      `${TITLES[game]}: tapping it asks who's playing, with Computer, Someone here and Online player`);
    for (const [choice, type] of [['cpu', 'type=cpu'], ['local', 'type=local'], ['online', 'type=online&role=host&list=0']]) {
      g.click(`[data-game="${game}"]`);
      g.click(`#seat-two [data-choice="${choice}"]`);
      g.click('#seat-start');
      const url = g.went.at(-1) || '';
      check(url.endsWith(`games/${game}/index.html?player=guest&${type}`), `${TITLES[game]} · ${choice}: opens the game with the right players`, url);
    }
  }
  g.click('[data-game="sorry"]');
  g.click('#seat-two [data-choice="online"]');
  await until(() => g.$('#seat-list-note').textContent.includes('Guests'));
  const lobbyOpt = g.$('#seat-list [data-listed="1"]');
  check(lobbyOpt.disabled && g.$('#seat-list [data-listed="0"]').getAttribute('aria-checked') === 'true',
    'Guest online: Family lobby is greyed out and Invite only is picked');
  check(g.text('#seat-list-note').length > 10, 'Guest online: the picker says why the Family lobby is greyed out', g.text('#seat-list-note'));
  g.click('#seat-cancel');
  check(g.$('#seat-picker').style.display === 'none', 'Cancel closes the picker');
  noErrors(g, 'games list');
});

test('picker: approved family can list a table', async () => {
  resetWorld();
  const g = await openPage('games', 'player=tim&mode=online', 'tim', { uid: 'u-tim' });
  g.click('[data-game="mancala"]');
  await until(() => !g.$('#seat-list [data-listed="1"]').disabled);
  check(g.$('#seat-two [data-choice="online"]').getAttribute('aria-checked') === 'true' && !g.$('#seat-list [data-listed="1"]').disabled,
    'Host a table: Online player is picked, and the Family lobby can be picked');
  g.click('#seat-start');
  check((g.went.at(-1) || '').endsWith('games/mancala/index.html?player=tim&type=online&role=host'), 'Family lobby table: no invite-only flag in the address', g.went.at(-1));
  noErrors(g, 'games list (family)');
});

// =====================================================================
// One look on every game screen
// =====================================================================
test('game screens share one layout', async () => {
  for (const game of GAMES) {
    const p = await openPage(game, 'player=guest&type=cpu', 'guest');
    const bar = p.$('#lobby-container > .app-bar');
    const tools = bar && bar.querySelector('.bar-tools');
    check(bar && bar.firstElementChild.classList.contains('back-btn') && tools.querySelector('#sound-btn') && tools.lastElementChild.id === 'rules-block',
      `${TITLES[game]}: top bar is ← Back, then 🔊 and 📖 Rules on the right`);
    const rules = p.$('.rules-toggle');
    check(rules.tagName === 'BUTTON', `${TITLES[game]}: Rules is a real button`);
    rules.click();
    await tick(5);
    check(p.$('#rules-block').classList.contains('expanded') && rules.getAttribute('aria-expanded') === 'true', `${TITLES[game]}: 📖 Rules opens the rules`);
    p.click('#turn-info');
    check(!p.$('#rules-block').classList.contains('expanded'), `${TITLES[game]}: tapping anywhere else closes them`);
    check(p.$('#rules-guide-btn'), `${TITLES[game]}: the rules have a 📖 Step by step button`);
    p.click('#rules-guide-btn');
    check(p.$('#help-panel').style.display === 'flex' && p.$$('#help-body .help-steps li').length >= 4, `${TITLES[game]}: Step by step opens the full guide`);
    p.click('#help-close');
    const row = p.$('#game-actions');
    check(row && row.firstElementChild.id === 'players-btn' && row.querySelector('#reset-btn') && !p.$('#players-btn').disabled,
      `${TITLES[game]}: 👥 Players and Reset sit together under the board`);
    p.click('#players-btn');
    check(p.$('#seat-picker').style.display === 'flex' && p.$('#seat-two [data-choice="cpu"]').getAttribute('aria-checked') === 'true',
      `${TITLES[game]}: 👥 Players opens the picker with Computer picked`);
    p.click('#seat-two [data-choice="local"]');
    p.click('#seat-start');
    check((p.went.at(-1) || '').endsWith(`games/${game}/index.html?player=guest&type=local`), `${TITLES[game]}: switching to Someone here reopens the game that way`);
    noErrors(p, TITLES[game]);
  }
});

test('first visit opens the game guide once', async () => {
  const p = await openPage('black-hole', 'player=guest&type=cpu', 'guest', { seen: {} });
  check(p.$('#help-panel') && p.$('#help-panel').style.display === 'flex' && p.text('#help-title').includes('Black Hole'),
    'First time in a game: its step-by-step guide opens by itself');
  check(p.text('.help-done') === "Let's play!", 'The first-time guide closes with "Let\'s play!"');
  check(JSON.parse(p.w.localStorage.getItem('webbs_help_seen'))['black-hole'] === 1, 'It is remembered, so it opens by itself only once');
  const q = await openPage('black-hole', 'player=guest&type=cpu', 'guest');
  check(!q.$('#help-panel') || q.$('#help-panel').style.display !== 'flex', 'Next time the game opens straight to the board');
});

// =====================================================================
// Hosting: Game Lobby tables, invite only, invites, play the computer
// =====================================================================
test('host a family lobby table', async () => {
  resetWorld();
  const local = { webbs_cloud_players: JSON.stringify([{ id: 'tim', name: 'Tim' }, { id: 'ariel', name: 'Ariel' }]) };
  const host = await openPage('tic-tac-toe', 'player=tim&type=online&role=host', 'tim', { uid: 'u-tim', local });
  await until(() => read('tables') && Object.keys(read('tables')).length);
  const pin = host.get('NetworkManager.roomID');
  const t = read(`tables/${pin}`);
  check(t && t.host === 'tim' && t.game === 'Tic-Tac-Toe', 'Family lobby table: it shows in the Game Lobby with the host and game', JSON.stringify(t));
  await until(() => host.text('#seat-table-status').includes('Game Lobby'));
  check(host.shown('#host-pin-display') && host.text('#table-pin-value') === pin, 'The PIN box shows the table PIN under the title');
  const box = host.$('#host-pin-display');
  const order = [...box.children].map(c => c.id || c.className);
  check(order.indexOf('table-pin-value') < order.indexOf('seat-table-status') && order.indexOf('seat-table-status') < order.indexOf('invite-share-btn') && order.at(-1) === 'seat-play-cpu',
    'PIN box reads top to bottom: PIN, who can join, Send invite link, … Play the computer instead', order.join(' > '));
  await until(() => host.$('#invite-family'));
  check(host.$('#invite-family') && host.$('#invite-family').nextElementSibling.id === 'seat-play-cpu', 'Family invite buttons sit above Play the computer instead');

  // Ariel's lobby sees the table, and Join takes her to it
  const lobby = await openPage('lobby', '', 'ariel', { uid: 'u-ariel' });
  await until(() => lobby.$('#open-tables .table-row'));
  check(lobby.text('#open-tables').includes('Tic-Tac-Toe') && lobby.text('#open-tables').includes('Tim is waiting'), "Ariel's Game Lobby: Tic-Tac-Toe · Tim is waiting", lobby.text('#open-tables'));
  check(lobby.text('#lobby-note') === '', 'No note under the tables when the lobby can list them');
  lobby.click('#open-tables .table-join');
  await until(() => lobby.went.length);
  check((lobby.went[0] || '').endsWith(`games/tic-tac-toe/index.html?player=ariel&type=online&role=client&host=${pin}`), 'Tapping Join finds the table and opens the game', lobby.went[0]);

  // Tim invites Ariel in the app
  [...host.$$('#invite-family .invite-chip')].find(b => b.textContent === 'Ariel').click();
  await until(() => lobby.$('#invite-inbox .invite-card'));
  check(lobby.text('#invite-inbox').includes('Tic-Tac-Toe') && lobby.text('#invite-inbox').includes('Tim invited you'), "Ariel's lobby: Tic-Tac-Toe · Tim invited you", lobby.text('#invite-inbox'));
  check(lobby.$('#invite-inbox .invite-card').classList.contains('table-row') && lobby.$('#invite-inbox .invite-join') && lobby.$('#invite-inbox .invite-dismiss'),
    'The invite is the same row as an open table, with Join and Not now');
  lobby.click('#invite-inbox .invite-dismiss');
  await until(() => !lobby.$('#invite-inbox .invite-card'));
  check(!lobby.$('#invite-inbox .invite-card') && !read('invites/ariel'), 'Not now clears the invite');

  // Ariel sits down: the table leaves the lobby, the PIN box folds away, the computer option greys out
  const guest = await openPage('tic-tac-toe', `player=ariel&type=online&role=client&host=${pin}`, 'ariel', { uid: 'u-ariel' });
  await until(() => !read(`tables/${pin}`) && !host.shown('#host-pin-display'));
  check(!read(`tables/${pin}`), 'Someone joined: the table leaves the Game Lobby');
  check(!host.shown('#host-pin-display') && host.text('#network-status').includes(pin), 'Someone joined: the PIN box folds away, the PIN stays in the top bar');
  check(host.$('#seat-play-cpu').disabled, 'Someone joined: Play the computer instead is greyed out');
  check(guest.$('#players-btn').disabled && guest.text('#players-btn') === 'Host picks players', "The joiner's 👥 Players is greyed out and says why");

  // Ariel leaves: the seat opens again
  guest.get('NetworkManager.conn').close();
  await until(() => read(`tables/${pin}`) && host.shown('#host-pin-display'));
  check(read(`tables/${pin}`) && host.shown('#host-pin-display') && !host.$('#seat-play-cpu').disabled, 'The joiner left: the table is back in the lobby and the PIN box is back');
  host.click('#players-btn');
  host.click('#seat-two [data-choice="cpu"]');
  host.click('#seat-start');
  await until(() => !read(`tables/${pin}`));
  check(!read(`tables/${pin}`) && (host.went.at(-1) || '').endsWith('type=cpu'), 'Host switches to the computer with 👥 Players: the table comes off the Game Lobby straight away');
  noErrors(host, 'host');
  noErrors(lobby, 'lobby');
});

test('host an invite-only table', async () => {
  resetWorld();
  const host = await openPage('sorry', 'player=tim&type=online&role=host&list=0', 'tim', { uid: 'u-tim' });
  await until(() => host.get('NetworkManager.roomID') && host.$('#seat-table-status'));
  await tick(40);
  check(!read('tables'), 'Invite only: nothing is written to the Game Lobby');
  check(host.text('#seat-table-status').includes('Invite only'), 'Invite only: the PIN box says so', host.text('#seat-table-status'));
  host.click('#seat-play-cpu');
  check((host.went.at(-1) || '').endsWith('games/sorry/index.html?player=tim&type=cpu'), 'Play the computer instead switches to the computer', host.went.at(-1));
  noErrors(host, 'invite-only host');
});

test('guest host: invite only, no family server', async () => {
  resetWorld();
  const host = await openPage('mancala', 'player=guest&type=online&role=host', 'guest');
  await until(() => host.$('#seat-table-status') && !host.text('#seat-table-status').includes('Checking'));
  check(host.text('#seat-table-status').includes('Only people you give the PIN'), 'Guest host: the box says only people with the PIN or link can join', host.text('#seat-table-status'));
  check(!host.$('#invite-family'), 'Guest host: no family invite buttons');
  noErrors(host, 'guest host');
});

test('guests see open tables and tap one to join', async () => {
  resetWorld();
  const host = await openPage('uno-no-mercy', 'player=tim&type=online&role=host', 'tim', { uid: 'u-tim' });
  await until(() => read('tables') && Object.keys(read('tables')).length);
  const pin = host.get('NetworkManager.roomID');

  const guest = await openPage('lobby', '', 'guest', { uid: null });
  await until(() => guest.$('#open-tables .table-row'));
  check(guest.text('#open-tables').includes('Uno No Mercy') && guest.text('#open-tables').includes('Tim is waiting'), "Guest's Game Lobby shows Tim's open table", guest.text('#open-tables'));
  check(guest.text('#lobby-note') === '', 'Guest: no note when the tables show', guest.text('#lobby-note'));
  const row = guest.$('#open-tables .table-row');
  check(row.tagName === 'BUTTON' && row.getAttribute('aria-label') === 'Join Tim at Uno No Mercy', 'The whole table row is one button, read out as "Join Tim at Uno No Mercy"', row.tagName + ' ' + row.getAttribute('aria-label'));
  guest.click(row.querySelector('.table-game'));
  check(guest.text('#join-title') === "Joining Tim's table" && guest.text('#join-hint') === `Uno No Mercy · PIN ${pin}`, 'The join box says whose table it is, the game and the PIN', guest.text('#join-title') + ' | ' + guest.text('#join-hint'));
  await until(() => guest.went.length);
  check((guest.went[0] || '').endsWith(`games/uno-no-mercy/index.html?player=guest&type=online&role=client&host=${pin}`), 'Guest taps the table (not the Join word): it opens the game at that table', guest.went[0]);

  // The Join word on the row still works, and so does typing a PIN
  const again = await openPage('lobby', '', 'guest', { uid: null });
  await until(() => again.$('#open-tables .table-join'));
  again.click('#open-tables .table-join');
  await until(() => again.went.length);
  check((again.went[0] || '').endsWith(`host=${pin}`), 'Tapping Join on the row still joins', again.went[0]);
  const typed = await openPage('lobby', '', 'guest', { uid: null });
  typed.click('#join-pin-btn');
  typed.$('#join-table-pin').value = pin;
  typed.click('#join-btn-final');
  await until(() => typed.went.length);
  check((typed.went[0] || '').endsWith(`host=${pin}`), 'Join with PIN still works for a PIN typed by hand', typed.went[0]);

  // Cancel means cancel, even when the table answers a moment later
  const cancel = await openPage('lobby', '', 'guest', { uid: null });
  await until(() => cancel.$('#open-tables .table-row'));
  cancel.click('#open-tables .table-row');
  cancel.get('closeJoinModal()');
  await tick(60);
  check(!cancel.went.length, 'Cancel right after tapping a table: the game does not open anyway', cancel.went.join());

  // A table that's gone: a plain message and Try again
  write('tables/9999', { game: 'Sorry!', host: 'ariel', ts: Date.now() });
  const gone = await openPage('lobby', '', 'guest', { uid: null });
  await until(() => gone.$$('#open-tables .table-row').length === 2);
  gone.click(gone.$$('#open-tables .table-row').find(r => r.textContent.includes('Sorry!')));
  await until(() => !gone.text('#join-status').includes('Finding'), 5000);
  check(gone.text('#join-status') === 'No table is open with PIN 9999 right now. Check the PIN, or the host may have left.' && gone.text('#join-btn-final') === 'Try again' && !gone.$('#join-btn-final').disabled,
    'A table whose host left: says so plainly, and Join becomes Try again', gone.text('#join-status'));
  write('tables/9999', null);

  // Waiting for approval: the tables show too
  const zed = await openPage('lobby', '', 'zed', { uid: 'u-zed', local: { webbs_my_accounts: JSON.stringify([{ id: 'zed', name: 'Zed' }]) } });
  await until(() => zed.$('#open-tables .table-row'));
  check(zed.text('#open-tables').includes('Uno No Mercy'), 'A profile still waiting for approval sees the open tables');
  noErrors(guest, 'guest lobby with tables');
  noErrors(zed, 'pending lobby with tables');
});

test('family server still on the old rules', async () => {
  resetWorld();
  world.oldRules = true;
  write('tables/2468', { game: 'Sorry!', host: 'tim', ts: Date.now() });
  const guest = await openPage('lobby', '', 'guest', { uid: null });
  await until(() => guest.text('#lobby-note') && !guest.text('#lobby-note').includes('Checking'));
  check(!guest.shown('#open-tables') && guest.text('#lobby-note').includes('Guests can join with a PIN'), 'Old rules: a guest gets the note on joining with a PIN, no broken list', guest.text('#lobby-note'));
  const ariel = await openPage('lobby', '', 'ariel', { uid: 'u-ariel' });
  await until(() => ariel.$('#open-tables .table-row'));
  check(ariel.text('#open-tables').includes('Sorry!'), 'Old rules: approved family still see the tables');
  noErrors(guest, 'old rules guest');
});

// =====================================================================
// The lobby
// =====================================================================
test('lobby layout and notes', async () => {
  resetWorld();
  const guest = await openPage('lobby', '', 'guest', { uid: null });
  check(guest.$('#lobby-container > .app-bar .app-title') && guest.$('.app-bar .bar-tools #help-btn') && guest.$('.app-bar .bar-tools #sound-btn'),
    'Lobby: same top bar, with Wubs Games, ❓ Help and 🔊');
  check(guest.text('#active-player-name') === 'Hi, Guest!' && guest.shown('#logout-btn'), 'Lobby: Hi, Guest! with Switch player in the welcome card');
  check(guest.shown('#play-btn') && guest.shown('#game-lobby') && guest.shown('#host-btn') && guest.shown('#join-pin-btn'),
    'Lobby: Play a game, the Game Lobby, Host a table and Join with PIN all show');
  await until(() => guest.shown('#open-tables'));
  check(guest.text('#open-tables').includes('No one is waiting') && guest.text('#lobby-note') === '', 'Guest, nobody hosting: the Game Lobby says no one is waiting', guest.text('#open-tables'));
  guest.click('#play-btn');
  check((guest.went.at(-1) || '').endsWith('games.html?player=guest&mode=local'), 'Play a game opens the games list');
  guest.click('#host-btn');
  check((guest.went.at(-1) || '').endsWith('games.html?player=guest&mode=online'), 'Host a table opens the games list with Online player ready');
  guest.click('#join-pin-btn');
  check(guest.$('#join-game-modal').style.display === 'flex', 'Join with PIN opens the PIN box');

  const offline = await openPage('lobby', '', 'ariel');
  check(offline.text('#lobby-note').includes("Can't reach the family server"), 'No family server: the Game Lobby says so', offline.text('#lobby-note'));

  const zed = await openPage('lobby', '', 'zed', { uid: 'u-zed', local: { webbs_my_accounts: JSON.stringify([{ id: 'zed', name: 'Zed' }]) } });
  await until(() => zed.shown('#pending-note') && zed.shown('#open-tables'));
  check(zed.shown('#pending-note') && zed.text('#open-tables').includes('No one is waiting'), 'Waiting for approval: the approval note shows, and so does the Game Lobby', zed.text('#pending-note'));

  const ariel = await openPage('lobby', '', 'ariel', { uid: 'u-ariel' });
  await until(() => ariel.shown('#open-tables'));
  check(ariel.text('#open-tables').includes('No one is waiting'), 'Approved, nobody hosting: the Game Lobby says so', ariel.text('#open-tables'));
  check(ariel.shown('#messages-btn') && ariel.text('#active-player-name') === 'Hi, Ariel!', 'Approved: Messages shows in the welcome card');
  check(ariel.$$('.player-card').length === 0 || ariel.$$('button.player-card').length === ariel.$$('.player-card').length, 'Player cards are real buttons');
  noErrors(guest, 'guest lobby');
  noErrors(ariel, 'family lobby');
});

test('PIN pad', async () => {
  resetWorld();
  const p = await openPage('lobby', '', null, { uid: null });
  p.get("initLogin('ariel')");
  await until(() => p.$('#pin-overlay').style.display === 'flex');
  check(p.$$('#pin-overlay .pin-pad button').length === 12 && p.$$('#pin-overlay .pin-pad button[style]').length === 0, 'The PIN pad has 12 keys, all styled the same way');
  p.click('#pin-overlay .pin-pad button');
  p.click('#pin-overlay .pin-show');
  check(p.text('#pin-display') === '1---' && p.text('#pin-overlay .pin-show') === 'Hide PIN' && p.$('#pin-overlay .pin-show').classList.contains('on'), 'Show PIN shows the digits and turns into Hide PIN', p.text('#pin-display'));
  p.get('closePinOverlay()');
  p.get("initLogin('ariel')");
  check(p.text('#pin-display') === '----' && p.text('#pin-overlay .pin-show') === 'Show PIN', 'Opening it again starts hidden and empty');
  noErrors(p, 'PIN pad');
});

test('player select uses buttons', async () => {
  const p = await openPage('lobby', '', null);
  check(p.$$('#player-select button.player-card').length >= 5 && p.text('.who-title') === "Who's playing today?", "Who's playing today? lists every player as a button");
  noErrors(p, 'player select');
});

// =====================================================================
// Chat controls
// =====================================================================
test('table chat quick messages and pop-up', async () => {
  const host = await openPage('tic-tac-toe', 'player=tim&type=online&role=host', 'tim');
  await until(() => host.$('#chat-quick'));
  check(host.$$('#chat-quick .chat-quick-btn').length >= 6, 'Table chat has a row of one-tap messages');
  check(host.$$('#chat-quick .chat-quick-btn').every(b => b.disabled), 'Quick messages are greyed out until someone joins');
  const pin = host.get('NetworkManager.roomID');
  const guest = await openPage('tic-tac-toe', `player=ariel&type=online&role=client&host=${pin}`, 'ariel');
  await until(() => host.$$('#chat-quick .chat-quick-btn').every(b => !b.disabled) && guest.$$('#chat-quick .chat-quick-btn').every(b => !b.disabled));
  guest.get('NetworkManager.openChat(false)');
  [...host.$$('#chat-quick .chat-quick-btn')].find(b => b.textContent === 'Good luck!').click();
  await until(() => guest.text('#chat-messages').includes('Good luck!'));
  check(guest.text('#chat-messages').includes('Good luck!'), 'One tap sends it to the other phone');
  check(guest.$('#network-chat .chat-peek') && guest.text('#network-chat .chat-peek').includes('Good luck!'), 'Chat closed: the new message pops up beside the Chat button');
  guest.click('#network-chat .chat-peek');
  check(!guest.$('#chat-panel').hidden && !guest.$('#network-chat .chat-peek'), 'Tapping the pop-up opens the chat');
  noErrors(host, 'chat host');
  noErrors(guest, 'chat guest');
});

test('family chat quick messages and message emoji', async () => {
  resetWorld();
  const ariel = await openPage('lobby', '', 'ariel', { uid: 'u-ariel' });
  await until(() => ariel.$('#msg-quick') && ariel.w.document.body.classList.contains('cloud-chat'));
  [...ariel.$$('#msg-quick .chat-quick-btn')].find(b => b.textContent === '👍').click();
  await until(() => read('board'));
  const posts = Object.values(read('board') || {});
  check(posts.some(m => m.text === '👍' && m.from === 'ariel'), 'Family Chat: one tap sends a quick message to the family');
  await until(() => ariel.text('#messages').includes('👍'));
  check(ariel.text('#messages').includes('👍'), 'It shows in Family Chat');

  ariel.get('FamilyUI.openMessages()');
  await until(() => ariel.$('.dm-contact'));
  ariel.click('.dm-contact');
  await tick(20);
  ariel.$('#dm-input').value = 'want to play';
  ariel.$$('.dm-emoji-btn')[0].click();
  await until(() => JSON.stringify(read('dms') || {}).includes('👍'));
  check(ariel.$('#dm-input').value === 'want to play', 'Messages: tapping an emoji no longer wipes what you typed');
  noErrors(ariel, 'family chat');
});

// =====================================================================
// Help and the tour
// =====================================================================
test('help and tour', async () => {
  const p = await openPage('lobby', '', 'guest', { uid: null, tour: true });
  await until(() => p.$('#help-tour'));
  check(p.$('#help-tour') && p.text('.help-tour-title').includes('Welcome'), 'First time in the lobby: a short tour starts');
  p.click('.help-tour-next');
  check(p.text('.help-tour-title') === 'Play a game' && p.$('#play-btn').classList.contains('help-spot'), 'Next points at Play a game');
  p.click('.help-tour-skip');
  check(!p.$('#help-tour') && p.w.localStorage.getItem('webbs_tour_done') === '1' && !p.$('.help-spot'), 'Skip ends the tour and remembers it');
  p.click('#help-btn');
  const topics = p.$$('#help-body .help-topic').map(b => b.dataset.topic);
  check(GAMES.every(g => topics.includes(g)) && ['players', 'host', 'join', 'lobby', 'chat'].every(t => topics.includes(t)),
    '❓ Help lists every game and how players, hosting, joining, the Game Lobby and chat work', topics.join(','));
  check(JSON.stringify(topics.filter(t => GAMES.includes(t))) === JSON.stringify(GAMES), 'Help lists the games in the same order as the games list', topics.join(','));
  check(Object.keys(p.get('WubsHelp.TOPICS')).every(id => topics.includes(id)), 'Help leaves no topic out of the list');
  for (const t of ['players', 'host', 'join', 'lobby', 'chat', ...GAMES]) {
    p.click(`#help-body [data-topic="${t}"]`);
    if (p.$$('#help-body .help-steps li').length < 3) check(false, `Help: ${t} has steps`);
    p.click('#help-back');
  }
  check(true, 'Every help topic opens with its steps and goes back to the list');
  p.click('.help-tour-btn');
  check(p.$('#help-tour') && p.$('#help-panel').style.display === 'none', 'Take the tour starts it again from Help');
  noErrors(p, 'help');
});

// ---- Run ----
let ran = 0;
for (const t of tests) {
  if (only && !t.name.toLowerCase().includes(only)) continue;
  console.log(`\n--- ${t.name} ---`);
  ran++;
  try { await t.fn(); }
  catch (e) { check(false, `${t.name}: ran without crashing`, e && (e.stack || e.message || e)); }
  closeAll();
}
console.log(failures ? `\n${failures} check(s) failed` : `\nAll ${step} checks passed`);
process.exit(failures ? 1 : 0);
