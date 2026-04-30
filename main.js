/* --- Global State --- */
let messages = JSON.parse(localStorage.getItem('webbs_messages')) || [];

/* --- Initialization --- */
window.onload = () => {
    // If a session exists, you could auto-login here, 
    // but for now, we wait for auth.js to call showMainMenu.
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

/* --- Navigation Logic --- */
function showGameSelection(mode) {
    // mode is 'online' (Create Table) or 'local' (Play Games)
    window.location.href = `games.html?player=${activePlayer}&mode=${mode}`;
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

    messages.push(newMessage);
    
    // Keep only the last 20 messages
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
        // Apply theme color to the message bubble based on sender
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
