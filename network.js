/**
 * NetworkManager handles browser-to-browser communication using PeerJS.
 */
const NetworkManager = {
    peer: null,
    conn: null, // For Client: connection to Host. For Host: latest connection.
    connections: [], // For Host: list of all connected peers.
    role: null, // 'host' or 'client'
    roomID: null,
    onStateUpdate: null,
    onMoveReceived: null,
    onPlayerJoined: null,

    init(role, roomID = null) {
        this.role = role;
        this.roomID = roomID || this.generateShortID();
        
        // Initialize Peer with the short ID if Host, or random if Client
        this.peer = new Peer(role === 'host' ? this.roomID : undefined, {
            debug: 1
        });

        this.peer.on('open', (id) => {
            console.log(`My peer ID is: ${id}`);
            if (role === 'client' && roomID) {
                this.connectToHost(roomID);
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
            }
        });
    },

    generateShortID() {
        // Generate a 4-digit PIN for easy sharing
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
        const msg = { type: 'STATE_UPDATE', payload: state };
        this.connections.forEach(conn => {
            if (conn.open) conn.send(msg);
        });
    },

    sendChatMessage(text) {
        const msg = { type: 'CHAT', payload: { text, sender: sessionStorage.getItem('webbs_active_player') } };
        if (this.role === 'host') {
            this.handleMessage(msg); // Local display
            this.connections.forEach(conn => {
                if (conn.open) conn.send(msg);
            });
        } else if (this.conn && this.conn.open) {
            this.conn.send(msg);
        }
    },

    // --- Client Logic ---
    connectToHost(hostID) {
        console.log("Connecting to host:", hostID);
        this.conn = this.peer.connect(hostID);

        this.conn.on('open', () => {
            console.log("Connected to host!");
        });

        this.conn.on('data', (data) => {
            this.handleMessage(data);
        });

        this.conn.on('close', () => {
            alert("Lost connection to Host.");
            window.location.href = "../../index.html";
        });
    },

    sendMove(move) {
        if (this.role !== 'client' || !this.conn) return;
        this.conn.send({ type: 'MOVE', payload: move });
    },

    requestJoin() {
        if (this.role !== 'client' || !this.conn) return;
        this.conn.send({ type: 'REQUEST_JOIN', playerID: sessionStorage.getItem('webbs_active_player') });
    },

    // --- Message Handling ---
    handleMessage(data, senderConn = null) {
        console.log("Message received:", data);
        switch (data.type) {
            case 'STATE_UPDATE':
                if (this.onStateUpdate) this.onStateUpdate(data.payload);
                break;
            case 'MOVE':
                if (this.onMoveReceived) this.onMoveReceived(data.payload, senderConn);
                break;
            case 'REQUEST_JOIN':
                if (this.onPlayerJoined) this.onPlayerJoined(data.playerID, senderConn);
                break;
            case 'JOIN_ACCEPTED':
                alert("You are now Player 2!");
                if (this.onJoinAccepted) this.onJoinAccepted();
                break;
            case 'CHAT':
                if (this.onChatMessage) this.onChatMessage(data.payload);
                // Host relays chat to all other peers
                if (this.role === 'host') {
                    this.connections.forEach(conn => {
                        if (conn !== senderConn && conn.open) conn.send(data);
                    });
                }
                break;
        }
    }
};
