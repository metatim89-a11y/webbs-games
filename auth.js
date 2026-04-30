/* --- Login Success with Redirection --- */
function loginSuccess(playerID) {
    // 1. Save session (optional for persistence)
    sessionStorage.setItem('activePlayer', playerID);
    
    // 2. Redirect to the Game Selection page
    window.location.href = `games.html?player=${playerID}`;
}

/* --- Keep the rest of your existing auth logic below --- */
let activePlayer = null;
let currentPinInput = "";

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
    updatePinDisplay();
    if (playerID === 'guest') { loginSuccess('guest'); return; }
    const overlay = document.getElementById('pin-overlay');
    const msg = document.getElementById('pin-msg');
    const storedPin = localStorage.getItem(`pin_${playerID}`);
    if (!storedPin) { msg.innerText = `Welcome ${PIN_CONFIG[playerID].name}! Create your 4-digit PIN:`; } 
    else { msg.innerText = `Hello ${PIN_CONFIG[playerID].name}, enter your PIN:`; }
    overlay.style.display = 'flex';
}

function appendPin(num) { if (currentPinInput.length < 4) { currentPinInput += num; updatePinDisplay(); } }
function clearPin() { currentPinInput = ""; updatePinDisplay(); }
function updatePinDisplay() { document.getElementById('pin-display').innerText = "*".repeat(currentPinInput.length) || "----"; }
function closePinOverlay() { document.getElementById('pin-overlay').style.display = 'none'; currentPinInput = ""; }

function submitPin() {
    if (currentPinInput.length !== 4) return;
    const storedPin = localStorage.getItem(`pin_${activePlayer}`);
    if (!storedPin) {
        localStorage.setItem(`pin_${activePlayer}`, currentPinInput);
        loginSuccess(activePlayer);
    } else if (currentPinInput === storedPin) {
        loginSuccess(activePlayer);
    } else {
        alert("Incorrect PIN.");
        clearPin();
    }
}
