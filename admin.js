/* --- Admin State --- */
let pendingApprovals = JSON.parse(localStorage.getItem('webbs_pending')) || [];

/* --- Toggle Admin Panel --- */
function toggleAdminSettings() {
    const sessionUser = sessionStorage.getItem('webbs_active_player');
    const cloudAdmin = window.WebbsCloud && WebbsCloud.me && WebbsCloud.me.admin;
    if (!cloudAdmin && (activePlayer !== 'tim' || sessionUser !== 'tim')) {
        console.error("Access Denied: Admin privileges required.");
        return;
    }

    let panel = document.getElementById('admin-panel');
    if (panel) {
        panel.remove();
        return;
    }

    panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.style.cssText = `
        position: fixed; top: 10%; left: 10%; width: 80%; height: 80%;
        background: #222; border: 3px solid var(--accent-color);
        z-index: 1000; padding: 20px; overflow-y: auto; color: white;
        border-radius: 15px; box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2>Tim's Admin Dashboard</h2>
            <button onclick="this.parentElement.parentElement.remove()" style="padding:10px;">Close</button>
        </div>
        <hr>
        <div id="admin-actions">
            <h3>Quick Resets & Actions</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; max-width:400px;">
                <button onclick="resetPin('ariel')">Reset Ariel PIN</button>
                <button onclick="resetPin('az')">Reset AZ PIN</button>
                <button onclick="resetPin('cassie')">Reset Cassie PIN</button>
                <button onclick="resetPin('tim')">Reset My Own PIN</button>
            </div>
            <br>
            <button onclick="clearGlobalChat()" style="background:#800; color:white; border:none; padding:10px; border-radius:5px;">Clear Global Chat Feed</button>
        </div>
        <hr>
        <div id="cloud-admin"></div>
        <div id="user-management">
            <h3>User Management (Dev Mode)</h3>
            <div id="user-list-admin" style="display:grid; gap:10px;">
                <!-- Populated dynamically -->
            </div>
        </div>
        <hr>
        <div id="approval-queue">
            <h3>Pending Guest Approvals</h3>
            <div id="queue-list">Loading...</div>
        </div>
        <hr>
        <div id="audio-settings">
            <h3>Global Sound Settings</h3>
            <div style="margin-bottom:15px;">
                <label>Select Sound to Edit:</label><br>
                <select id="audio-target" onchange="loadAudioSetting()" style="width:100%; padding:10px; margin-top:5px; background:#333; color:white; border:1px solid var(--accent-color); border-radius:5px;">
                    <option value="click">Button Click</option>
                    <option value="move">Game Move</option>
                    <option value="win">Victory Melody</option>
                    <option value="error">Error/Buzzer</option>
                </select>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; background:rgba(255,255,255,0.05); padding:15px; border-radius:10px;">
                <div>
                    <label>Wave Type:</label><br>
                    <select id="audio-type" style="width:100%; padding:5px; margin-top:5px; background:#333; color:white; border:1px solid #555;">
                        <option value="sine">Sine (Smooth)</option>
                        <option value="square">Square (Retro)</option>
                        <option value="sawtooth">Sawtooth (Sharp)</option>
                        <option value="triangle">Triangle (Soft)</option>
                    </select>
                </div>
                <div>
                    <label>Base Frequency (Hz):</label><br>
                    <input type="number" id="audio-freq" min="100" max="2000" step="50" style="width:100%; padding:5px; margin-top:5px; background:#333; color:white; border:1px solid #555;">
                </div>
                <div>
                    <label>Duration (s):</label><br>
                    <input type="number" id="audio-duration" min="0.05" max="1.0" step="0.05" style="width:100%; padding:5px; margin-top:5px; background:#333; color:white; border:1px solid #555;">
                </div>
                <div>
                    <label>Volume:</label><br>
                    <input type="number" id="audio-vol" min="0.01" max="0.5" step="0.01" style="width:100%; padding:5px; margin-top:5px; background:#333; color:white; border:1px solid #555;">
                </div>
            </div>
            <div style="margin-top:15px; display:flex; gap:10px;">
                <button onclick="testAudio()" data-no-sound="true" style="background:#555; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">Test Sound</button>
                <button onclick="saveAudioSettings()" data-no-sound="true" style="background:var(--accent-color); color:black; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">Save Global Settings</button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    
    // Initial fill
    loadAudioSetting();

    renderUserList();
    renderApprovalQueue();
    renderCloudAdmin();
}

/* --- Audio Settings Logic --- */
function loadAudioSetting() {
    const target = document.getElementById('audio-target').value;
    const s = AudioEngine.settings[target] || AudioEngine.settings.click;
    
    document.getElementById('audio-type').value = s.type;
    document.getElementById('audio-freq').value = s.freq;
    document.getElementById('audio-duration').value = s.duration;
    document.getElementById('audio-vol').value = s.vol;
}

function testAudio() {
    const target = document.getElementById('audio-target').value;
    const type = document.getElementById('audio-type').value;
    const freq = parseFloat(document.getElementById('audio-freq').value);
    const duration = parseFloat(document.getElementById('audio-duration').value);
    const vol = parseFloat(document.getElementById('audio-vol').value);
    
    if (typeof AudioEngine !== 'undefined') { // audio.js declares it with const, so it is not on window
        if (target === 'click') {
            AudioEngine.playTone(freq, type, duration, vol);
        } else if (target === 'move') {
            AudioEngine.playTone(freq, type, duration, vol);
            setTimeout(() => AudioEngine.playTone(freq * 1.5, type, duration, vol), 50);
        } else if (target === 'win') {
            [1, 1.25, 1.5, 2].forEach((ratio, i) => {
                setTimeout(() => AudioEngine.playTone(freq * ratio, type, duration, vol), i * 150);
            });
        } else if (target === 'error') {
            AudioEngine.playTone(freq, type, duration, vol);
            setTimeout(() => AudioEngine.playTone(freq * 0.75, type, duration * 1.3, vol), 150);
        }
    }
}

function saveAudioSettings() {
    const target = document.getElementById('audio-target').value;
    const type = document.getElementById('audio-type').value;
    const freq = parseFloat(document.getElementById('audio-freq').value);
    const duration = parseFloat(document.getElementById('audio-duration').value);
    const vol = parseFloat(document.getElementById('audio-vol').value);

    AudioEngine.settings[target] = { type, freq, duration, vol };
    AudioEngine.saveSettings();
    alert(`Global settings for ${target} saved!`);
}

/* --- User Management --- */
function renderUserList() {
    const container = document.getElementById('user-list-admin');
    if (!container) return;

    const defaults = [
        { id: 'tim', name: 'Tim' },
        { id: 'ariel', name: 'Ariel' },
        { id: 'az', name: 'AZ' },
        { id: 'cassie', name: 'Cassie' }
    ];
    const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
    const all = [...defaults, ...approved];

    container.innerHTML = all.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
            <span><strong>${escapeHTML(p.name)}</strong> (${escapeHTML(p.id)})</span>
            <div style="display:flex; gap:5px;">
                <button onclick="impersonateUser('${p.id}')" style="background:#444; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:0.8em;">Impersonate</button>
                <button onclick="resetAccount('${p.id}')" style="background:orange; color:black; border:none; padding:5px 10px; border-radius:4px; font-size:0.8em;">Reset</button>
                ${defaults.some(d => d.id === p.id) ? '' : `<button onclick="deleteAccount('${p.id}')" style="background:red; color:white; border:none; padding:5px 10px; border-radius:4px; font-size:0.8em;">Delete</button>`}
            </div>
        </div>
    `).join('');
}

