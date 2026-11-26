/* --- Global State --- */
console.log("Wubs Games: main.js loading...");
let messages = JSON.parse(localStorage.getItem('webbs_messages')) || [];

/* --- Initialization --- */
window.onload = () => {
    // Invite link (?join=PIN): remember it, then tidy the address bar
    const joinPin = new URLSearchParams(window.location.search).get('join');
    if (joinPin && /^\d{4}$/.test(joinPin)) {
        sessionStorage.setItem('webbs_pending_join', joinPin);
        history.replaceState(null, '', window.location.pathname);
    }
    showJoinBanner();
    const msgInput = document.getElementById('msg-input');
    if (msgInput) WebbsChat.bindInput(msgInput, document.getElementById('msg-send'), sendFamilyChat);
    // One-tap messages under Family Chat, the same set as in every game's table chat (chat.js)
    const quickSlot = document.getElementById('msg-quick-slot');
    if (quickSlot) {
        const quick = WebbsChat.quickRow(text => sendFamilyChat(text));
        quick.id = 'msg-quick';
        quickSlot.replaceWith(quick);
    }

    // Check if we have a persisted session
    const persistedPlayer = sessionStorage.getItem('webbs_active_player');
    if (persistedPlayer) {
        activePlayer = persistedPlayer;
        loginSuccess(persistedPlayer);
    }
    
    renderPlayerSelect();
    renderMessages();
    checkAdminNotifications();
};

/* --- Family account changes --- */
if (window.WebbsCloud) {
    WebbsCloud.onChange(me => {
        // A family account that isn't the player on screen must not stay signed in
        if (me && activePlayer && me.id !== activePlayer) { WebbsCloud.signOut(); return; }
        checkAdminNotifications();
    });
}

/* --- Player Selection Rendering --- */
function renderPlayerSelect() {
    const grid = document.getElementById('player-select');
    if (!grid) return;

    // Standard players
    const defaults = [
        { id: 'ariel', name: 'Ariel' },
        { id: 'az', name: 'AZ' },
        { id: 'cassie', name: 'Cassie' },
        { id: 'tim', name: 'Tim' }
    ];

    // Approved family (synced from the cloud) + accounts made on this phone
    const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
    const mine = JSON.parse(localStorage.getItem('webbs_my_accounts')) || [];
    const extra = [...approved, ...mine].filter((p, i, all) => !defaults.some(d => d.id === p.id) && all.findIndex(q => q.id === p.id) === i);

    // Combine and add Guest last
    const allPlayers = [...defaults, ...extra, { id: 'guest', name: 'Guest' }];

    // Real buttons, so a keyboard or screen reader can pick a player too
    grid.innerHTML = allPlayers.map(p => `
        <button type="button" class="player-card theme-${escapeHTML(p.id)}" onclick="initLogin('${escapeHTML(p.id)}')">
            <span class="avatar" aria-hidden="true">${p.id === 'guest' ? '🙂' : escapeHTML(String(p.name).charAt(0).toUpperCase())}</span>
            <h3>${escapeHTML(p.name)}</h3>
        </button>
    `).join('');
}

/* --- Admin Notifications --- */
function checkAdminNotifications() {
    const gear = document.getElementById('admin-gear');
    if (!gear) return;
    // Only Tim sees the settings gear (signed in with his PIN on this tab)
    const cloudAdmin = !!(window.WebbsCloud && WebbsCloud.me && WebbsCloud.me.admin);
    const isTim = activePlayer === 'tim' && sessionStorage.getItem('webbs_active_player') === 'tim';
    document.body.classList.toggle('cloud-admin', cloudAdmin);
    gear.classList.add('admin-only');
    gear.style.display = (cloudAdmin || isTim) ? 'block' : 'none';
}

/* --- UI Transition --- */
function showMainMenu() {
    const playerSelect = document.getElementById('player-select-container');
    const mainMenu = document.getElementById('main-menu');
    const logoutBtn = document.getElementById('logout-btn');
    const welcomeName = document.getElementById('active-player-name');
    
    if (playerSelect) playerSelect.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = '';

    if (welcomeName) setWelcome(ProfileManager.resolveName(activePlayer));
    
    checkAdminNotifications();
    renderMessages();
    runPendingJoin();
    if (window.FamilyUI) FamilyUI.refresh();
    // First time on this phone: a short tour of the lobby (Skip any time, ❓ Help brings it back)
    if (window.WubsHelp) setTimeout(() => WubsHelp.maybeTour(), 600);
}

// "Hi, Ariel!" with their first letter in a circle, the same on every visit
function setWelcome(name) {
    const h = document.getElementById('active-player-name');
    const avatar = document.getElementById('welcome-avatar');
    if (h) h.textContent = `Hi, ${name}!`;
    if (avatar) avatar.textContent = activePlayer === 'guest' ? '🙂' : String(name || '?').charAt(0).toUpperCase();
}

