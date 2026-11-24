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
    if (msgInput) msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') postMessage(); });

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

    grid.innerHTML = allPlayers.map(p => `
        <div class="player-card" onclick="initLogin('${escapeHTML(p.id)}')">
            <h3>${escapeHTML(p.name)}</h3>
        </div>
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
    if (logoutBtn) logoutBtn.style.display = 'block';

    if (welcomeName) {
        welcomeName.innerText = `Welcome, ${ProfileManager.resolveName(activePlayer).toUpperCase()}!`;
    }
    
    checkAdminNotifications();
    renderMessages();
    runPendingJoin();
    if (window.FamilyUI) FamilyUI.refresh();
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

    if (!name || !animal || !game) {
        alert("Please fill out all fields!");
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

    alert("Request sent to Tim!");
    closeSignup();
}

/* --- Navigation --- */
function showGameSelection(mode) {
    window.location.href = `games.html?player=${activePlayer}&mode=${mode}`;
}

function joinTablePrompt() {
    document.getElementById('join-game-modal').style.display = 'flex';
}

function closeJoinModal() {
    document.getElementById('join-game-modal').style.display = 'none';
}

function performAutoJoin() {
    const pin = document.getElementById('join-table-pin').value;
    if (pin.length !== 4) {
        alert("Enter a 4-digit Table PIN");
        return;
    }

    const statusEl = document.getElementById('join-status');
    const joinBtn = document.getElementById('join-btn-final');
    
    statusEl.innerText = "Connecting to table...";
    joinBtn.disabled = true;

    // Use PeerJS via NetworkManager to query the host
    if (typeof NetworkManager !== 'undefined') {
        NetworkManager.queryGame(pin, (game) => {
            if (game) {
                statusEl.innerText = "Table Found! Redirecting...";
                setTimeout(() => {
                    window.location.href = `games/${game}/index.html?player=${activePlayer}&type=online&role=client&host=${pin}`;
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
        alert("Network module not loaded. Please refresh.");
        joinBtn.disabled = false;
    }
}

async function logout() {
    sessionStorage.removeItem('webbs_active_player');
    if (window.WebbsCloud) await WebbsCloud.signOut();
    location.reload();
}

/* --- Messaging --- */
function postMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    // Approved family: the chat is shared by every phone
    if (document.body.classList.contains('cloud-chat')) {
        input.value = "";
        FamilyUI.postBoard(text).catch(() => { input.value = text; });
        return;
    }

    messages.push({ sender: activePlayer, body: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (messages.length > 20) messages.shift();
    localStorage.setItem('webbs_messages', JSON.stringify(messages));
    input.value = "";
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    if (document.body.classList.contains('cloud-chat')) return; // FamilyUI shows the shared chat
    container.innerHTML = messages.map(m => `
        <div style="margin-bottom: 8px; font-size: 0.9em;">
            <strong style="color: gold;">${escapeHTML(String(m.sender).toUpperCase())}:</strong> ${escapeHTML(m.body)}
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}
