/* --- Global State --- */
console.log("Wubs Games: main.js loading...");
let messages = JSON.parse(localStorage.getItem('webbs_messages')) || [];

/* --- Initialization --- */
window.onload = () => {
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

/* --- Player Selection Rendering --- */
function renderPlayerSelect() {
    const grid = document.getElementById('player-select');
    if (!grid) return;

    // Standard players
    const defaults = [
        { id: 'arieal', name: 'Arieal' },
        { id: 'az', name: 'AZ' },
        { id: 'cassie', name: 'Cassie' },
        { id: 'tim', name: 'Tim' }
    ];

    // Approved dynamic players
    const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
    
    // Combine and add Guest last
    const allPlayers = [...defaults, ...approved, { id: 'guest', name: 'Guest' }];

    grid.innerHTML = allPlayers.map(p => `
        <div class="player-card" onclick="initLogin('${p.id}')">
            <h3>${p.name}</h3>
        </div>
    `).join('');
}

/* --- Admin Notifications --- */
function checkAdminNotifications() {
    const gear = document.getElementById('admin-gear');
    if (!gear) return;
    
    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    if (activePlayer === 'tim' && pending.length > 0) {
        gear.classList.add('admin-only'); // Show gear
        // Could add a red dot here if we want
    } else if (activePlayer === 'tim') {
        gear.classList.add('admin-only');
    } else {
        gear.classList.remove('admin-only');
    }
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
        welcomeName.innerText = `Welcome, ${activePlayer.toUpperCase()}!`;
    }
    
    checkAdminNotifications();
    renderMessages();
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
    document.getElementById('view-animal').innerText = prefs.favoriteAnimal || "None";
    document.getElementById('view-game').innerText = prefs.favoriteGame || "None";
}

/* --- Sign Up Logic --- */
function openSignup() {
    document.getElementById('signup-modal').style.display = 'flex';
}

function closeSignup() {
    document.getElementById('signup-modal').style.display = 'none';
}

function submitSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const animal = document.getElementById('signup-animal').value.trim();
    const game = document.getElementById('signup-game').value.trim();
    const color1 = document.getElementById('signup-color-1').value;
    const color2 = document.getElementById('signup-color-2').value;
    const color3 = document.getElementById('signup-color-3').value;

    if (!name || !animal || !game) {
        alert("Please fill out all fields!");
        return;
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

function logout() {
    sessionStorage.removeItem('webbs_active_player');
    location.reload();
}

/* --- Messaging --- */
function postMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    messages.push({ sender: activePlayer, body: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (messages.length > 20) messages.shift();
    localStorage.setItem('webbs_messages', JSON.stringify(messages));
    input.value = "";
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    container.innerHTML = messages.map(m => `
        <div style="margin-bottom: 8px; font-size: 0.9em;">
            <strong style="color: gold;">${m.sender.toUpperCase()}:</strong> ${m.body}
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}
