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
    updatePinDisplay();
}

function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    if (!display) return;
    
    if (currentPinInput.length === 0) {
        display.innerText = "----";
    } else {
        display.innerText = pinVisible ? currentPinInput : "*".repeat(currentPinInput.length);
    }
}

function closePinOverlay() {
    document.getElementById('pin-overlay').style.display = 'none';
    currentPinInput = "";
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
    document.body.className = PIN_CONFIG[playerID].theme;
    closePinOverlay();
    
    // Manual Redirection to Menu
    document.getElementById('player-select').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    
    // Ensure chat is rendered
    if (typeof renderMessages === "function") {
        renderMessages();
    }
}