function impersonateUser(playerID) {
    if (confirm(`Switch to ${playerID}? This will bypass PIN security.`)) {
        console.log(`Tim is impersonating: ${playerID}`);
        // Close admin panel
        const panel = document.getElementById('admin-panel');
        if (panel) panel.remove();
        
        // Use the auth.js loginSuccess to bypass PIN
        if (typeof loginSuccess === 'function') {
            loginSuccess(playerID);
        } else {
            alert("Auth system not ready.");
        }
    }
}

function resetAccount(playerID) {
    if (confirm(`Completely reset ${playerID}? This clears PIN and all game history.`)) {
        localStorage.removeItem(`pin_${playerID}`);
        localStorage.removeItem(`history_${playerID}`);
        alert(`${playerID} has been reset.`);
    }
}

function deleteAccount(playerID) {
    if (confirm(`Permanently delete account ${playerID}?`)) {
        const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
        const filtered = approved.filter(p => p.id !== playerID);
        localStorage.setItem('webbs_approved_players', JSON.stringify(filtered));
        
        localStorage.removeItem(`pin_${playerID}`);
        localStorage.removeItem(`history_${playerID}`);
        localStorage.removeItem(`prefs_${playerID}`);
        
        alert(`${playerID} deleted.`);
        renderUserList();
        if (typeof renderPlayerSelect === "function") renderPlayerSelect();
    }
}

