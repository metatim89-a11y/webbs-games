/**
 * WubsHelp: how to play every game, how chat and online play work, and a short tour.
 * One help window, used the same way everywhere:
 *   - the lobby and the games list have a ❓ Help button
 *   - every game's Rules pill gets a "📖 Step by step" button that opens that game's guide
 *   - the first time a game is opened on this phone, its guide opens by itself (one tap to close)
 *   - the first time the main menu shows on this phone, a short tour points at each part (Skip any time)
 *
 *   WubsHelp.open(topic)     open the help window on a topic ('online', 'chat', 'sorry', ...)
 *   WubsHelp.openList()      open the list of every topic
 *   WubsHelp.startTour()     run the lobby tour (again)
 *   WubsHelp.maybeTour()     run the tour if it hasn't been seen on this phone
 *   WubsHelp.TOPICS          the words themselves
 */
const WubsHelp = (() => {
    // Every guide is short steps a kid can follow. "tip" lines are extra, shown smaller.
    const TOPICS = {
        start: {
            icon: '👋', title: 'How Wubs Games works', group: 'help',
            steps: [
                'Tap your name and type your 4-digit PIN. Guest needs no PIN.',
                'Tap 🎲 Play a game, then tap the game you want.',
                "Choose who's playing: the computer, someone next to you, or someone online. Then tap Start.",
                'Tap ← Back any time to go back.',
            ],
            tips: ['🔊 turns the sound on and off.', 'Inside a game, tap 📖 Rules (top right) to see how to play.'],
        },
        players: {
            icon: '👥', title: "Choosing who's playing", group: 'help',
            steps: [
                'Every game has 2 seats. Seat 1 is you.',
                '🤖 Computer: you play against the computer.',
                '📱 Someone here: you take turns on this phone. Pass it when it says their turn.',
                '🌐 Online player: they play on their own phone and join with your table PIN.',
                'Inside a game, tap 👥 Players under the board to switch, for example from the computer to someone online.',
            ],
            tips: ['Your last choice for each game is remembered on this phone.'],
        },
        host: {
            icon: '🌐', title: 'Hosting an online game', group: 'help',
            steps: [
                'Tap 🌐 Host a table in the Game Lobby (or 🎲 Play a game), pick a game, then pick 🌐 Online player.',
                'Choose 🎲 Family lobby so the family sees your table, or ✉️ Invite only.',
                'Tap Host. You get a 4-digit table PIN at the top.',
                'Share it: say the PIN out loud, tap 📨 Send invite link, or tap a family name to invite them in the app.',
                'When they join, it is your turn first. Have fun!',
            ],
            tips: ['Nobody coming? Tap 🤖 Play the computer instead.',
                'Only the host can start a new game with Play Again or Reset.',
                'If their phone drops out, they can sit back down with the same PIN.'],
        },
        join: {
            icon: '🔑', title: 'Joining a game', group: 'help',
            steps: [
                'Someone invited you? Tap Join on the invite at the top of the lobby.',
                'See a table in the 🎲 Game Lobby? Tap its Join button.',
                'Got a PIN? Tap 🔑 Join with PIN, type the 4 numbers and tap Join Table.',
                'Wait a moment while your phone finds the table. The game opens by itself.',
            ],
            tips: ['An invite link opens Wubs Games for you. Tap your name and you go straight to the table.',
                "If it says no table has that PIN, check the PIN on the host's screen."],
        },
        lobby: {
            icon: '🎲', title: 'The Game Lobby', group: 'help',
            steps: [
                'The Game Lobby shows family tables waiting for someone to play.',
                'Invites sent to you show at the top. Tap Join or Not now.',
                'Tap Join on a table to sit down and play.',
                'A table leaves the lobby as soon as someone joins it.',
            ],
            tips: ['You see the lobby when you are signed in with your family profile and Tim or Cassie has approved it.',
                'Guests can still join with a PIN or an invite link.'],
        },
        chat: {
            icon: '💬', title: 'Chatting', group: 'help',
            steps: [
                'Family Chat is in the lobby. Type a message and tap Send.',
                'Tap a quick message like 👍 or Good game! to send it in one tap.',
                'In an online game, tap 💬 Chat at the bottom. Only people at your table see it.',
                'A new table message pops up next to the Chat button for a moment. Tap it to open the chat.',
                'Approved family can tap 💬 Messages to talk to one person.',
            ],
            tips: ['Guest messages stay on this phone.', 'Tim and Cassie can read messages to keep everyone safe. Be kind!'],
        },

        // ---------- The games ----------
        'tic-tac-toe': {
            icon: '❌', title: 'Tic-Tac-Toe', group: 'game', goal: 'Get 3 in a row.',
            steps: [
                'You are X. Tap an empty square to put your X there.',
                'Then the other player puts an O.',
                '3 in a row across, down or corner to corner wins.',
                "All 9 squares full and no 3 in a row? It's a draw.",
            ],
            tips: ['Who goes first swaps every new game.'],
        },
        '357': {
            icon: '🟨', title: '357 (Nim)', group: 'game', goal: 'Take the very last piece.',
            steps: [
                'There are 3 rows with 3, 5 and 7 pieces.',
                'On your turn, tap a piece. It and every piece to its right in that row light up.',
                'Tap Take Selected to take them.',
                'Take as many as you like, but only from one row.',
                'Whoever takes the last piece wins.',
            ],
            tips: ['Before you take, think about what you leave for the other player.'],
        },
        mancala: {
            icon: '🥣', title: 'Mancala', group: 'game', goal: 'Get the most stones in your store.',
            steps: [
                'Your pits are the bottom row. Your store is the big cup on the right.',
                'Tap one of your pits. Its stones drop one at a time into the next pits, going around the board.',
                'Last stone lands in your store? You go again!',
                'Last stone lands in an empty pit on your side? You capture it and the stones across from it.',
                'When one side runs out, the game ends. Most stones wins.',
            ],
            tips: ['Stones skip the other player’s store.'],
        },
        'black-hole': {
            icon: '🕳️', title: 'Black Hole', group: 'game', goal: 'Have the biggest total left on the board.',
            steps: [
                'The board is a triangle of 21 circles. You each have the numbers 1 to 10.',
                'Tap one of your numbers, then tap an empty circle to put it there.',
                'Take turns until every number is placed. One circle stays empty: the Black Hole!',
                "Numbers touching the Black Hole get sucked in and don't count.",
                'Add up your numbers left on the board. The biggest total wins.',
            ],
            tips: ['Each number can be used once.'],
        },
        'chutes-and-ladders': {
            icon: '🪜', title: 'Chutes & Ladders', group: 'game', goal: 'Be first to reach square 100.',
            steps: [
                'Tap SPIN. Your piece moves that many squares.',
                'Land at the bottom of a green ladder? Climb up!',
                'Land at the top of a red chute? Slide down.',
                'Hidden squares can swap you with the other player, move you back 5 or forward 5, or take you to a ladder.',
                'You need the exact number to land on 100.',
            ],
            tips: [],
        },
        sorry: {
            icon: '🎲', title: 'Sorry!', group: 'game', goal: 'Get all 4 of your pawns HOME first.',
            steps: [
                'Tap the dice under the board to roll a number from 1 to 6.',
                'Roll a 1 or 2 to bring a pawn out of START.',
                'Tap a glowing pawn to move it.',
                'Land on the other player’s pawn and it goes back to START. Sorry!',
                'Your colored path to HOME is safe. A pawn can’t go past HOME, so you need the right number to get in.',
            ],
            tips: ["If you can't move, the game tells you and the turn passes."],
        },
        'uno-no-mercy': {
            icon: '🃏', title: 'Uno No Mercy', group: 'game', goal: 'Be first to play all your cards.',
            steps: [
                'Tap a card that matches the top card’s color or number to play it.',
                "Can't play? Tap DRAW.",
                'Draw cards stack: if you get a +2 and you have a +2 or bigger, play it and they draw them all!',
                'After a Wild card, pick the next color.',
                'Color Roulette: the next player draws until they get the color you picked.',
                '0 passes hands and 7 swaps hands. Skip and Reverse let you go again.',
                'Mercy rule: reach 25 cards and you are out!',
            ],
            tips: ['On one phone, pass it over and tap to show your cards when it is your turn.'],
        },
    };

    // The lobby tour: each step points at one part of the main menu
    // The order the Help list shows topics in. JavaScript always lists a number-like key such as '357'
    // first, so the list follows this order (the same as the games list) instead of the object's.
    const ORDER = ['start', 'players', 'host', 'join', 'lobby', 'chat',
        'tic-tac-toe', '357', 'mancala', 'black-hole', 'chutes-and-ladders', 'sorry', 'uno-no-mercy'];

    const TOUR = [
        { icon: '👋', title: 'Welcome to Wubs Games!', text: "Here's a quick look around. It takes 30 seconds." },
        { icon: '🎲', title: 'Play a game', spot: '#play-btn', text: "Pick a game, then choose who's playing: the computer, someone next to you, or someone online." },
        { icon: '🎮', title: 'Game Lobby', spot: '#game-lobby', text: 'Family tables waiting for a player show here, with invites sent to you. Tap Join to sit down.' },
        { icon: '🌐', title: 'Host a table', spot: '#host-btn', text: 'Start an online game and get a PIN. The family sees your table in the Game Lobby.' },
        { icon: '🔑', title: 'Join with PIN', spot: '#join-pin-btn', text: 'Someone gave you a 4-digit PIN? Tap here and type it.' },
        { icon: '💬', title: 'Family Chat', spot: '#message-board-container', text: 'Say hi to the family. Quick messages send in one tap.' },
        { icon: '❓', title: 'Help any time', spot: '#help-btn', text: 'Tap ❓ for help, and Rules inside any game to learn how to play it.' },
    ];

    const TOUR_KEY = 'webbs_tour_done';
    const SEEN_KEY = 'webbs_help_seen'; // games whose guide already opened by itself on this phone
    const $ = id => document.getElementById(id);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    };

    // ---------- The help window ----------

    let lastFocus = null;

    function build() {
        if ($('help-panel')) return;
        const modal = el('div', 'game-over-modal help-modal');
        modal.id = 'help-panel';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'help-title');
        modal.innerHTML = `
            <div class="modal-content help-box">
                <div class="help-head">
                    <button type="button" class="help-back" id="help-back" aria-label="All help topics">←</button>
                    <h2 id="help-title" class="help-title">Help</h2>
                    <button type="button" class="help-close" id="help-close" aria-label="Close help">✕</button>
                </div>
                <div class="help-body" id="help-body"></div>
                <div class="help-foot" id="help-foot"></div>
            </div>`;
        document.body.appendChild(modal);
        $('help-close').onclick = close;
        $('help-back').onclick = openList;
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });
    }

    function show() {
        if ($('help-panel').style.display !== 'flex') lastFocus = document.activeElement;
        $('help-panel').style.display = 'flex';
        $('help-body').scrollTop = 0;
        try { $('help-close').focus(); } catch (e) {}
    }

    function close() {
        const modal = $('help-panel');
        if (modal) modal.style.display = 'none';
        try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    }

    // One topic: the goal, numbered steps, then tips
    function open(topicId, opts = {}) {
        const t = TOPICS[topicId];
        if (!t) return openList();
        build();
        $('help-title').textContent = `${t.icon} ${t.title}`;
        $('help-back').style.visibility = 'visible';
        const body = $('help-body');
        body.innerHTML = '';
        if (t.goal) {
            const goal = el('p', 'help-goal');
            goal.append(el('strong', '', 'Goal: '), document.createTextNode(t.goal));
            body.appendChild(goal);
        }
        const ol = el('ol', 'help-steps');
        t.steps.forEach(s => ol.appendChild(el('li', '', s)));
        body.appendChild(ol);
        (t.tips || []).forEach(tip => body.appendChild(el('p', 'help-tip', '💡 ' + tip)));
        if (t.group === 'game') {
            const more = el('p', 'help-more', 'Playing with someone online? ');
            const link = el('button', 'help-link', 'How online play works');
            link.type = 'button';
            link.onclick = () => open('host');
            more.appendChild(link);
            body.appendChild(more);
        }
        const foot = $('help-foot');
        foot.innerHTML = '';
        const done = el('button', 'modal-btn help-done', opts.firstTime ? "Let's play!" : 'Got it');
        done.type = 'button';
        done.onclick = close;
        foot.appendChild(done);
        show();
    }

    // Every topic, grouped: how things work, then the games
    function openList() {
        build();
        $('help-title').textContent = '❓ Help';
        $('help-back').style.visibility = 'hidden';
        const body = $('help-body');
        body.innerHTML = '';
        const groups = [['help', 'How things work'], ['game', 'How to play each game']];
        groups.forEach(([group, label]) => {
            body.appendChild(el('h3', 'help-group', label));
            const list = el('div', 'help-topics');
            ORDER.filter(id => TOPICS[id] && TOPICS[id].group === group).map(id => [id, TOPICS[id]]).forEach(([id, t]) => {
                const b = el('button', 'help-topic');
                b.type = 'button';
                b.dataset.topic = id;
                b.append(el('span', 'help-topic-icon', t.icon), el('span', '', t.title));
                b.onclick = () => open(id);
                list.appendChild(b);
            });
            body.appendChild(list);
        });
        const foot = $('help-foot');
        foot.innerHTML = '';
        if (document.getElementById('main-menu')) {
            const tour = el('button', 'modal-btn help-tour-btn', '🧭 Take the tour');
            tour.type = 'button';
            tour.onclick = () => { close(); startTour(); };
            foot.appendChild(tour);
        }
        const done = el('button', 'modal-btn help-done', 'Close');
        done.type = 'button';
        done.onclick = close;
        foot.appendChild(done);
        show();
    }

    // ---------- The lobby tour ----------

    let tourAt = -1;

    function startTour() {
        const menu = document.getElementById('main-menu');
        if (!menu || menu.style.display === 'none') return;
        tourAt = 0;
        paintTour();
    }

    function maybeTour() {
        if (store.get(TOUR_KEY)) return;
        // Not over an invite link that is joining a table right now
        const join = document.getElementById('join-game-modal');
        if (join && join.style.display === 'flex') return;
        startTour();
    }

    function endTour() {
        tourAt = -1;
        store.set(TOUR_KEY, '1');
        document.querySelectorAll('.help-spot').forEach(e => e.classList.remove('help-spot'));
        const card = $('help-tour');
        if (card) card.remove();
    }

    function paintTour() {
        // Skip steps whose part of the page isn't showing for this player
        while (tourAt < TOUR.length && TOUR[tourAt].spot && !visible(document.querySelector(TOUR[tourAt].spot))) tourAt++;
        if (tourAt >= TOUR.length) return endTour();
        const step = TOUR[tourAt];
        let card = $('help-tour');
        if (!card) {
            card = el('div', 'help-tour');
            card.id = 'help-tour';
            card.setAttribute('role', 'dialog');
            card.setAttribute('aria-live', 'polite');
            card.setAttribute('aria-label', 'Tour');
            document.body.appendChild(card);
        }
        card.innerHTML = '';
        card.appendChild(el('div', 'help-tour-icon', step.icon));
        card.appendChild(el('div', 'help-tour-title', step.title));
        card.appendChild(el('p', 'help-tour-text', step.text));
        const count = TOUR.filter(s => !s.spot || visible(document.querySelector(s.spot))).length;
        const place = TOUR.slice(0, tourAt + 1).filter(s => !s.spot || visible(document.querySelector(s.spot))).length;
        const row = el('div', 'help-tour-row');
        const skip = el('button', 'help-tour-skip', 'Skip');
        skip.type = 'button';
        skip.onclick = endTour;
        const dots = el('span', 'help-tour-count', `${place} of ${count}`);
        const last = place >= count;
        const next = el('button', 'modal-btn help-tour-next', last ? 'Done' : 'Next');
        next.type = 'button';
        next.onclick = () => { tourAt++; paintTour(); };
        if (last) next.onclick = endTour;
        row.append(skip, dots, next);
        card.appendChild(row);

        document.querySelectorAll('.help-spot').forEach(e => e.classList.remove('help-spot'));
        const spot = step.spot && document.querySelector(step.spot);
        if (spot) {
            spot.classList.add('help-spot');
            try { spot.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        }
        placeTour(card, spot);
        setTimeout(() => placeTour(card, spot), 450); // again once the smooth scroll has settled
        try { next.focus(); } catch (e) {}
    }

    // The tour card sits at the bottom, unless that would cover the part it is pointing at:
    // then it moves to the top (Family Chat's quick messages are near the bottom of the lobby)
    function placeTour(card, spot) {
        if (!card.isConnected) return;
        if (!spot) return card.classList.remove('at-top');
        const r = spot.getBoundingClientRect();
        const room = card.offsetHeight + 24;
        const coverBottom = Math.max(0, r.bottom - (window.innerHeight - room));
        const coverTop = Math.max(0, room - r.top);
        card.classList.toggle('at-top', coverBottom > coverTop);
    }

    function visible(node) {
        if (!node) return false;
        for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
            if (n.hidden || n.style.display === 'none') return false;
        }
        return true;
    }

    // ---------- Buttons on each page ----------

    const pageGame = () => {
        const path = window.location.pathname;
        return path.includes('/games/') ? path.split('/games/')[1].split('/')[0] : null;
    };

    // Lobby and games list: ❓ Help first in the top bar's tools corner (games have 📖 Rules there instead)
    function mountHelpButton() {
        const tools = document.querySelector('.app-bar .bar-tools');
        if ($('help-btn') || pageGame() || !tools) return;
        const btn = el('button', 'help-btn', '❓');
        btn.type = 'button';
        btn.id = 'help-btn';
        btn.setAttribute('aria-label', 'Help');
        btn.title = 'Help: how everything works';
        btn.onclick = openList;
        tools.prepend(btn);
    }

    // 📖 Rules in a game's top bar: keeps its open/closed state for screen readers,
    // and closes when you tap anywhere else, like every other drop-down
    function wireRulesButton() {
        const block = $('rules-block');
        const toggle = block && block.querySelector('.rules-toggle');
        if (!toggle || toggle.dataset.wired) return;
        toggle.dataset.wired = '1';
        const sync = () => toggle.setAttribute('aria-expanded', String(block.classList.contains('expanded')));
        new MutationObserver(sync).observe(block, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('click', e => {
            if (block.classList.contains('expanded') && !block.contains(e.target)) block.classList.remove('expanded');
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && block.classList.contains('expanded')) { block.classList.remove('expanded'); toggle.focus(); }
        });
        sync();
    }

    // Each game's Rules pill: a button to the full step-by-step guide.
    // The first time a game opens on this phone, its guide opens by itself.
    function mountGameHelp() {
        const game = pageGame();
        const rules = $('rules-content');
        if (!game || !TOPICS[game] || !rules || $('rules-guide-btn')) return;
        const btn = el('button', 'rules-guide-btn', '📖 Step by step');
        btn.type = 'button';
        btn.id = 'rules-guide-btn';
        btn.onclick = e => { e.stopPropagation(); $('rules-block').classList.remove('expanded'); open(game); };
        rules.appendChild(btn);

        let seen = {};
        try { seen = JSON.parse(store.get(SEEN_KEY)) || {}; } catch (e) {}
        if (!seen[game]) {
            seen[game] = 1;
            store.set(SEEN_KEY, JSON.stringify(seen));
            open(game, { firstTime: true });
        }
    }

    function mount() { mountHelpButton(); wireRulesButton(); mountGameHelp(); }
    // After the sound switch (audio.js) is in place, so the ❓ sits beside it
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();

    return { TOPICS, TOUR, open, openList, close, startTour, maybeTour, endTour };
})();
window.WubsHelp = WubsHelp;