// Every page change from the lobby goes through here (tests swap it to watch where a tap leads)
function goTo(url) {
    window.location.href = url;
}

/* --- Invite links --- */
function showJoinBanner() {
    const pin = sessionStorage.getItem('webbs_pending_join');
    const container = document.getElementById('player-select-container');
    if (!pin || !container || document.getElementById('join-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'join-banner';
    banner.className = 'join-banner';
    banner.innerText = "🎲 You're invited to a game! Tap your name to join.";
    container.prepend(banner);
}

function runPendingJoin() {
    const pin = sessionStorage.getItem('webbs_pending_join');
    if (!pin || !activePlayer) return;
    sessionStorage.removeItem('webbs_pending_join');
    const banner = document.getElementById('join-banner');
    if (banner) banner.remove();
    joinTablePrompt();
    document.getElementById('join-table-pin').value = pin;
    performAutoJoin();
}

/* --- Profile Logic --- */
function openProfile() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.style.display = 'flex';
        refreshProfileView();
    }
}

function closeProfile() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
}

function toggleProfileEdit(show) {
    document.getElementById('profile-view').style.display = show ? 'none' : 'block';
    document.getElementById('profile-edit').style.display = show ? 'block' : 'none';
}

function saveProfile() {
    const animal = document.getElementById('edit-animal').value;
    const game = document.getElementById('edit-game').value;
    
    if (typeof ProfileManager !== 'undefined') {
        ProfileManager.savePreferences(activePlayer, { favoriteAnimal: animal, favoriteGame: game });
    }
    
    toggleProfileEdit(false);
    refreshProfileView();
}

function refreshProfileView() {
    if (typeof ProfileManager === 'undefined') return;
    const stats = ProfileManager.getStats(activePlayer);
    const prefs = ProfileManager.getPreferences(activePlayer);
    
    document.getElementById('stat-wins').innerText = stats.wins;
    document.getElementById('stat-losses').innerText = stats.losses;
    showCloudStats();
    document.getElementById('view-animal').innerText = prefs.favoriteAnimal || "None";
    document.getElementById('view-game').innerText = prefs.favoriteGame || "None";
}

// Family accounts: wins and losses from every phone (older results from this phone are copied up once)
async function showCloudStats() {
    const me = window.WebbsCloud && WebbsCloud.me;
    if (!me || !me.approved || me.id !== activePlayer) return;
    try {
        const syncedKey = `webbs_history_synced_${me.id}`;
        if (!localStorage.getItem(syncedKey)) {
            const local = JSON.parse(localStorage.getItem(`history_${me.id}`)) || [];
            local.forEach(h => WebbsCloud.recordResult(h.game, h.opponent ? ProfileManager.resolveName(h.opponent) : '', h.result));
            localStorage.setItem(syncedKey, '1');
        }
        const all = await WebbsCloud.getHistory(me.id);
        document.getElementById('stat-wins').innerText = all.filter(h => h.result === 'win').length;
        document.getElementById('stat-losses').innerText = all.filter(h => h.result === 'loss').length;
    } catch (e) { console.warn('cloud stats', e); }
}

/* --- Sign Up Logic --- */
function openSignup() {
    document.getElementById('signup-status').innerText = '';
    const btn = document.getElementById('signup-submit');
    btn.disabled = false; btn.innerText = 'Submit Request';
    document.getElementById('signup-modal').style.display = 'flex';
}

function closeSignup() {
    document.getElementById('signup-modal').style.display = 'none';
}

async function submitSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const pin = document.getElementById('signup-pin').value.trim();
    const pin2 = document.getElementById('signup-pin2').value.trim();
    const status = document.getElementById('signup-status');
    const animal = document.getElementById('signup-animal').value.trim();
    const game = document.getElementById('signup-game').value.trim();
    const color1 = document.getElementById('signup-color-1').value;
    const color2 = document.getElementById('signup-color-2').value;
    const color3 = document.getElementById('signup-color-3').value;

    // Messages show inside the form, right under the boxes, instead of a pop-up
    if (!name || !animal || !game) {
        status.innerText = "Fill in your name, favorite animal and favorite game.";
        return;
    }

    // Family account: the request reaches Tim on his own phone
    if (window.WebbsCloud && WebbsCloud.available) {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
        if (!id) { status.innerText = "Use letters or numbers in your name."; return; }
        if (!/^\d{4}$/.test(pin)) { status.innerText = "Pick a 4-digit PIN (numbers only)."; return; }
        if (pin !== pin2) { status.innerText = "The two PINs don't match."; return; }
        if (DEFAULT_PIN_CONFIG[id] || await WebbsCloud.hasAccount(id)) { status.innerText = "That name is taken. Try adding a letter or number."; return; }
        status.innerText = "Sending...";
        const r = await WebbsCloud.createAccount(id, pin, { name, animal, favGame: game, colors: [color1, color2, color3] });
        if (r.ok) {
            localStorage.setItem(`pin_${id}`, pin);
            status.innerText = "";
            closeSignup();
            renderPlayerSelect();
            loginSuccess(id);
            return;
        }
        if (!r.offline) { status.innerText = r.error || "Something went wrong."; return; }
    }

    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    pending.push({ 
        name, 
        animal, 
        game, 
        colors: [color1, color2, color3],
        timestamp: Date.now() 
    });
    localStorage.setItem('webbs_pending', JSON.stringify(pending));

    // The family server couldn't be reached, so the request is only on this phone: say so, then close
    status.innerText = "Saved on this phone. Tim can approve it here.";
    const btn = document.getElementById('signup-submit');
    btn.disabled = true; btn.innerText = 'Saved';
    setTimeout(closeSignup, 3000);
}