/* --- Individual PIN Reset --- */
function resetPin(playerID) {
    const name = playerID.charAt(0).toUpperCase() + playerID.slice(1);
    if (confirm(`Reset PIN for ${name}? they will have to create a new one next time they log in.`)) {
        localStorage.removeItem(`pin_${playerID}`);
        alert(`${name}'s PIN has been cleared.`);
    }
}

/* --- Global Chat Control --- */
function clearGlobalChat() {
    if (confirm("Permanently clear all messages on the board?")) {
        localStorage.removeItem('webbs_messages');
        alert("Chat cleared.");
        location.reload(); 
    }
}

/* --- Approval Logic --- */
function renderApprovalQueue() {
    const list = document.getElementById('queue-list');
    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    
    if (pending.length === 0) {
        list.innerHTML = "<p style='opacity:0.5;'>No pending requests.</p>";
        return;
    }

    list.innerHTML = "";
    pending.forEach((req, index) => {
        const item = document.createElement('div');
        item.style.cssText = "background:rgba(255,255,255,0.05); padding:15px; margin:10px 0; border-radius:10px; border:1px solid rgba(255,255,255,0.1);";
        
        let colorDots = "";
        if (Array.isArray(req.colors)) {
            req.colors.forEach(c => {
                colorDots += `<span style="display:inline-block; width:15px; height:15px; border-radius:50%; background:${c}; margin-right:5px; border:1px solid #fff; vertical-align:middle;"></span>`;
            });
        }

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                <div>
                    <div style="font-size: 1.1em; font-weight: bold; color: gold;">${escapeHTML(req.name)}</div>
                    <div style="font-size: 0.85em; opacity: 0.8; margin-top: 5px;">
                        🐾 Animal: <strong>${escapeHTML(req.animal || 'None')}</strong><br>
                        🎲 Game: <strong>${escapeHTML(req.game || 'None')}</strong>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="margin-bottom: 8px;">${colorDots}</div>
                    <button onclick="approveGuest(${index})" style="background:green; color:white; border:none; padding:5px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">Approve</button>
                    <button onclick="denyGuest(${index})" style="background:#800; color:white; border:none; padding:5px 12px; border-radius:5px; cursor:pointer; margin-left:5px;">Deny</button>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function approveGuest(index) {
    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    const guest = pending[index];
    
    // Save their preferences to their profile (using their name as ID for now)
    const playerID = guest.name.toLowerCase().replace(/\s+/g, '');
    
    const prefs = {
        favoriteAnimal: guest.animal || "None set",
        favoriteColor: (guest.colors && guest.colors[0]) ? guest.colors[0] : "#ffd700",
        favoriteGame: guest.game || "None set",
        allColors: guest.colors || []
    };
    
    // Use the ProfileManager if available, otherwise manual save
    if (typeof ProfileManager !== 'undefined') {
        ProfileManager.savePreferences(playerID, prefs);
    } else {
        localStorage.setItem(`prefs_${playerID}`, JSON.stringify(prefs));
    }

    // Add to approved players list for login screen
    const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
    if (!approved.some(p => p.id === playerID)) {
        approved.push({
            id: playerID,
            name: guest.name,
            theme: `theme-${playerID}`
        });
        localStorage.setItem('webbs_approved_players', JSON.stringify(approved));
    }

    alert(`Approved ${guest.name}! They can now log in as "${playerID}" and set a PIN.`);
    
    pending.splice(index, 1);
    localStorage.setItem('webbs_pending', JSON.stringify(pending));
    
    if (typeof checkAdminNotifications === "function") checkAdminNotifications();
    renderApprovalQueue();
    
    // Refresh player selection if on login screen
    if (typeof renderPlayerSelect === "function") renderPlayerSelect();
}

function denyGuest(index) {
    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    pending.splice(index, 1);
    localStorage.setItem('webbs_pending', JSON.stringify(pending));
    
    if (typeof checkAdminNotifications === "function") checkAdminNotifications();
    renderApprovalQueue();
}


/* --- Family accounts (cloud): approvals, PIN resets, message safety view --- */
let cloudAdminOff = null;

function renderCloudAdmin() {
    const box = document.getElementById('cloud-admin');
    if (!box) return;
    const me = window.WebbsCloud && WebbsCloud.me;
    if (!me || !me.admin) {
        box.innerHTML = window.WebbsCloud && WebbsCloud.available
            ? "<p style='opacity:0.6'>Sign in as Tim with your PIN to manage family accounts.</p><hr>"
            : "";
        return;
    }
    box.innerHTML = `
        <h3>Family Accounts</h3>
        <div id="cloud-pending"></div>
        <div id="cloud-family" class="admin-family"></div>
        <button class="modal-btn" style="width:100%; margin-top:10px;" onclick="openMessageSafetyView()">🔒 Read family messages</button>
        <div id="cloud-convs"></div>
        <hr>`;
    if (cloudAdminOff) cloudAdminOff();
    cloudAdminOff = WebbsCloud.watchPlayers(players => {
        if (!document.getElementById('cloud-pending')) { cloudAdminOff(); cloudAdminOff = null; return; }
        const pending = players.filter(p => !p.approved);
        const approved = players.filter(p => p.approved);
        const pend = document.getElementById('cloud-pending');
        pend.innerHTML = pending.length ? '<h4 style="color:gold">Waiting for your OK</h4>' : "<p style='opacity:0.6'>No one is waiting for approval.</p>";
        pending.forEach(p => pend.appendChild(adminPlayerRow(p, [
            ['Approve', '#2e7d32', () => WebbsCloud.adminApprove(p.id, true)],
            ['Deny', '#800', () => confirm(`Remove ${p.name}'s request?`) && WebbsCloud.adminRemove(p.id)],
        ])));
        const fam = document.getElementById('cloud-family');
        fam.innerHTML = '<h4>Approved</h4>';
        approved.forEach(p => fam.appendChild(adminPlayerRow(p, p.id === me.id ? [] : [
            ['Reset PIN', 'orange', () => confirm(`Reset ${p.name}'s PIN? They make a new one next time. Messages stay.`) && WebbsCloud.adminResetPin(p.id)],
            ['Pause', '#555', () => confirm(`Pause ${p.name}? They can still play but can't message until you approve again.`) && WebbsCloud.adminApprove(p.id, false)],
        ])));
    });
}

function adminPlayerRow(p, actions) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(255,255,255,0.06); padding:10px; border-radius:8px; margin:6px 0;';
    const info = document.createElement('div');
    info.style.textAlign = 'left';
    const name = document.createElement('strong');
    name.textContent = p.name;
    info.appendChild(name);
    const extra = [p.id, p.animal && `🐾 ${p.animal}`, p.favGame && `🎲 ${p.favGame}`, p.createdAt && new Date(p.createdAt).toLocaleDateString()].filter(Boolean).join(' · ');
    const small = document.createElement('div');
    small.style.cssText = 'font-size:0.75em; opacity:0.7;';
    small.textContent = extra;
    info.appendChild(small);
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex; gap:6px; flex-shrink:0;';
    actions.forEach(([label, color, fn]) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = `background:${color}; color:white; border:none; padding:6px 10px; border-radius:6px; font-size:0.8em;`;
        b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { alert('Did not work: ' + e.message); } b.disabled = false; };
        btns.appendChild(b);
    });
    row.append(info, btns);
    return row;
}

