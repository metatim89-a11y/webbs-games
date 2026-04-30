let activePlayer = null;
let currentPinInput = "";
let pinVisible = false;

const PIN_CONFIG = {
    tim: { name: "Tim", theme: "theme-tim" },
    arieal: { name: "Arieal", theme: "theme-arieal" },
    az: { name: "AZ", theme: "theme-az" },
    cassie: { name: "Cassie", theme: "theme-cassie" },
    guest: { name: "Guest", theme: "theme-guest" }
};

function initLogin(playerID) {
    activePlayer = playerID;
    currentPinInput = "";
    pinVisible = false;
    updatePinDisplay();

    if (playerID === 'guest') {
        loginSuccess('guest');
        return;
    }

    const overlay = document.getElementById('pin-overlay');
    const msg = document.getElementById('pin-msg');
    const storedPin = localStorage.getItem(`pin_${playerID}`);
    
    msg.innerText = !storedPin ? `Create PIN for ${PIN_CONFIG[playerID].name}` : `Enter PIN for ${PIN_CONFIG[playerID].name}`;
    overlay.style.display = 'flex';
}

function appendPin(num) {
    if (currentPinInput.length < 4) {
        currentPinInput += num;
        updatePinDisplay();
    }
}

function clearPin() {
    currentPinInput = "";
    updatePinDisplay();
}

function togglePinVisibility() {
    pinVisible = !pinVisible;
    const btn = document.querySelector('#pin-overlay button[onclick="togglePinVisibility()"]');
    if (btn) {
        btn.style.background = pinVisible ? "gold" : "none";
        btn.style.color = pinVisible ? "black" : "gold";
    }
    updatePinDisplay();
}

function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    if (!display) return;
    
    let dots = pinVisible ? currentPinInput : "*".repeat(currentPinInput.length);
    display.innerText = dots.padEnd(4, "-");
}

function closePinOverlay() {
    document.getElementById('pin-overlay').style.display = 'none';
    currentPinInput = "";
    // Reset toggle button state
    const btn = document.querySelector('#pin-overlay button[onclick="togglePinVisibility()"]');
    if (btn) {
        btn.style.background = "none";
        btn.style.color = "gold";
    }
}

function submitPin() {
    if (currentPinInput.length !== 4) return;
    const storedPin = localStorage.getItem(`pin_${activePlayer}`);
    
    if (!storedPin) {
        localStorage.setItem(`pin_${activePlayer}`, currentPinInput);
        loginSuccess(activePlayer);
    } else if (currentPinInput === storedPin) {
        loginSuccess(activePlayer);
    } else {
        alert("Wrong PIN.");
        clearPin();
    }
}

function loginSuccess(playerID) {
    activePlayer = playerID;
    sessionStorage.setItem('webbs_active_player', playerID);
    document.body.className = PIN_CONFIG[playerID].theme;
    closePinOverlay();
    
    // Call the central UI transition from main.js
    if (typeof showMainMenu === "function") {
        showMainMenu();
    } else {
        // Fallback if main.js isn't ready
        document.getElementById('player-select').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
        if (typeof renderMessages === "function") renderMessages();
    }
}