/* --- Navigation --- */
function showGameSelection(mode) {
    goTo(`games.html?player=${activePlayer}&mode=${mode}`);
}

function joinTablePrompt() {
    document.getElementById('join-status').innerText = '';
    document.getElementById('join-btn-final').disabled = false;
    document.getElementById('join-game-modal').style.display = 'flex';
}

// The PIN box takes digits only, 4 at most (a number box showed arrows and let any length through)
function cleanPinInput(input) {
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    if (input.value !== digits) input.value = digits;
}

function closeJoinModal() {
    document.getElementById('join-game-modal').style.display = 'none';
}

function performAutoJoin() {
    const pin = document.getElementById('join-table-pin').value.replace(/\D/g, '');
    const statusEl = document.getElementById('join-status');
    const joinBtn = document.getElementById('join-btn-final');
    if (pin.length !== 4) {
        statusEl.innerText = "Type the 4-digit PIN from the host's screen.";
        return;
    }
    
    statusEl.innerText = "Connecting to table...";
    joinBtn.disabled = true;

    // Use PeerJS via NetworkManager to query the host
    if (typeof NetworkManager !== 'undefined') {
        NetworkManager.queryGame(pin, (game) => {
            if (game) {
                statusEl.innerText = "Table Found! Redirecting...";
                setTimeout(() => {
                    goTo(`games/${game}/index.html?player=${activePlayer}&type=online&role=client&host=${pin}`);
                }, 1000);
            } else {
                statusEl.innerText = "Error: Game not found on this table.";
                joinBtn.disabled = false;
            }
        });

        // Set a failure timeout
        setTimeout(() => {
            if (statusEl.innerText === "Connecting to table...") {
                statusEl.innerText = "Failed to connect. Is the PIN correct?";
                joinBtn.disabled = false;
            }
        }, 6000);
    } else {
        statusEl.innerText = "Couldn't reach the game network. Refresh the page and try again.";
        joinBtn.disabled = false;
    }
}

async function logout() {
    sessionStorage.removeItem('webbs_active_player');
    if (window.WebbsCloud) await WebbsCloud.signOut();
    location.reload();
}

/* --- Family Chat --- */
// Called with the trimmed text by WebbsChat.bindInput (Enter or the Send button)
function sendFamilyChat(text) {
    showFamilyChatError('');

    // Approved family: the chat is shared by every phone
    if (document.body.classList.contains('cloud-chat')) {
        FamilyUI.postBoard(text).catch(() => {
            const input = document.getElementById('msg-input');
            if (input && !input.value) input.value = text; // give the words back so nothing is lost
            showFamilyChatError("That message didn't send. Check your signal and try again.");
        });
        return true;
    }

    // Everyone else: the chat is kept on this phone only
    messages.push({ sender: activePlayer, body: text, ts: Date.now() });
    if (messages.length > 20) messages.shift();
    localStorage.setItem('webbs_messages', JSON.stringify(messages));
    renderMessages();
    return true;
}

function showFamilyChatError(text) {
    const box = document.getElementById('family-chat-error');
    if (box) box.textContent = text;
}

// Says plainly when Family Chat only lives on this phone, and why
function familyChatNote() {
    const me = window.WebbsCloud && WebbsCloud.me;
    if (activePlayer === 'guest') return 'Guest messages stay on this phone. Pick your profile to chat with the family.';
    if (me && me.id === activePlayer && !me.approved) return 'Your messages stay on this phone until your profile is approved.';
    return 'Messages here stay on this phone for now.';
}

function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    if (document.body.classList.contains('cloud-chat')) return; // FamilyUI shows the shared chat
    const note = document.getElementById('family-chat-note');
    if (note) note.textContent = familyChatNote();
    container.innerHTML = '';
    messages.forEach(m => container.appendChild(WebbsChat.line({
        name: ProfileManager.resolveName(String(m.sender || 'guest')),
        text: m.body,
        when: m.ts || m.timestamp, // older saved messages kept a ready-made time
        mine: m.sender === activePlayer
    })));
    if (!messages.length) container.appendChild(WebbsChat.empty('No messages yet. Say hello! 👋'));
    container.scrollTop = container.scrollHeight;
}
