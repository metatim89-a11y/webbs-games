/* --- Complete Auth Logic --- */
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
    pinVisible = false; // Reset visibility on every new login attempt
    updatePinDisplay();

    if (playerID === 'guest') {
        loginSuccess('guest');
        return;
    }

    const overlay = document.getElementById('pin-overlay');
    const msg = document.getElementById('pin-msg');
    const storedPin = localStorage.getItem(`pin_${playerID}`);
    
    if (!storedPin) {
        msg.innerText = `Welcome ${PIN_CONFIG[playerID].name}! Create your 4-digit PIN:`;
    } else {
        msg.innerText = `Hello ${PIN_CONFIG[playerID].name}, enter your PIN:`;
    }

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
    if (display) {
        if (currentPinInput.length === 0) {
            display.innerText = "----";
        } else {
            display.innerText = pinVisible ? currentPinInput : "*".repeat(currentPinInput.length);
        }
    }
}

function closePinOverlay() {
    const overlay = document.getElementById('pin-overlay');
    if (overlay) overlay.style.display = 'none';
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
        alert("Incorrect PIN. Try again.");
        clearPin();
    }
}

function loginSuccess(playerID) {
    activePlayer = playerID;
    document.body.className = "";
    document.body.classList.add(PIN_CONFIG[playerID].theme);
    closePinOverlay();
    if (typeof showMainMenu === "function") {
        showMainMenu();
    }
}
