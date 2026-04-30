/* --- Admin State --- */
let pendingApprovals = JSON.parse(localStorage.getItem('webbs_pending')) || [];

/* --- Toggle Admin Panel --- */
function toggleAdminSettings() {
    if (activePlayer !== 'tim') return;

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
            <h3>Individual PIN Resets</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; max-width:400px;">
                <button onclick="resetPin('arieal')">Reset Arieal</button>
                <button onclick="resetPin('az')">Reset AZ</button>
                <button onclick="resetPin('cassie')">Reset Cassie</button>
                <button onclick="resetPin('tim')">Reset My Own PIN</button>
            </div>
            <br>
            <button onclick="clearGlobalChat()" style="background:#800; color:white; border:none; padding:10px; border-radius:5px;">Clear Global Chat Feed</button>
        </div>
        <hr>
        <div id="approval-queue">
            <h3>Pending Guest Approvals</h3>
            <div id="queue-list">Loading...</div>
        </div>
    `;

    document.body.appendChild(panel);
    renderApprovalQueue();
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
        list.innerHTML = "<p>No pending requests.</p>";
        return;
    }

    list.innerHTML = "";
    pending.forEach((req, index) => {
        const item = document.createElement('div');
        item.style.cssText = "background:rgba(255,255,255,0.1); padding:10px; margin:10px 0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;";
        item.innerHTML = `
            <span><strong>${req.name}</strong> <span style="display:inline-block; width:15px; height:15px; border-radius:50%; background:${req.color}; margin-left:5px; vertical-align:middle; border:1px solid #fff;"></span></span>
            <div>
                <button onclick="approveGuest(${index})" style="background:green; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Approve</button>
                <button onclick="denyGuest(${index})" style="background:red; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-left:5px;">Deny</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function approveGuest(index) {
    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    const guest = pending[index];
    alert(`Approved ${guest.name}! They can now set a PIN and join the family grid.`);
    pending.splice(index, 1);
    localStorage.setItem('webbs_pending', JSON.stringify(pending));
    
    if (typeof checkAdminNotifications === "function") checkAdminNotifications();
    renderApprovalQueue();
}

function denyGuest(index) {
    const pending = JSON.parse(localStorage.getItem('webbs_pending')) || [];
    pending.splice(index, 1);
    localStorage.setItem('webbs_pending', JSON.stringify(pending));
    
    if (typeof checkAdminNotifications === "function") checkAdminNotifications();
    renderApprovalQueue();
}
