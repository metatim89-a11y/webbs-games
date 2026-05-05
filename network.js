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

    init(role, roomID = null) {
        this.role = role;
        this.roomID = roomID || this.generateShortID();
        this.lastStateSeq = 0;
        
        // Track the current game if we are in a game folder
        const path = window.location.pathname;
        this.currentGame = path.includes('/games/') ? path.split('/games/')[1].split('/')[0] : null;

        // Enhanced configuration with STUN servers for better NAT traversal
        const config = {
            debug: 3,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                ]
            }
        };

        this.peer = new Peer(role === 'host' ? this.roomID : undefined, config);

        this.peer.on('open', (id) => {
            console.log(`My peer ID is: ${id}`);
            if (role === 'client' && roomID) {
                this.connectToHost(roomID);
            }
            if (this.currentGame) this.setupChatUI();
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
                console.warn("Signaling server connection lost. Retrying...");
            }
        });
    },

    generateShortID() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    },

    // --- Host Logic ---
    handleIncomingConnection(conn) {
        console.log("New peer connecting:", conn.peer);
        this.connections.push(conn);
        
        conn.on('data', (data) => {
            this.handleMessage(data, conn);
        });

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            console.log("Peer disconnected:", conn.peer);
        });
    },

    broadcastState(state) {
        if (this.role !== 'host') return;
        this.lastStateSeq++;
        const msg = { type: 'STATE_UPDATE', payload: state, seq: this.lastStateSeq };
        this.connections.forEach(conn => {
            if (conn.open) conn.send(msg);
        });
    },

    broadcastAnimation(animData) {
        const msg = { type: 'ANIMATION', payload: animData, timestamp: Date.now() };
        if (this.role === 'host') {
            this.connections.forEach(conn => {
                if (conn.open) conn.send(msg);
            });
        } else if (this.conn && this.conn.open) {
            this.conn.send(msg);
        }
    },

    sendChatMessage(text) {
        const sender = sessionStorage.getItem('webbs_active_player') || 'guest';
        const msg = { type: 'CHAT', payload: { text, sender } };
        if (this.role === 'host') {
            this.handleMessage(msg); // Local display
            this.connections.forEach(conn => {
                if (conn.open) conn.send(msg);
            });
        } else if (this.conn && this.conn.open) {
            this.handleMessage(msg); // Local display for client
            this.conn.send(msg);
        }
    },

    // --- Client Logic ---
    connectToHost(hostID) {
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

    queryGame(hostID, callback) {
        if (!this.peer) this.init('client');
        const conn = this.peer.connect(hostID);
        conn.on('open', () => conn.send({ type: 'QUERY_GAME' }));
        conn.on('data', (data) => {
            if (data.type === 'GAME_INFO') {
                callback(data.game);
                conn.close();
            }
        });
        setTimeout(() => { if (conn.open) conn.close(); }, 5000); // Timeout
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
                // Handled in queryGame callback
                break;
            case 'STATE_UPDATE':
                if (data.seq && data.seq <= this.lastStateSeq && this.role === 'client') {
                    console.log("Ignoring out-of-order state update");
                    return;
                }
                if (data.seq) this.lastStateSeq = data.seq;
                if (this.onStateUpdate) this.onStateUpdate(data.payload);
                break;
            case 'ANIMATION':
                if (this.onAnimationTrigger) this.onAnimationTrigger(data.payload);
                if (this.role === 'host') {
                    // Relay animation to other clients
                    this.connections.forEach(conn => {
                        if (conn !== senderConn && conn.open) conn.send(data);
                    });
                }
                break;
            case 'MOVE':
                if (this.onMoveReceived) this.onMoveReceived(data.payload, senderConn);
                break;
            case 'REQUEST_JOIN':
                if (this.onPlayerJoined) this.onPlayerJoined(data.playerID, senderConn);
                break;
            case 'JOIN_ACCEPTED':
                const pos = data.assignedPosition || '2';
                if (this.onJoinAccepted) this.onJoinAccepted(pos);
                break;
            case 'CHAT':
                this.renderChatMessage(data.payload);
                if (this.onChatMessage) this.onChatMessage(data.payload);
                if (this.role === 'host') {
                    this.connections.forEach(conn => {
                        if (conn !== senderConn && conn.open) conn.send(data);
                    });
                }
                break;
        }
    },

    setupChatUI() {
        if (document.getElementById('network-chat')) return;
        
        const chat = document.createElement('div');
        chat.id = 'network-chat';
        chat.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; width: 200px; 
            background: rgba(0,0,0,0.7); border: 1px solid var(--primary-color);
            border-radius: 10px; z-index: 4500; display: flex; flex-direction: column;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-size: 0.8em;
        `;
        
        chat.innerHTML = `
            <div id="chat-messages" style="height: 100px; overflow-y: auto; padding: 10px; color: white;"></div>
            <div style="display: flex; border-top: 1px solid rgba(255,255,255,0.1);">
                <input type="text" id="chat-input" placeholder="Chat..." style="flex: 1; background: none; border: none; color: white; padding: 8px; outline: none;">
                <button id="chat-send" style="background: none; border: none; color: gold; padding: 8px; cursor: pointer;">↵</button>
            </div>
        `;
        
        document.body.appendChild(chat);
        
        const input = document.getElementById('chat-input');
        const send = document.getElementById('chat-send');
        
        const doSend = () => {
            const text = input.value.trim();
            if (text) {
                this.sendChatMessage(text);
                input.value = '';
            }
        };
        
        send.onclick = doSend;
        input.onkeypress = (e) => { if (e.key === 'Enter') doSend(); };
    },

    renderChatMessage(data) {
        this.setupChatUI();
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        const msg = document.createElement('div');
        msg.style.marginBottom = '4px';
        msg.innerHTML = `<strong style="color: gold;">${data.sender.toUpperCase()}:</strong> ${data.text}`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }
};

