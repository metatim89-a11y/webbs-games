/**
 * WebbsCloud: family accounts, private messages, family chat, open tables and invites.
 *
 * Uses Firebase (Google) so messages reach other phones. Who can see what is enforced by
 * the database rules in firebase/rules.src.json, not by this file:
 *   - only players Tim has approved can message, chat, see tables or send invites
 *   - a private conversation can be read only by its two players (and Tim, the admin)
 *   - nobody can approve themselves, take someone's name, or send as someone else
 *
 * If Firebase can't load (no signal, blocked), WebbsCloud.available is false and the
 * site keeps working the old way: games, local PINs, local stats.
 */
const WebbsCloud = (() => {
    const config = {
        // Browser key limited to sign-in only and to this site's address (safe to be public)
        apiKey: "AIzaSyAXwiemgRZyDz9glxpX5XXZEoPmtiIpBXA",
        authDomain: "x300-506418.firebaseapp.com",
        databaseURL: "https://x300-506418-default-rtdb.firebaseio.com",
        projectId: "x300-506418",
        appId: "1:1021990235790:web:d0f163cb63d0b595a4a3df",
    };
    const EMAIL_DOMAIN = '@webbs-games.app';
    const TABLE_MAX_AGE = 3 * 60 * 60 * 1000; // open tables older than 3 hours are ignored

    const available = typeof firebase !== 'undefined';
    let auth = null, db = null;
    let me = null;                 // { uid, id, name, approved, admin } once signed in
    const subscribers = [];        // called whenever `me` changes
    let resolveReady;
    const ready = new Promise(r => { resolveReady = r; });

    const now = () => firebase.database.ServerValue.TIMESTAMP;
    const pinPassword = (id, pin) => `webbs-${id}-${pin}-games`;
    const convId = (a, b) => [a, b].sort().join('__');
    const randomTag = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(16).padStart(2, '0')).join('');

    function emit() { subscribers.forEach(fn => { try { fn(me); } catch (e) { console.error(e); } }); }

    async function loadMe(user) {
        if (!user) return null;
        const id = (await db.ref('uids/' + user.uid).get()).val();
        if (!id) return null;
        const p = (await db.ref('players/' + id).get()).val() || {};
        const admin = (await db.ref('admins/' + user.uid).get()).val() === true;
        return { uid: user.uid, id, name: p.name || id, approved: p.approved === true, admin };
    }

    let approvalRef = null, adminRef = null;
    async function refreshMe() {
        try { me = await loadMe(auth.currentUser); } catch (e) { console.warn('WebbsCloud profile', e); me = null; }
        // When Tim approves (or pauses) this player, or makes them admin, the menu updates right away
        if (approvalRef) { approvalRef.off(); approvalRef = null; }
        if (adminRef) { adminRef.off(); adminRef = null; }
        if (me) {
            approvalRef = db.ref(`players/${me.id}/approved`);
            approvalRef.on('value', snap => {
                const approved = snap.val() === true;
                if (me && approved !== me.approved) { me.approved = approved; emit(); }
            }, () => {});
            adminRef = db.ref(`admins/${me.uid}`);
            adminRef.on('value', snap => {
                const admin = snap.val() === true;
                if (me && admin !== me.admin) { me.admin = admin; emit(); }
            }, () => {});
        }
        emit();
        return me;
    }

    function init() {
        if (!available) { resolveReady(null); return; }
        try {
            if (!firebase.apps.length) firebase.initializeApp(config);
            auth = firebase.auth();
            db = firebase.database();
            // Signed in only for this browser tab, like the rest of the site:
            // a shared family phone doesn't stay signed in to someone's messages.
            auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
            let first = true;
            auth.onAuthStateChanged(async () => {
                await refreshMe();
                if (first) { first = false; resolveReady(me); }
            });
        } catch (e) {
            console.warn('WebbsCloud: Firebase did not start, using offline mode', e);
            resolveReady(null);
        }
    }

    // ---------- Accounts ----------

    // Does this player already have a family account?
    async function hasAccount(id) {
        if (!available) return null;
        try { return (await db.ref('logins/' + id).get()).exists(); } catch (e) { return null; }
    }

    // Sign in with a player's 4-digit PIN.
    // Returns { ok } or { wrong } or { tooMany } or { noAccount } or { offline }.
    async function loginWithPin(id, pin) {
        if (!available) return { offline: true };
        let login;
        try { login = (await db.ref('logins/' + id).get()).val(); } catch (e) { return { offline: true }; }
        if (!login) return { noAccount: true };
        try {
            await auth.signInWithEmailAndPassword(login.email, pinPassword(id, pin));
            await refreshMe();
            return { ok: true };
        } catch (e) {
            if (e.code === 'auth/too-many-requests') return { tooMany: true };
            if (e.code === 'auth/network-request-failed') return { offline: true };
            return { wrong: true };
        }
    }

    // Make a new family account. It starts unapproved until Tim approves it.
    async function createAccount(id, pin, profile = {}) {
        if (!available) return { offline: true };
        if (!/^[a-z0-9]{1,20}$/.test(id)) return { error: 'Names can only use letters and numbers.' };
        const email = `${id}.${randomTag()}${EMAIL_DOMAIN}`;
        let cred;
        try {
            cred = await auth.createUserWithEmailAndPassword(email, pinPassword(id, pin));
        } catch (e) {
            if (e.code === 'auth/network-request-failed') return { offline: true };
            return { error: 'Could not make the account. Try again in a minute.' };
        }
        const uid = cred.user.uid;
        try {
            await db.ref('logins/' + id).set({ email });
        } catch (e) {
            await cred.user.delete().catch(() => {});
            return { error: 'That name is already taken.' };
        }
        await db.ref('uids/' + uid).set(id);
        const existing = (await db.ref('players/' + id).get()).val();
        if (existing) {
            // Tim reset this PIN: keep the profile (and approval), point it at the new account
            await db.ref('players/' + id).update({ uid });
        } else {
            const record = { name: (profile.name || id).slice(0, 20), approved: false, uid, createdAt: Date.now() };
            if (profile.animal) record.animal = String(profile.animal).slice(0, 40);
            if (profile.favGame) record.favGame = String(profile.favGame).slice(0, 40);
            if (Array.isArray(profile.colors)) record.colors = profile.colors.filter(c => /^#[0-9a-fA-F]{6}$/.test(c));
            await db.ref('players/' + id).set(record);
        }
        rememberAccountOnThisPhone(id, profile.name || id);
        await refreshMe();
        return { ok: true };
    }

    // Accounts made on this phone show on the login screen even before approval
    function rememberAccountOnThisPhone(id, name) {
        const list = JSON.parse(localStorage.getItem('webbs_my_accounts') || '[]');
        if (!list.some(p => p.id === id)) list.push({ id, name });
        localStorage.setItem('webbs_my_accounts', JSON.stringify(list));
    }

    async function signOut() {
        if (!available || !auth || !auth.currentUser) return;
        if (approvalRef) { approvalRef.off(); approvalRef = null; }
        await auth.signOut().catch(() => {});
        me = null;
        emit();
    }

    // ---------- Family list ----------

    // Approved players, kept in sync and copied into the older 'webbs_approved_players' list
    // so every game shows the right names.
    function watchPlayers(cb) {
        if (!me || !(me.approved || me.admin)) return () => {};
        const ref = db.ref('players');
        const handler = snap => {
            const all = snap.val() || {};
            const players = Object.entries(all).map(([id, p]) => ({ id, name: p.name, approved: p.approved === true, uid: p.uid,
                animal: p.animal || '', favGame: p.favGame || '', colors: p.colors || [], createdAt: p.createdAt || 0 }));
            const approved = players.filter(p => p.approved);
            const defaults = ['tim', 'ariel', 'az', 'cassie'];
            const legacy = approved.filter(p => !defaults.includes(p.id)).map(p => ({ id: p.id, name: p.name, theme: `theme-${p.id}` }));
            localStorage.setItem('webbs_approved_players', JSON.stringify(legacy));
            localStorage.setItem('webbs_cloud_players', JSON.stringify(approved.map(p => ({ id: p.id, name: p.name }))));
            cb(players);
        };
        ref.on('value', handler, err => console.warn('players', err));
        return () => ref.off('value', handler);
    }

    // ---------- Private messages ----------

    function watchConversation(otherId, cb) {
        const ref = db.ref('dms/' + convId(me.id, otherId)).limitToLast(150);
        const handler = snap => {
            const msgs = [];
            snap.forEach(c => { msgs.push({ key: c.key, ...c.val() }); });
            cb(msgs);
        };
        ref.on('value', handler, err => console.warn('dm', err));
        return () => ref.off('value', handler);
    }

    async function sendMessage(otherId, text) {
        text = String(text).trim().slice(0, 500);
        if (!text) return;
        await db.ref('dms/' + convId(me.id, otherId)).push({ from: me.id, text, ts: now() });
    }

    function markRead(otherId) {
        if (!me) return;
        db.ref(`reads/${me.id}/${convId(me.id, otherId)}`).set(now()).catch(() => {});
    }

    // Calls cb({ otherId: { last, unread } }) whenever any of my conversations changes
    function watchInbox(otherIds, cb) {
        const state = {};
        let reads = {};
        const offs = [];
        const push = () => {
            const out = {};
            otherIds.forEach(o => {
                const last = state[o] || null;
                const readAt = reads[convId(me.id, o)] || 0;
                out[o] = { last, unread: !!(last && last.from !== me.id && last.ts > readAt) };
            });
            cb(out);
        };
        const readsRef = db.ref('reads/' + me.id);
        const readsHandler = s => { reads = s.val() || {}; push(); };
        readsRef.on('value', readsHandler);
        offs.push(() => readsRef.off('value', readsHandler));
        otherIds.forEach(o => {
            const ref = db.ref('dms/' + convId(me.id, o)).limitToLast(1);
            const h = s => { let last = null; s.forEach(c => { last = c.val(); }); state[o] = last; push(); };
            ref.on('value', h, () => {});
            offs.push(() => ref.off('value', h));
        });
        return () => offs.forEach(f => f());
    }

    // ---------- Family chat (everyone approved) ----------

    function watchBoard(cb) {
        const ref = db.ref('board').limitToLast(50);
        const h = snap => { const out = []; snap.forEach(c => { out.push({ key: c.key, ...c.val() }); }); cb(out); };
        ref.on('value', h, err => console.warn('board', err));
        return () => ref.off('value', h);
    }

    async function postBoard(text) {
        text = String(text).trim().slice(0, 300);
        if (!text) return;
        await db.ref('board').push({ from: me.id, text, ts: now() });
    }

    // ---------- Open tables + invites ----------

    function canUseFamilyFeatures() { return !!(me && me.approved); }

    async function publishTable(pin, game) {
        await ready;
        if (!canUseFamilyFeatures()) return;
        const ref = db.ref('tables/' + pin);
        await ref.set({ game, host: me.id, ts: now() }).catch(e => console.warn('table', e));
        ref.onDisconnect().remove();
    }

    function closeTable(pin) {
        if (!canUseFamilyFeatures()) return;
        db.ref('tables/' + pin).remove().catch(() => {});
    }

    function watchTables(cb) {
        if (!canUseFamilyFeatures()) return () => {};
        const ref = db.ref('tables');
        const h = snap => {
            const out = [];
            const cutoff = Date.now() - TABLE_MAX_AGE;
            snap.forEach(c => { const t = c.val(); if (t.ts > cutoff && t.host !== me.id) out.push({ pin: c.key, ...t }); });
            cb(out);
        };
        ref.on('value', h, err => console.warn('tables', err));
        return () => ref.off('value', h);
    }

    async function sendInvite(toId, pin, game) {
        await db.ref('invites/' + toId).push({ from: me.id, game, pin: String(pin), ts: now() });
    }

    function watchInvites(cb) {
        if (!canUseFamilyFeatures()) return () => {};
        const ref = db.ref('invites/' + me.id);
        const h = snap => {
            const out = [];
            const cutoff = Date.now() - TABLE_MAX_AGE;
            snap.forEach(c => { const v = c.val(); if (v.ts > cutoff) out.push({ key: c.key, ...v }); else c.ref.remove(); });
            cb(out);
        };
        ref.on('value', h, err => console.warn('invites', err));
        return () => ref.off('value', h);
    }

    function dismissInvite(key) { db.ref(`invites/${me.id}/${key}`).remove().catch(() => {}); }

    // In a game's "Share this PIN" box: buttons to invite family members in the app
    async function addInvitePicker(box, pin, game) {
        await ready;
        if (!canUseFamilyFeatures() || document.getElementById('invite-family')) return;
        const players = JSON.parse(localStorage.getItem('webbs_cloud_players') || '[]').filter(p => p.id !== me.id);
        if (!players.length) return;
        const wrap = document.createElement('div');
        wrap.id = 'invite-family';
        wrap.className = 'invite-family';
        const label = document.createElement('div');
        label.className = 'invite-family-label';
        label.textContent = 'Or invite in the app:';
        wrap.appendChild(label);
        players.forEach(p => {
            const b = document.createElement('button');
            b.className = 'invite-chip';
            b.textContent = p.name;
            b.onclick = async () => {
                b.disabled = true;
                try { await sendInvite(p.id, pin, game); b.textContent = `✓ ${p.name}`; b.classList.add('sent'); }
                catch (e) { b.disabled = false; b.textContent = `Retry ${p.name}`; }
            };
            wrap.appendChild(b);
        });
        // Above "Play the computer instead" when that's in the box (seat-picker.js), else at the end
        const cpu = document.getElementById('seat-play-cpu');
        if (cpu && cpu.parentNode === box) box.insertBefore(wrap, cpu);
        else box.appendChild(wrap);
    }

    // ---------- Game history (wins/losses follow you to any phone) ----------

    function recordResult(game, opponent, result) {
        if (!canUseFamilyFeatures()) return;
        db.ref('history/' + me.id).push({ game: String(game).slice(0, 30), opponent: String(opponent || '').slice(0, 30), result, ts: now() })
            .catch(() => {});
    }

    async function getHistory(id) {
        const snap = await db.ref('history/' + id).limitToLast(500).get();
        const out = [];
        snap.forEach(c => { out.push(c.val()); });
        return out;
    }

    // ---------- Admin (Tim) ----------

    async function adminApprove(id, yes = true) { await db.ref(`players/${id}/approved`).set(yes); }

    // Forget a player's PIN: they make a new one next time; their messages and profile stay
    async function adminResetPin(id) {
        const p = (await db.ref('players/' + id).get()).val();
        const updates = { [`logins/${id}`]: null };
        if (p && p.uid) updates[`uids/${p.uid}`] = null;
        await db.ref().update(updates);
    }

    // Remove a player completely (sign-up request denied, or account taken by someone else)
    async function adminRemove(id) {
        const p = (await db.ref('players/' + id).get()).val();
        const updates = { [`logins/${id}`]: null, [`players/${id}`]: null, [`invites/${id}`]: null };
        if (p && p.uid) updates[`uids/${p.uid}`] = null;
        await db.ref().update(updates);
    }

    async function adminConversations() {
        const snap = await db.ref('dms').get();
        const out = [];
        snap.forEach(c => {
            const msgs = []; c.forEach(m => { msgs.push({ key: m.key, ...m.val() }); });
            out.push({ conv: c.key, people: c.key.split('__'), msgs });
        });
        return out.sort((a, b) => (b.msgs.at(-1)?.ts || 0) - (a.msgs.at(-1)?.ts || 0));
    }

    async function adminDeleteMessage(conv, key) { await db.ref(`dms/${conv}/${key}`).remove(); }

    init();

    return {
        available, ready,
        get me() { return me; },
        onChange(fn) { subscribers.push(fn); },
        convId, hasAccount, loginWithPin, createAccount, signOut, canUseFamilyFeatures,
        watchPlayers, watchConversation, sendMessage, markRead, watchInbox,
        watchBoard, postBoard,
        publishTable, closeTable, watchTables, sendInvite, watchInvites, dismissInvite, addInvitePicker,
        recordResult, getHistory,
        adminApprove, adminResetPin, adminRemove, adminConversations, adminDeleteMessage,
    };
})();
window.WebbsCloud = WebbsCloud;
