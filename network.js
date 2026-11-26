/**
 * NetworkManager handles browser-to-browser communication using PeerJS.
 * Support for up to 4 players (Host + 3 Clients).
 */
const NetworkManager = {
    peer: null,
    conn: null, // For Client: connection to Host.
    connections: [], // For Host: list of all connected peer connections.
    role: null, // 'host' or 'client'
    roomID: null,
    
    // Callbacks for game logic
    onStateUpdate: null,
    onMoveReceived: null,
    onPlayerJoined: null,
    onChatMessage: null,
    onJoinAccepted: null,
    onAnimationTrigger: null,
    
    lastStateSeq: 0,
    hostPlayerID: null,
    prefix: "webbs-", // Isolate our games from other PeerJS users

    init(role, roomID = null) {
        this.role = role;
        this.roomID = roomID || this.generateShortID();
        this.lastStateSeq = 0;
        
        // Track the current game if we are in a game folder
        const path = window.location.pathname;
        this.currentGame = path.includes('/games/') ? path.split('/games/')[1].split('/')[0] : null;

        // Enhanced configuration with STUN servers for better NAT traversal
        const config = {
            debug: 1, // Reduced debug for production unless troubleshooting
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                ]
            }
        };

        const finalID = role === 'host' ? (this.prefix + this.roomID) : undefined;
        this.peer = new Peer(finalID, config);

        this.peer.on('open', (id) => {
            console.log(`My peer ID is: ${id}`);
            if (role === 'client' && this.roomID) {
                this.connectToHost(this.roomID);
            }
            if (this.currentGame) this.setupChatUI();
            if (role === 'host') {
                this.addInviteButton();
                // Show this table in the family lobby until someone joins
                if (window.WebbsCloud && this.currentGame) WebbsCloud.publishTable(this.roomID, this.gameTitle());
            }
        });

        this.peer.on('connection', (conn) => {
            if (this.role === 'host') {
                this.handleIncomingConnection(conn);
            }
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            if (err.type === 'unavailable-id' && role === 'host') {
                alert("This Table PIN is already in use. Please try again.");
            } else if (err.type === 'peer-dotnet-found' || err.type === 'browser-incompatible') {
                alert("Your browser doesn't support the networking features needed for multiplayer.");
            } else if (err.type === 'network') {
                console.warn("Signaling server connection lost.");
            }
        });
    },

    // Link that drops the other person straight into this table: .../index.html?join=PIN
    inviteLink() {
        const base = window.location.href.split('/games/')[0];
        return `${base}/index.html?join=${this.roomID}`;
    },

    gameTitle() {
        const names = { 'tic-tac-toe': 'Tic-Tac-Toe', '357': '357', 'mancala': 'Mancala', 'black-hole': 'Black Hole',
            'chutes-and-ladders': 'Chutes & Ladders', 'sorry': 'Sorry', 'uno-no-mercy': 'Uno No Mercy' };
        return names[this.currentGame] || 'a game';
    },

    addInviteButton() {
        const box = document.getElementById('host-pin-display');
        if (!box || document.getElementById('invite-share-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'invite-share-btn';
        btn.className = 'modal-btn';
        btn.style.cssText = 'margin-top: 10px; background: gold; color: black; font-weight: bold;';
        btn.innerText = '📨 Send invite link';
        btn.onclick = () => this.shareInvite(btn);
        box.appendChild(btn);
        if (window.WebbsCloud) WebbsCloud.addInvitePicker && WebbsCloud.addInvitePicker(box, this.roomID, this.gameTitle());
    },

    async shareInvite(btn) {
        const url = this.inviteLink();
        const text = `Come play ${this.gameTitle()} with me on Webbs Games!`;
        try {
            if (navigator.share) { await navigator.share({ title: 'Webbs Games', text, url }); return; }
            await navigator.clipboard.writeText(`${text} ${url}`);
            btn.innerText = '✅ Link copied, paste it in a message';
        } catch (e) {
            if (e && e.name === 'AbortError') return; // closed the share menu
            prompt('Copy this link:', url);
        }
    },

    generateShortID() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },

    // --- Host Logic ---
    handleIncomingConnection(conn) {
        console.log("New peer connecting:", conn.peer);
        this.connections.push(conn);

        conn.on('open', () => this.updateChatState());

        conn.on('data', (data) => {
            this.handleMessage(data, conn);
        });

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            console.log("Peer disconnected:", conn.peer);
            this.updateChatState();
        });
    },

    // Host: pass a message on to every joined phone, except the one it came from
    relay(msg, except = null) {
        this.connections.forEach(conn => {
            if (conn !== except && conn.open) conn.send(msg);
        });
    },

    broadcastState(state) {
        if (this.role !== 'host') return;
        this.lastStateSeq++;
        const hostPlayer = new URLSearchParams(window.location.search).get('player') || 'guest';
        const msg = { type: 'STATE_UPDATE', payload: state, seq: this.lastStateSeq, hostPlayer };
        this.relay(msg);
    },

    broadcastAnimation(animData) {
        const msg = { type: 'ANIMATION', payload: animData, timestamp: Date.now() };
        if (this.role === 'host') {
            this.relay(msg);
        } else if (this.conn && this.conn.open) {
            this.conn.send(msg);
        }
    },

    // --- Table chat ---
    // Can a message reach anyone right now?
    chatReady() {
        if (this.role === 'host') return this.connections.some(conn => conn.open);
        return !!(this.conn && this.conn.open);
    },

    myPlayerID() {
        return sessionStorage.getItem('webbs_active_player') || new URLSearchParams(window.location.search).get('player') || 'guest';
    },

    // The name other players see: the family account's name, else the profile name
    myName(id) {
        const me = window.WebbsCloud && WebbsCloud.me;
        if (me && me.id === id && me.name) return me.name;
        return typeof ProfileManager !== 'undefined' ? ProfileManager.resolveName(id) : id;
    },

    // Returns false when it couldn't send, so the words stay in the box
    sendChatMessage(text) {
        text = String(text || '').trim().slice(0, WebbsChat.MAX);
        if (!text || !this.chatReady()) return false;
        const sender = this.myPlayerID();
        const msg = { type: 'CHAT', payload: { text, sender, name: this.myName(sender) } };
        this.renderChatMessage(msg.payload, true);
        if (this.role === 'host') this.relay(msg); // straight to every joined phone, once
        else this.conn.send(msg);                  // the host passes it on to the others
        return true;
    },

    // --- Client Logic ---
    connectToHost(hostPIN) {
        const hostID = this.prefix + hostPIN;
        console.log("Connecting to host:", hostID);
        
        // Timeout for connection
        const timeout = setTimeout(() => {
            if (!this.conn || !this.conn.open) {
                console.error("Connection attempt timed out.");
                alert("Could not connect to the host. Please check the PIN and try again.");
                window.location.href = "../../index.html";
            }
        }, 15000);

        this.conn = this.peer.connect(hostID, {
            reliable: true
        });

        this.conn.on('open', () => {
            clearTimeout(timeout);
            console.log("Connected to host!");
            this.updateChatState();
            setTimeout(() => this.requestJoin(), 500); 
        });

        this.conn.on('data', (data) => {
            this.handleMessage(data);
        });

        this.conn.on('close', () => {
            alert("Lost connection to Host.");
            window.location.href = "../../index.html";
        });
        
        this.conn.on('error', (err) => {
            console.error("Data connection error:", err);
            clearTimeout(timeout);
            alert("Connection error occurred. Returning to menu.");
            window.location.href = "../../index.html";
        });
    },

    sendMove(move) {
        if (this.role !== 'client' || !this.conn) return;
        this.conn.send({ type: 'MOVE', payload: move });
    },

    requestJoin() {
        if (this.role !== 'client' || !this.conn) return;
        const playerID = sessionStorage.getItem('webbs_active_player') || 'guest';
        this.conn.send({ type: 'REQUEST_JOIN', playerID });
    },

    queryGame(hostPIN, callback) {
        if (!this.peer) {
            this.init('client');
            // Wait for peer to open before querying
            this.peer.on('open', () => this._doQuery(hostPIN, callback));
        } else {
            this._doQuery(hostPIN, callback);
        }
    },

    _doQuery(hostPIN, callback) {
        const hostID = this.prefix + hostPIN;
        console.log("Querying host:", hostID);
        const conn = this.peer.connect(hostID);
        
        let found = false;
        conn.on('open', () => {
            conn.send({ type: 'QUERY_GAME' });
        });
        
        conn.on('data', (data) => {
            if (data.type === 'GAME_INFO') {
                found = true;
                callback(data.game);
                conn.close();
            }
        });

        setTimeout(() => { 
            if (!found) {
                callback(null);
                if (conn.open) conn.close();
            }
        }, 8000); 
    },

    // --- Message Handling ---
    handleMessage(data, senderConn = null) {
        switch (data.type) {
            case 'QUERY_GAME':
                if (this.role === 'host' && senderConn) {
                    senderConn.send({ type: 'GAME_INFO', game: this.currentGame });
                }
                break;
            case 'GAME_INFO':
                // Handled in _doQuery callback
                break;
            case 'STATE_UPDATE':
                if (data.seq && data.seq <= this.lastStateSeq && this.role === 'client') {
                    console.log("Ignoring out-of-order state update");
                    return;
                }
                if (data.seq) this.lastStateSeq = data.seq;
                if (data.hostPlayer) this.hostPlayerID = data.hostPlayer; // so the joiner sees the host's name
                if (this.onStateUpdate) this.onStateUpdate(data.payload);
                // Host pressed Play Again: close the winner screen on this side too
                if (data.payload && data.payload.active === true) {
                    const modal = document.getElementById('game-over-modal');
                    if (modal) modal.style.display = 'none';
                }
                break;
            case 'ANIMATION':
                if (this.onAnimationTrigger) this.onAnimationTrigger(data.payload);
                if (this.role === 'host') this.relay(data, senderConn); // pass it on to the other players
                break;
            case 'MOVE':
                if (this.onMoveReceived) this.onMoveReceived(data.payload, senderConn);
                break;
            case 'REQUEST_JOIN':
                if (this.onPlayerJoined) this.onPlayerJoined(data.playerID, senderConn);
                if (window.WebbsCloud) WebbsCloud.closeTable(this.roomID); // table is full now
                break;
            case 'JOIN_ACCEPTED':
                const pos = data.assignedPosition || '2';
                if (this.onJoinAccepted) this.onJoinAccepted(pos);
                break;
            case 'CHAT':
                this.renderChatMessage(data.payload);
                if (this.onChatMessage) this.onChatMessage(data.payload);
                if (this.role === 'host') this.relay(data, senderConn); // pass it on to the other players
                break;
        }
    },

    // The chat starts as a small "💬 Chat" button so it never covers the game,
    // and opens into a panel when tapped. A red badge counts messages that came in while closed.
    setupChatUI() {
        if (document.getElementById('network-chat')) return;

        const chat = document.createElement('div');
        chat.id = 'network-chat';
        chat.innerHTML = `
            <button type="button" id="chat-toggle" class="chat-toggle" aria-expanded="false" aria-controls="chat-panel">💬 Chat<span id="chat-unread" class="chat-unread" hidden></span></button>
            <div id="chat-panel" class="chat-panel" hidden>
                <div class="chat-panel-head">
                    <span>Table chat</span>
                    <button type="button" id="chat-close" class="chat-close" aria-label="Hide chat">✕</button>
                </div>
                <div id="chat-messages" class="chat-messages" aria-live="polite"></div>
                <div class="chat-form">
                    <input type="text" id="chat-input" class="chat-input" autocomplete="off" aria-label="Chat message">
                    <button type="button" id="chat-send" class="chat-send">Send</button>
                </div>
            </div>
        `;
        document.body.appendChild(chat);
        document.body.classList.add('has-table-chat'); // room at the bottom so the button never hides a game button

        document.getElementById('chat-messages').appendChild(WebbsChat.empty('Messages here go to everyone at this table.'));
        WebbsChat.bindInput(document.getElementById('chat-input'), document.getElementById('chat-send'), text => this.sendChatMessage(text));
        document.getElementById('chat-toggle').onclick = () => this.openChat(true);
        document.getElementById('chat-close').onclick = () => {
            this.openChat(false);
            document.getElementById('chat-toggle').focus(); // keyboard and screen-reader users land back on the button
        };

        let wasOpen = false;
        try { wasOpen = sessionStorage.getItem('webbs_chat_open') === '1'; } catch (e) {}
        this.openChat(wasOpen);
        this.updateChatState();
    },

    openChat(open) {
        const panel = document.getElementById('chat-panel');
        const toggle = document.getElementById('chat-toggle');
        if (!panel || !toggle) return;
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('table-chat-open', open);
        try { sessionStorage.setItem('webbs_chat_open', open ? '1' : '0'); } catch (e) {}
        if (open) {
            this.setUnread(0);
            const box = document.getElementById('chat-messages');
            if (box) box.scrollTop = box.scrollHeight;
        }
    },

    setUnread(count) {
        this.unread = count;
        const badge = document.getElementById('chat-unread');
        const toggle = document.getElementById('chat-toggle');
        if (!badge || !toggle) return;
        badge.hidden = count === 0;
        badge.textContent = count > 9 ? '9+' : String(count);
        toggle.classList.toggle('has-unread', count > 0);
        toggle.setAttribute('aria-label', count ? `Chat, ${count} new` : 'Chat');
    },

    // Greyed out with the reason until a message can actually reach someone
    updateChatState() {
        const input = document.getElementById('chat-input');
        if (!input) return;
        const reason = this.role === 'host' ? 'Waiting for someone to join…' : 'Connecting to the table…';
        WebbsChat.setEnabled(input, document.getElementById('chat-send'), this.chatReady(), reason, 'Say something…');
    },

    renderChatMessage(data, mine = false) {
        this.setupChatUI();
        const box = document.getElementById('chat-messages');
        if (!box || !data) return;
        const hint = box.querySelector('.chat-empty');
        if (hint) hint.remove();
        const name = data.name || (typeof ProfileManager !== 'undefined' ? ProfileManager.resolveName(String(data.sender || 'guest')) : data.sender);
        box.appendChild(WebbsChat.line({ name, text: data.text, when: Date.now(), mine }));
        while (box.children.length > 50) box.firstChild.remove(); // keep the box light in long games
        box.scrollTop = box.scrollHeight;
        const panel = document.getElementById('chat-panel');
        if (!mine && panel && panel.hidden) this.setUnread((this.unread || 0) + 1);
    }
};