// Tim can read every private conversation and delete anything unkind
async function openMessageSafetyView() {
    const box = document.getElementById('cloud-convs');
    box.textContent = 'Loading...';
    const convs = await WebbsCloud.adminConversations();
    box.innerHTML = '';
    if (!convs.length) { box.textContent = 'No private messages yet.'; return; }
    const name = id => ProfileManager.resolveName(id);
    convs.forEach(c => {
        const details = document.createElement('details');
        details.style.cssText = 'background:rgba(255,255,255,0.05); border-radius:8px; margin:6px 0; padding:8px; text-align:left;';
        const sum = document.createElement('summary');
        sum.textContent = `${c.people.map(name).join(' ↔ ')} (${c.msgs.length})`;
        details.appendChild(sum);
        c.msgs.slice(-100).forEach(m => {
            const line = document.createElement('div');
            line.style.cssText = 'font-size:0.85em; margin:4px 0; display:flex; justify-content:space-between; gap:8px;';
            const t = document.createElement('span');
            t.textContent = `${name(m.from)}: ${m.text}`;
            const del = document.createElement('button');
            del.textContent = '🗑';
            del.title = 'Delete this message';
            del.style.cssText = 'background:none; border:none; cursor:pointer;';
            del.onclick = async () => { if (confirm('Delete this message for everyone?')) { await WebbsCloud.adminDeleteMessage(c.conv, m.key); line.remove(); } };
            line.append(t, del);
            details.appendChild(line);
        });
        box.appendChild(details);
    });
}
