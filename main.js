/* --- Global State --- */
let messages = JSON.parse(localStorage.getItem('webbs_messages')) || [];

/* --- Initialization --- */
window.onload = () => {
    // Check if we have a persisted session
    const persistedPlayer = sessionStorage.getItem('webbs_active_player');
    if (persistedPlayer && typeof loginSuccess === "function") {
        loginSuccess(persistedPlayer);
    }
    
    renderMessages();
};

/* --- UI Transition --- */
function showMainMenu() {
    const playerSelect = document.getElementById('player-select');
    const mainMenu = document.getElementById('main-menu');
    
    if (playerSelect) playerSelect.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'block';
    
    console.log("Switched to Main Menu for: " + activePlayer);
    renderMessages();
}

/* --- Table Discovery Logic (Manual PIN only now) --- */
function showViewTables() {
    const container = document.getElementById('view-tables-container');
    if (container) container.style.display = 'block';
    // Firebase is removed, so we only show instructions for Join PIN
    const list = document.getElementById('active-tables-list');
    if (list) {
        list.innerHTML = "<p style='opacity:0.8;'>Global discovery is disabled. Use the <strong>Join PIN</strong> button to enter a 4-digit code provided by your friend.</p>";
    }
}

function hideViewTables() {
    const container = document.getElementById('view-tables-container');
    if (container) container.style.display = 'none';
}

/* --- Navigation Logic --- */
function showGameSelection(mode) {
    // mode is 'online' (Create Table) or 'local' (Play Games)
    window.location.href = `games.html?player=${activePlayer}&mode=${mode}`;
}

function joinTablePrompt() {
    const pin = prompt("Enter the 4-digit Table PIN to join:");
    if (pin && pin.length === 4) {
        window.location.href = `games.html?player=${activePlayer}&mode=join&host=${pin}`;
    } else if (pin) {
        alert("Please enter a valid 4-digit PIN.");
    }
}

function logout() {
    sessionStorage.removeItem('webbs_active_player');
    location.reload();
}

/* --- Message Board / Chat Logic (Local Storage) --- */
function postMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();

    if (!text) return;
    if (!activePlayer) {
        alert("Please log in to post a message!");
        return;
    }

    const newMessage = {
        sender: activePlayer,
        body: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    messages.push(newMessage);
    if (messages.length > 20) messages.shift();

    localStorage.setItem('webbs_messages', JSON.stringify(messages));
    input.value = "";
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    container.innerHTML = "";

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `msg theme-${msg.sender}`;
        div.style.margin = "5px 0";
        div.style.padding = "8px";
        div.style.borderRadius = "5px";
        div.style.background = "rgba(255,255,255,0.05)";
        div.style.borderLeft = "4px solid var(--primary-color)";
        
        div.innerHTML = `<strong>${msg.sender.toUpperCase()}:</strong> ${msg.body} <span style="font-size:0.7em; float:right; opacity:0.5;">${msg.timestamp}</span>`;
        container.appendChild(div);
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/* --- Global Lobby Refresh --- */
window.refreshLobby = () => {
    renderMessages();
};
