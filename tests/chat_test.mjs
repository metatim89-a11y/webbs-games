// Table chat test: three pretend phones (a host and two joiners) run the real network.js and chat.js
// over a pretend PeerJS link, so no browser, server or extra packages are needed.
//   node tests/chat_test.mjs                 checks this copy of the site
//   node tests/chat_test.mjs old-network.js  runs the same checks against another network.js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const networkFile = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'network.js');
const networkSrc = readFileSync(networkFile, 'utf8');
const chatSrc = readFileSync(path.join(root, 'chat.js'), 'utf8');
const profileSrc = readFileSync(path.join(root, 'profile.js'), 'utf8');

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
let failures = 0, step = 0;
function check(ok, label, detail = '') {
  step++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}. ${label}${ok || !detail ? '' : ' (' + detail + ')'}`);
  if (!ok) failures++;
}

// ---- Pretend PeerJS: peers find each other by id, data arrives a moment later like on a real network ----
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

// ---- One pretend phone: its own copy of the site's scripts, with the chat screen swapped for a recorder ----
function phone(playerId, extra = {}) {
  const store = new Map([['webbs_active_player', playerId]]);
  const sessionStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
  const localStorage = { getItem: () => null, setItem() {} };
  const document = { getElementById: () => null };
  const location = { pathname: '/webbs-games/games/sorry/index.html', href: 'https://example.test/webbs-games/games/sorry/index.html?player=' + playerId, search: '?player=' + playerId };
  const ctx = { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, URLSearchParams, Image: class {},
    sessionStorage, localStorage, document, location, Peer: FakePeer, alert() {}, prompt() {}, ...extra };
  ctx.window = ctx;
  vm.createContext(ctx);
  // Like a browser: each file's top-level names are shared between scripts but are not window properties
  vm.runInContext(chatSrc, ctx);
  vm.runInContext(profileSrc, ctx);
  vm.runInContext(networkSrc + '\n;this.NetworkManager = NetworkManager;', ctx);
  const nm = ctx.NetworkManager;
  const shown = [];   // every chat line this phone's screen would show
  const states = [];  // every time the chat box was told to update its greyed-out state
  nm.setupChatUI = () => {};
  nm.renderChatMessage = (data, mine = false) => shown.push({ text: data.text, name: data.name || data.sender, mine });
  nm.updateChatState = () => states.push(typeof nm.chatReady === 'function' ? nm.chatReady() : null);
  return { nm, shown, states, ctx };
}
const count = (p, text) => p.shown.filter(m => m.text === text).length;

// ---- The checks ----
const host = phone('tim');
host.nm.init('host', '4821');
await tick(20);

const early = host.nm.sendChatMessage('anyone here?');
await tick(10);
check(early === false && count(host, 'anyone here?') === 0,
  'Before anyone joins, the host message is refused (the box stays greyed out) instead of vanishing',
  `send returned ${early}, shown ${count(host, 'anyone here?')} time(s)`);

const ariel = phone('ariel');
const guest = phone('guest');
ariel.nm.init('client', '4821');
guest.nm.init('client', '4821');
await tick(60);

check(host.nm.connections.filter(c => c.open).length === 2, 'Both players joined the table');
check(host.states.at(-1) === true && ariel.states.at(-1) === true && guest.states.at(-1) === true,
  'Once connected, every chat box turns on', `host ${host.states.at(-1)}, ariel ${ariel.states.at(-1)}, guest ${guest.states.at(-1)}`);

host.nm.sendChatMessage('Good luck!');
await tick(30);
check(count(ariel, 'Good luck!') === 1, "The host's message reaches a joiner exactly once", `arrived ${count(ariel, 'Good luck!')} times`);
check(count(guest, 'Good luck!') === 1, "...and the other joiner exactly once", `arrived ${count(guest, 'Good luck!')} times`);
check(count(host, 'Good luck!') === 1 && host.shown.find(m => m.text === 'Good luck!').mine === true,
  'The host sees their own message once, marked as theirs');

ariel.nm.sendChatMessage('You too 😄');
await tick(30);
check(count(host, 'You too 😄') === 1 && count(guest, 'You too 😄') === 1 && count(ariel, 'You too 😄') === 1,
  "A joiner's message shows once on every phone, emoji and all",
  `host ${count(host, 'You too 😄')}, guest ${count(guest, 'You too 😄')}, ariel ${count(ariel, 'You too 😄')}`);
const seen = host.shown.find(m => m.text === 'You too 😄');
check(seen && seen.name === 'Ariel', 'Messages carry the player\'s name, not a shouted-out account id', `shown as "${seen && seen.name}"`);

const long = 'x'.repeat(400);
ariel.nm.sendChatMessage(long);
await tick(30);
const longSeen = host.shown.at(-1);
check(longSeen && longSeen.text.length === 300, 'Very long messages are cut to the same 300-letter limit everywhere', `length ${longSeen && longSeen.text.length}`);

// Joiners leave: the host's box greys out again with its reason
ariel.nm.conn.close();
await tick(20);
check(host.states.at(-1) === true, 'One player leaving keeps the chat on for the rest');
guest.nm.conn.close();
await tick(20);
check(host.states.at(-1) === false, 'When everyone has left, the host chat greys out again');

// ---- The shared text box (Family Chat and table chat use the same one) ----
{
  const ctx = phone('tim').ctx;
  const W = vm.runInContext('WebbsChat', ctx);
  const handlers = {};
  const input = { value: '', disabled: false, placeholder: '', setAttribute(k, v) { this[k] = v; }, addEventListener: (ev, fn) => (handlers[ev] = fn) };
  const button = { disabled: false, title: '', addEventListener: (ev, fn) => (handlers['btn-' + ev] = fn) };
  const sent = [];
  let accept = true;
  W.bindInput(input, button, text => { sent.push(text); return accept; });
  const key = (k, composing = false) => handlers.keydown({ key: k, isComposing: composing, preventDefault() {} });

  check(input.maxLength === 300, 'The text box stops at 300 letters, so nothing is cut off silently');
  input.value = 'hello'; key('Enter', true);
  check(sent.length === 0 && input.value === 'hello', 'Enter pressed while an emoji or language keyboard is still typing does not send');
  key('Enter');
  check(sent[0] === 'hello' && input.value === '', 'Enter sends and clears the box');
  input.value = '   '; handlers['btn-click']();
  check(sent.length === 1, 'Blank messages are not sent');
  accept = false; input.value = 'not yet'; handlers['btn-click']();
  check(input.value === 'not yet', "If a message can't go, the words stay in the box");
  W.setEnabled(input, button, false, 'Waiting for someone to join…', 'Say something…');
  check(input.disabled && button.disabled && input.placeholder === 'Waiting for someone to join…', 'A greyed-out box says why');
  accept = true; key('Enter');
  check(sent.length === 2, 'Nothing sends while the box is greyed out', `sent ${sent.length}`);
  W.setEnabled(input, button, true, 'Waiting for someone to join…', 'Say something…');
  check(!input.disabled && !button.disabled && input.placeholder === 'Say something…', 'It turns back on when a message can be sent');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll table chat checks passed');
process.exit(failures ? 1 : 0);
