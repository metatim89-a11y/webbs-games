// Preview only: a pretend family server, so the signed-in screens can be looked at
// without touching the real one. Everyone here is made up. PIN for everyone: 1234.
(() => {
  const q = new URLSearchParams(location.search);
  const now = Date.now(), min = 60 * 1000;
  const world = { data: {}, listeners: [] };
  world.data = {
    uids: { 'u-tim': 'tim', 'u-sam': 'sam', 'u-jo': 'jo', 'u-kit': 'kit' },
    logins: { tim: { email: 'tim@x' }, sam: { email: 'sam@x' }, jo: { email: 'jo@x' }, kit: { email: 'kit@x' } },
    players: {
      tim: { name: 'Tim', approved: true, uid: 'u-tim' },
      sam: { name: 'Sam', approved: true, uid: 'u-sam' },
      jo: { name: 'Jo', approved: true, uid: 'u-jo' },
      kit: { name: 'Kit', approved: false, uid: 'u-kit', animal: 'Fox', favGame: 'Uno', createdAt: now - 50 * min },
    },
    admins: { 'u-tim': true },
    board: {
      b1: { from: 'sam', text: 'Anyone up for Uno after dinner?', ts: now - 40 * min },
      b2: { from: 'jo', text: 'Me! 🎲', ts: now - 38 * min },
      b3: { from: 'tim', text: 'Count me in', ts: now - 20 * min },
    },
    dms: { sam__tim: {
      d1: { from: 'sam', text: 'Rematch at Mancala?', ts: now - 30 * min },
      d2: { from: 'tim', text: 'You are on 😄', ts: now - 28 * min },
      d3: { from: 'sam', text: 'Hosting now', ts: now - 3 * min },
    } },
    reads: { tim: { sam__tim: now - 29 * min } },
  };
  if (q.get('tables') !== '0') world.data.tables = {
    3812: { game: 'Uno No Mercy', host: 'sam', ts: now - 4 * min },
    5520: { game: 'Mancala', host: 'jo', ts: now - 1 * min },
  };
  if (q.get('invites') !== '0') world.data.invites = { tim: { i1: { from: 'jo', game: 'Sorry!', pin: '7731', ts: now - 2 * min } } };

  const parts = p => String(p || '').split('/').filter(Boolean);
  const read = p => { let n = world.data; for (const k of parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
  function write(p, v) {
    const ks = parts(p); let n = world.data;
    for (const k of ks.slice(0, -1)) { if (typeof n[k] !== 'object' || n[k] === null) n[k] = {}; n = n[k]; }
    if (v === null || v === undefined) delete n[ks.at(-1)]; else n[ks.at(-1)] = structuredClone(v);
    world.listeners.filter(l => l.path === p || l.path.startsWith(p + '/') || p.startsWith(l.path + '/') || l.path === '')
      .forEach(l => setTimeout(() => world.listeners.includes(l) && l.fn(snap(l.path)), 1));
  }
  let pushes = 0;
  function snap(p) {
    const v = read(p);
    return { key: parts(p).at(-1) || null, val: () => (v === null ? null : structuredClone(v)), exists: () => v !== null,
      forEach(cb) { if (v && typeof v === 'object') for (const k of Object.keys(v).sort()) { if (cb(snap(p + '/' + k)) === true) break; } }, ref: ref(p) };
  }
  function ref(p) {
    p = parts(p).join('/');
    const r = {
      key: parts(p).at(-1) || null,
      get: async () => snap(p), set: async v => write(p, v), remove: async () => write(p, null),
      update: async v => { for (const [k, x] of Object.entries(v)) write(p ? p + '/' + k : k, x); },
      push(v) { const key = 'p' + String(++pushes).padStart(5, '0'); const c = ref(p + '/' + key); if (v !== undefined) write(p + '/' + key, v); return Object.assign(Promise.resolve(c), c); },
      child: k => ref(p + '/' + k),
      on(ev, fn) { const l = { path: p, fn }; world.listeners.push(l); setTimeout(() => world.listeners.includes(l) && fn(snap(p)), 1); return fn; },
      off(ev, fn) { world.listeners = world.listeners.filter(l => !(l.path === p && (!fn || l.fn === fn))); },
      onDisconnect: () => ({ remove() {}, set() {} }),
      limitToLast: () => r, orderByChild: () => r, orderByKey: () => r,
    };
    return r;
  }
  const as = q.get('as');
  const watchers = [];
  const auth = {
    currentUser: as && as !== 'none' && as !== 'guest' ? { uid: 'u-' + as } : null,
    setPersistence: async () => {},
    onAuthStateChanged(fn) { watchers.push(fn); setTimeout(() => fn(this.currentUser), 1); },
    async signOut() { this.currentUser = null; },
    async signInWithEmailAndPassword(email, pw) {
      const id = Object.keys(world.data.logins).find(k => world.data.logins[k].email === email);
      if (!id || pw !== `webbs-${id}-1234-games`) throw { code: 'auth/wrong-password' };
      this.currentUser = { uid: 'u-' + id };
    },
  };
  window.firebase = {
    apps: [], initializeApp() { this.apps.push({}); },
    auth: Object.assign(() => auth, { Auth: { Persistence: { SESSION: 'session' } } }),
    database: Object.assign(() => ({ ref }), { ServerValue: { get TIMESTAMP() { return Date.now(); } } }),
  };
  window.__previewWorld = world;
})();
