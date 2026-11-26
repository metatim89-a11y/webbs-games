/**
 * SeatPicker: "Who's playing?" for every game, in one place.
 *
 * Every game has two seats. Seat 1 is you, on this phone. Seat 2 is one of:
 *   cpu     the computer
 *   local   someone else taking turns on this phone
 *   online  someone on their own phone, who joins with the table PIN
 * An online table is either listed in the family Game Lobby (anyone in the family can join)
 * or invite only (only people you give the PIN or link to can join).
 *
 *   SeatPicker.GAMES                    the games: id, title, seats
 *   SeatPicker.title(game)              "Chutes & Ladders"
 *   SeatPicker.gameUrl(game, choice, player)   where a choice leads (from the site's top folder)
 *   SeatPicker.open(game, opts)         show the picker; Start goes to the game
 *   SeatPicker.decorateHostBox(box)     in a host's "Share this PIN" box: who can join, and
 *                                       "Play the computer instead" while nobody has joined
 *   SeatPicker.refreshHost()            call when a phone joins or leaves the table
 * On a game page it also puts a "👥 Players" button beside ← Back, so you can switch
 * between the computer, someone here and online without going back to the games list.
 */
const SeatPicker = (() => {
    const GAMES = [
        { id: 'tic-tac-toe', title: 'Tic-Tac-Toe', seats: 2 },
        { id: '357', title: '357 (Nim)', seats: 2 },
        { id: 'mancala', title: 'Mancala', seats: 2 },
        { id: 'black-hole', title: 'Black Hole', seats: 2 },
        { id: 'chutes-and-ladders', title: 'Chutes & Ladders', seats: 2 },
        { id: 'sorry', title: 'Sorry!', seats: 2 },
        { id: 'uno-no-mercy', title: 'Uno No Mercy', seats: 2 },
    ];

    const CHOICES = [
        { id: 'cpu', icon: '🤖', label: 'Computer', desc: 'Play against the computer' },
        { id: 'local', icon: '📱', label: 'Someone here', desc: 'Take turns on this phone' },
        { id: 'online', icon: '🌐', label: 'Online player', desc: 'They join from their own phone' },
    ];

    const MEMORY_KEY = 'webbs_seat_choices'; // last choice for each game, on this phone
    const params = () => new URLSearchParams(window.location.search);
    const $ = id => document.getElementById(id);

    function title(game) {
        const g = GAMES.find(x => x.id === game);
        return g ? g.title : 'a game';
    }

    // Where a choice leads, from the site's top folder: games/<game>/index.html?...
    function gameUrl(game, choice, player) {
        const p = encodeURIComponent(player || 'guest');
        if (choice.seat2 === 'online') {
            return `games/${game}/index.html?player=${p}&type=online&role=host` + (choice.listed ? '' : '&list=0');
        }
        return `games/${game}/index.html?player=${p}&type=${choice.seat2 === 'local' ? 'local' : 'cpu'}`;
    }

    // The site's top folder, from any page (the lobby, the games list or a game)
    function siteRoot() {
        const href = window.location.href.split(/[?#]/)[0];
        if (href.includes('/games/')) return href.split('/games/')[0] + '/';
        return href.replace(/[^/]*$/, '');
    }

    // Tests replace this to see where Start would go
    function navigate(url) { window.location.href = url; }

    function remembered(game) {
        try { return (JSON.parse(localStorage.getItem(MEMORY_KEY)) || {})[game] || null; } catch (e) { return null; }
    }
    function remember(game, choice) {
        try {
            const all = JSON.parse(localStorage.getItem(MEMORY_KEY)) || {};
            all[game] = { seat2: choice.seat2, listed: choice.listed };
            localStorage.setItem(MEMORY_KEY, JSON.stringify(all));
        } catch (e) {}
    }

    function playerName(id) {
        const me = window.WebbsCloud && WebbsCloud.me;
        if (me && me.id === id && me.name) return me.name;
        return typeof ProfileManager !== 'undefined' ? ProfileManager.resolveName(id) : id;
    }

    // Can this player list a table in the family Game Lobby? (needs an approved family profile)
    // Answers 'yes', 'no' (with why) or 'checking' while the family server is still loading.
    let familyState = { state: 'checking', why: '' };
    function checkFamily(onDone) {
        const cloud = window.WebbsCloud;
        const set = (state, why = '') => { familyState = { state, why }; if (onDone) onDone(); };
        const player = sessionStorage.getItem('webbs_active_player') || params().get('player') || 'guest';
        // A guest is answered straight away, so a quick tap on Start can't send a guest to a listed table
        if (player === 'guest') return set('no', 'Guests can host invite-only tables. Pick your family profile to list one');
        if (!cloud || !cloud.available) return set('no', "Can't reach the family server, so the table can't be listed");
        cloud.ready.then(() => {
            const me = cloud.me;
            if (!me || me.id !== player) return set('no', 'Sign in with your PIN to list the table for the family');
            if (!me.approved) return set('no', 'Your profile needs approval before tables can be listed');
            set('yes');
        });
    }

    // ---------- The picker ----------

    let current = null; // { game, choice, player, opts }

    function build() {
        if ($('seat-picker')) return;
        const modal = document.createElement('div');
        modal.id = 'seat-picker';
        modal.className = 'game-over-modal seat-picker';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'seat-title');
        modal.innerHTML = `
            <div class="modal-content seat-panel">
                <h2 id="seat-title" class="seat-title"></h2>
                <p class="seat-question">Who's playing?</p>
                <div class="seat-row">
                    <span class="seat-num" aria-hidden="true">1</span>
                    <div class="seat-fixed"><span class="seat-icon" aria-hidden="true">🙂</span><span id="seat-me"></span></div>
                </div>
                <div class="seat-row">
                    <span class="seat-num" aria-hidden="true">2</span>
                    <div class="seat-options" id="seat-two" role="radiogroup" aria-label="Seat 2"></div>
                </div>
                <div id="seat-online" class="seat-online" hidden>
                    <p class="seat-question">Who can join?</p>
                    <div class="seat-options seat-options-pair" id="seat-list" role="radiogroup" aria-label="Who can join"></div>
                    <p class="seat-note" id="seat-list-note"></p>
                </div>
                <p class="seat-note seat-warn" id="seat-leave-note" hidden></p>
                <button type="button" class="modal-btn seat-start" id="seat-start"></button>
                <button type="button" class="modal-btn seat-cancel" id="seat-cancel">Cancel</button>
            </div>`;
        document.body.appendChild(modal);

        CHOICES.forEach(c => $('seat-two').appendChild(option(c.icon, c.label, c.desc, { choice: c.id })));
        $('seat-list').appendChild(option('🎲', 'Family lobby', 'Anyone in the family can join', { listed: '1' }));
        $('seat-list').appendChild(option('✉️', 'Invite only', 'Only people you send the PIN or link', { listed: '0' }));

        $('seat-two').addEventListener('click', e => {
            const b = e.target.closest('[data-choice]');
            if (b && !b.disabled) { current.choice.seat2 = b.dataset.choice; paint(); }
        });
        $('seat-list').addEventListener('click', e => {
            const b = e.target.closest('[data-listed]');
            if (b && !b.disabled) { current.choice.listed = b.dataset.listed === '1'; paint(); }
        });
        $('seat-start').onclick = start;
        $('seat-cancel').onclick = close;
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });
    }

    function option(icon, label, desc, data) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seat-opt';
        b.setAttribute('role', 'radio');
        Object.entries(data).forEach(([k, v]) => { b.dataset[k] = v; });
        b.innerHTML = '<span class="seat-icon" aria-hidden="true"></span><span class="seat-text"><span class="seat-label"></span><span class="seat-desc"></span></span>';
        b.querySelector('.seat-icon').textContent = icon;
        b.querySelector('.seat-label').textContent = label;
        b.querySelector('.seat-desc').textContent = desc;
        return b;
    }

    function paint() {
        if (!current) return;
        const { game, choice, opts } = current;
        $('seat-title').textContent = title(game);
        $('seat-me').textContent = `You · ${playerName(current.player)}`;

        // An empty seat filled by the computer: the online choice needs the internet game network
        const online = !!opts.onlineOk;
        $('seat-two').querySelectorAll('[data-choice]').forEach(b => {
            const off = b.dataset.choice === 'online' && !online;
            b.disabled = off;
            b.querySelector('.seat-desc').textContent = off ? "Online play didn't load. Check your internet" : CHOICES.find(c => c.id === b.dataset.choice).desc;
            b.setAttribute('aria-checked', String(b.dataset.choice === choice.seat2));
            b.classList.toggle('picked', b.dataset.choice === choice.seat2);
        });

        // Who can join: the family lobby needs an approved family profile; invite only always works
        const showOnline = choice.seat2 === 'online';
        $('seat-online').hidden = !showOnline;
        const canList = familyState.state === 'yes';
        if (familyState.state === 'no' && choice.listed) choice.listed = false;
        $('seat-list').querySelectorAll('[data-listed]').forEach(b => {
            const isLobby = b.dataset.listed === '1';
            b.disabled = isLobby && !canList;
            b.classList.toggle('kit-off', b.disabled);
            const picked = (choice.listed ? '1' : '0') === b.dataset.listed;
            b.setAttribute('aria-checked', String(picked));
            b.classList.toggle('picked', picked);
        });
        const note = $('seat-list-note');
        if (familyState.state === 'checking') note.textContent = 'Checking your family profile…';
        else if (!canList) note.textContent = familyState.why + '.';
        else note.textContent = choice.listed ? 'Your table shows in the Game Lobby until someone joins.' : 'Your table stays off the Game Lobby. Share the PIN or send an invite.';

        const leave = $('seat-leave-note');
        leave.hidden = !opts.leaveNote;
        leave.textContent = opts.leaveNote || '';

        const startBtn = $('seat-start');
        const blocked = choice.seat2 === 'online' && !online;
        startBtn.disabled = blocked;
        startBtn.textContent = blocked ? 'Pick another player' : (choice.seat2 === 'online' ? `Host ${title(game)}` : `Start ${title(game)}`);
    }

    /**
     * game:  'sorry', 'uno-no-mercy', ...
     * opts:  { player, preset: { seat2, listed }, leaveNote, beforeLeave(), onlineOk }
     */
    function open(game, opts = {}) {
        build();
        const player = opts.player || sessionStorage.getItem('webbs_active_player') || params().get('player') || 'guest';
        const saved = remembered(game);
        const preset = opts.preset || saved || { seat2: 'cpu', listed: true };
        current = {
            game, player,
            choice: { seat2: preset.seat2 || 'cpu', listed: preset.listed !== false },
            opts: { onlineOk: true, ...opts },
        };
        familyState = { state: 'checking', why: '' };
        paint();
        checkFamily(paint);
        $('seat-picker').style.display = 'flex';
        const pickedBtn = $('seat-two').querySelector('.picked') || $('seat-start');
        try { pickedBtn.focus(); } catch (e) {}
    }

    function close() {
        const modal = $('seat-picker');
        if (modal) modal.style.display = 'none';
    }

    function start() {
        if (!current) return;
        const { game, choice, player, opts } = current;
        remember(game, choice);
        if (opts.beforeLeave) opts.beforeLeave();
        navigate(siteRoot() + gameUrl(game, choice, player));
    }

    // ---------- On a game page ----------

    function pageGame() {
        const path = window.location.pathname;
        return path.includes('/games/') ? path.split('/games/')[1].split('/')[0] : null;
    }

    function pageChoice() {
        const p = params();
        const type = p.get('type');
        return { seat2: type === 'online' ? 'online' : (type === 'local' ? 'local' : 'cpu'), listed: p.get('list') !== '0' };
    }

    const isJoiner = () => params().get('type') === 'online' && params().get('role') !== 'host';
    // network.js and game-kit.js declare these with const, so they are never on window: look them up by name
    const net = () => (typeof NetworkManager !== 'undefined' ? NetworkManager : null);
    const kit = () => (typeof GameKit !== 'undefined' ? GameKit : null);
    const someoneJoined = () => !!(net() && net().role === 'host' && net().connections.some(c => c.open));

    // Leaving an online table: take it off the Game Lobby straight away
    function leaveTable() {
        const nm = net();
        if (nm && nm.role === 'host' && window.WebbsCloud && nm.roomID) {
            try { WebbsCloud.closeTable(nm.roomID); } catch (e) {}
        }
    }

    function openForThisPage() {
        const game = pageGame();
        if (!game) return;
        let leaveNote = '';
        if (someoneJoined()) {
            const conn = net().connections.find(c => c.open && c.playerID);
            leaveNote = `Changing players ends this game for ${conn ? playerName(conn.playerID) : 'the other phone'}.`;
        }
        // Online play needs PeerJS from the internet; if it didn't load, the online choice says so
        open(game, { preset: pageChoice(), leaveNote, beforeLeave: leaveTable, onlineOk: typeof Peer !== 'undefined' });
    }

    // 👥 Players sits in the actions row under the board, beside Reset, on every game
    function mountPlayersButton() {
        const game = pageGame();
        const row = $('game-actions');
        if (!game || !row || $('players-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'players-btn';
        btn.className = 'modal-btn ghost-btn players-btn';
        btn.textContent = '👥 Players';
        btn.setAttribute('aria-label', 'Change who is playing');
        btn.onclick = openForThisPage;
        row.prepend(btn);
        // The phone that joined someone else's table can't change the seats: say so on the button
        if (isJoiner()) setControl(btn, false, 'Host picks players');
    }

    function setControl(btn, enabled, reason) {
        if (kit()) return kit().setControl(btn, enabled, reason);
        btn.disabled = !enabled;
        btn.title = enabled ? '' : reason;
    }

    // The host's "Share this PIN" box, top to bottom: the PIN, who can join, the invite buttons,
    // then "Play the computer instead" while nobody has joined. It hides once someone sits down.
    function decorateHostBox(box) {
        if (!box || $('seat-table-status')) return;
        const status = document.createElement('div');
        status.id = 'seat-table-status';
        status.className = 'seat-table-status';
        const pin = $('table-pin-value');
        if (pin && pin.parentNode === box) pin.insertAdjacentElement('afterend', status);
        else box.prepend(status);
        const cpu = document.createElement('button');
        cpu.type = 'button';
        cpu.id = 'seat-play-cpu';
        cpu.className = 'modal-btn seat-play-cpu';
        cpu.textContent = '🤖 Play the computer instead';
        cpu.onclick = () => {
            if (someoneJoined()) return;
            leaveTable();
            const p = params();
            navigate(siteRoot() + gameUrl(pageGame(), { seat2: 'cpu' }, p.get('player')));
        };
        box.appendChild(cpu); // the family invite buttons (cloud.js) go in just above it
        refreshHost();
        checkFamily(refreshHost);
    }

    function refreshHost() {
        const status = $('seat-table-status');
        const cpu = $('seat-play-cpu');
        if (!status || !cpu) return;
        const listed = pageChoice().listed;
        if (!listed) status.textContent = '✉️ Invite only: share the PIN or send an invite.';
        else if (familyState.state === 'yes') status.textContent = '🎲 Showing in the family Game Lobby until someone joins.';
        else if (familyState.state === 'checking') status.textContent = 'Checking your family profile…';
        else status.textContent = '✉️ Only people you give the PIN or link can join.';
        const joined = someoneJoined();
        setControl(cpu, !joined, 'Someone joined your table');
        // The board matters once someone sits down; the PIN stays in the top bar for a rejoin
        const box = $('host-pin-display');
        if (box) box.style.display = joined ? 'none' : 'block';
    }

    if (pageGame()) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPlayersButton);
        else mountPlayersButton();
    }

    return {
        GAMES, CHOICES, title, gameUrl, siteRoot, open, close, decorateHostBox, refreshHost,
        get navigate() { return navigate; },
        set navigate(fn) { navigate = fn; },
    };
})();
window.SeatPicker = SeatPicker;
