/* --- Auth State --- */
let activePlayer = null;
let currentPinInput = "";

const PIN_CONFIG = {
    tim: { name: "Tim", theme: "theme-tim" },
    arieal: { name: "Arieal", theme: "theme-arieal" },
    az: { name: "AZ", theme: "theme-az" },
    cassie: { name: "Cassie", theme: "theme-cassie" },
    guest: { name: "Guest", theme: "theme-guest" }
};

/* --- Login Initialization --- */
function initLogin(playerID) {
    activePlayer = playerID;
    currentPinInput = "";
    updatePinDisplay();

    // Guest Bypass
    if (playerID === 'guest') {
        loginSuccess('guest');
        return;
    }

    const overlay = document.getElementById('pin-overlay');
    const msg = document.getElementById('pin-msg');
    
    // Check if PIN is already set in localStorage
    const storedPin = localStorage.getItem(`pin_${playerID}`);
    
    if (!storedPin) {
        msg.innerText = `Welcome ${PIN_CONFIG[playerID].name}! Create your 4-digit PIN:`;
    } else {
        msg.innerText = `Hello ${PIN_CONFIG[playerID].name}, enter your PIN:`;
    }

    overlay.style.display = 'flex';
}

/* --- Keypad Logic --- */
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

function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    display.innerText = "*".repeat(currentPinInput.length) || "----";
}

function closePinOverlay() {
    document.getElementById('pin-overlay').style.display = 'none';
    currentPinInput = "";
}

/* --- Validation --- */
function submitPin() {
    if (currentPinInput.length !== 4) return;

    const storedPin = localStorage.getItem(`pin_${activePlayer}`);

    if (!storedPin) {
        // First time setup
        localStorage.setItem(`pin_${activePlayer}`, currentPinInput);
        alert("PIN Created Successfully!");
        loginSuccess(activePlayer);
    } else if (currentPinInput === storedPin) {
        // Success
        loginSuccess(activePlayer);
    } else {
        // Fail
        alert("Incorrect PIN. Try again.");
        clearPin();
    }
}

/* --- Session Handling --- */
function loginSuccess(playerID) {
    // 1. Remove any existing theme classes
    document.body.className = "";
    
    // 2. Apply new theme
    document.body.classList.add(PIN_CONFIG[playerID].theme);
    
    // 3. Close overlay
    closePinOverlay();
    
    // 4. Update UI for Tim's Admin access
    console.log(`${PIN_CONFIG[playerID].name} logged in.`);
    
    // Trigger main lobby refresh
    if (window.refreshLobby) window.refreshLobby();
}
