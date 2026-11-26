let activePlayer = null;
let currentPinInput = "";
let pinVisible = false;
let pinMode = 'enter';        // 'enter' | 'create' | 'confirm'
let firstNewPin = "";         // new PIN typed once, waiting for the second time
let pinBusy = false;

const DEFAULT_PIN_CONFIG = {
    tim: { name: "Tim", theme: "theme-tim" },
    ariel: { name: "Ariel", theme: "theme-ariel" },
    az: { name: "AZ", theme: "theme-az" },
    cassie: { name: "Cassie", theme: "theme-cassie" },
    guest: { name: "Guest", theme: "theme-guest" }
};

function getPinConfig(playerID) {
    if (DEFAULT_PIN_CONFIG[playerID]) return DEFAULT_PIN_CONFIG[playerID];
    const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
    const mine = JSON.parse(localStorage.getItem('webbs_my_accounts')) || [];
    const player = approved.find(p => p.id === playerID) || mine.find(p => p.id === playerID);
    return player ? { name: player.name, theme: player.theme || `theme-${playerID}` } : { name: playerID, theme: `theme-${playerID}` };
}

function setPinMessage(text, isError = false) {
    const msg = document.getElementById('pin-msg');
    msg.innerText = text;
    msg.classList.toggle('pin-error', isError);
    if (isError) {
        const box = document.querySelector('#pin-overlay .modal-content');
        box.classList.remove('shake-x'); void box.offsetWidth; box.classList.add('shake-x');
    }
}

async function initLogin(playerID) {
    activePlayer = playerID;
    currentPinInput = "";
    firstNewPin = "";
    pinVisible = false;
    updatePinDisplay();

    if (playerID === 'guest') {
        loginSuccess('guest');
        return;
    }

    const config = getPinConfig(playerID);
    document.getElementById('pin-overlay').style.display = 'flex';
    pinMode = 'enter';
    setPinMessage(`Enter PIN for ${config.name}`);

    // Brand-new player (no family account and no PIN on this phone): make a PIN
    const hasCloud = window.WebbsCloud ? await WebbsCloud.hasAccount(playerID) : null;
    const hasLocal = !!localStorage.getItem(`pin_${playerID}`);
    if (activePlayer !== playerID) return; // picked someone else meanwhile
    if (hasCloud !== true && !hasLocal) {
        pinMode = 'create';
        setPinMessage(`Make a 4-digit PIN for ${config.name}`);
    }
}

function appendPin(num) {
    if (pinBusy) return;
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
    showPinButton();
    updatePinDisplay();
}

// The Show PIN button says what a tap does next, and lights up while the PIN shows
function showPinButton() {
    const btn = document.querySelector('#pin-overlay .pin-show');
    if (!btn) return;
    btn.classList.toggle('on', pinVisible);
    btn.textContent = pinVisible ? 'Hide PIN' : 'Show PIN';
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
    firstNewPin = "";
    pinBusy = false;
    pinVisible = false;
    showPinButton();
}

async function submitPin() {
    if (currentPinInput.length !== 4 || pinBusy) return;
    const pin = currentPinInput;
    const id = activePlayer;
    const name = getPinConfig(id).name;
    const localPin = localStorage.getItem(`pin_${id}`);

    // New PIN: type it twice so a slip of the finger doesn't lock anyone out
    if (pinMode === 'create') {
        firstNewPin = pin; pinMode = 'confirm'; clearPin();
        setPinMessage('Type the same PIN again');
        return;
    }
    if (pinMode === 'confirm' && pin !== firstNewPin) {
        pinMode = 'create'; firstNewPin = ''; clearPin();
        setPinMessage("Those didn't match. Make your PIN again", true);
        return;
    }

    pinBusy = true;
    setPinMessage('Checking...');
    try {
        if (window.WebbsCloud && WebbsCloud.available) {
            const r = await WebbsCloud.loginWithPin(id, pin);
            if (r.ok) { localStorage.setItem(`pin_${id}`, pin); return loginSuccess(id); }
            if (r.wrong) { clearPin(); return setPinMessage('Wrong PIN, try again', true); }
            if (r.tooMany) { clearPin(); return setPinMessage('Too many tries. Wait a few minutes.', true); }
            if (r.noAccount) {
                // First time on the family system: keep the PIN this phone already knows
                if (localPin && pin !== localPin && pinMode !== 'confirm') { clearPin(); return setPinMessage('Wrong PIN, try again', true); }
                setPinMessage('Setting up your account...');
                const c = await WebbsCloud.createAccount(id, pin, { name });
                if (c.ok) { localStorage.setItem(`pin_${id}`, pin); return loginSuccess(id); }
                if (!c.offline) { clearPin(); pinMode = 'enter'; return setPinMessage(c.error || 'Something went wrong', true); }
            }
            // offline: fall through to the PIN saved on this phone
        }
        if (!localPin && (pinMode === 'confirm' || pinMode === 'create')) {
            localStorage.setItem(`pin_${id}`, pin);
            return loginSuccess(id);
        }
        if (pin === localPin) return loginSuccess(id);
        clearPin();
        setPinMessage('Wrong PIN, try again', true);
    } finally {
        pinBusy = false;
    }
}

function loginSuccess(playerID) {
    activePlayer = playerID;
    sessionStorage.setItem('webbs_active_player', playerID);
    const config = getPinConfig(playerID);
    document.body.className = config.theme;
    closePinOverlay();

    // Never leave someone else's family account signed in (e.g. Guest on Ariel's phone)
    if (window.WebbsCloud && WebbsCloud.me && WebbsCloud.me.id !== playerID) WebbsCloud.signOut();

    if (typeof showMainMenu === "function") {
        showMainMenu();
    } else {
        document.getElementById('player-select').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
        if (typeof renderMessages === "function") renderMessages();
    }
}
