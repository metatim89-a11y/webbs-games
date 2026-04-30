/* --- Global State --- */
let messages = JSON.parse(localStorage.getItem('webbs_messages')) || [];

/* --- Initialization --- */
window.onload = () => {
    renderMessages();
};

/* --- Message Board Logic --- */
function postMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();

    if (!text) return;
    if (!activePlayer) {
        alert("Please log in to post a message!");
        return;
    }

    const newMessage = {
        sender: PIN_CONFIG[activePlayer].name,
        color: activePlayer,
        body: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    messages.push(newMessage);
    
    // Keep only the last 20 messages to save space
    if (messages.length > 20) messages.shift();

    localStorage.setItem('webbs_messages', JSON.stringify(messages));
    input.value = "";
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('messages');
    container.innerHTML = "";

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `msg theme-${msg.color}`;
        div.style.borderLeft = `4px solid var(--primary-color)`;
        div.style.background = `rgba(255,255,255,0.05)`;
        div.innerHTML = `<strong>${msg.sender}:</strong> ${msg.body} <small style="float:right; opacity:0.5;">${msg.timestamp}</small>`;
        container.appendChild(div);
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/* --- Global Lobby Refresh --- */
window.refreshLobby = () => {
    console.log("Lobby refreshed for " + activePlayer);
    renderMessages();
};

/* --- Navigation Logic --- */
function launchGame(gamePath) {
    if (!activePlayer) {
        alert("Please log in first!");
        return;
    }
    // Pass the player ID in the URL so the game knows who is playing
    window.location.href = `games/${gamePath}/index.html?player=${activePlayer}`;
}
