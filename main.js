/* --- Global State --- */
let messages = JSON.parse(localStorage.getItem('webbs_messages')) || [];

/* --- Initialization --- */
window.onload = () => {
    // Check if we have a persisted session
    const persistedPlayer = sessionStorage.getItem('webbs_active_player');
    if (persistedPlayer && typeof loginSuccess === "function") {
        loginSuccess(persistedPlayer);
    }
    
    // Start watching global discovery tables
    if (typeof FirebaseManager !== 'undefined') {
        FirebaseManager.watchTables(renderActiveTables);
        FirebaseManager.syncChat(addRemoteMessage);
    } else {
        renderMessages();
    }
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

/* --- Table Discovery Logic --- */
function renderActiveTables(tables) {
    const list = document.getElementById('active-tables-list');
    if (!list) return;

    if (tables.length === 0) {
        list.innerHTML = "<p style='opacity:0.6;'>No active tables found. Why not create one?</p>";
        return;
    }

    list.innerHTML = "";
    tables.forEach(table => {
        const div = document.createElement('div');
        div.style.cssText = "background:rgba(255,255,255,0.05); border:1px solid gold; padding:15px; margin:10px 0; border-radius:10px; display:flex; justify-content:space-between; align-items:center;";
        
        div.innerHTML = `
            <div style="text-align:left;">
                <div style="font-weight:bold; color:gold;">${table.gameName.toUpperCase()}</div>
                <div style="font-size:0.8em; opacity:0.8;">Host: ${table.hostName}</div>
            </div>
            <button onclick="joinTable('${table.pin}', '${table.gameName.toLowerCase().replace(/ /g, '-')}')" style="padding:5px 15px;">Join</button>
        `;
        list.appendChild(div);
    });
}

function joinTable(pin, gameSlug) {
    window.location.href = `games/${gameSlug}/index.html?player=${activePlayer}&type=online&role=client&host=${pin}`;
}

function showViewTables() {
    const container = document.getElementById('view-tables-container');
    if (container) container.style.display = 'block';
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

/* --- Message Board / Chat Logic --- */
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

    if (typeof FirebaseManager !== 'undefined') {
        FirebaseManager.postChat(newMessage);
    } else {
        // Fallback to local storage if Firebase isn't set up
        let localMessages = JSON.parse(localStorage.getItem('webbs_messages')) || [];
        localMessages.push(newMessage);
        if (localMessages.length > 20) localMessages.shift();
        localStorage.setItem('webbs_messages', JSON.stringify(localMessages));
        renderMessages();
    }
    
    input.value = "";
}

function addRemoteMessage(msg) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = `msg theme-${msg.sender}`;
    div.style.margin = "5px 0";
    div.style.padding = "8px";
    div.style.borderRadius = "5px";
    div.style.background = "rgba(255,255,255,0.05)";
    div.style.borderLeft = "4px solid var(--primary-color)";
    
    div.innerHTML = `<strong>${msg.sender.toUpperCase()}:</strong> ${msg.body} <span style="font-size:0.7em; float:right; opacity:0.5;">${msg.timestamp}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function renderMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    // If Firebase is active, clear container once and wait for Firebase syncChat
    if (typeof FirebaseManager !== 'undefined') {
        container.innerHTML = "";
        return;
    }

    let localMessages = JSON.parse(localStorage.getItem('webbs_messages')) || [];
    container.innerHTML = "";
    localMessages.forEach(msg => {
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
    container.scrollTop = container.scrollHeight;
}

/* --- Global Lobby Refresh --- */
window.refreshLobby = () => {
    if (typeof FirebaseManager === 'undefined') renderMessages();
};
