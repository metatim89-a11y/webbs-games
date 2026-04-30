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

    init(role, roomID = null) {
        this.role = role;
        this.roomID = roomID || this.generateShortID();
        
        this.peer = new Peer(role === 'host' ? this.roomID : undefined, { debug: 1 });

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
        const sender = sessionStorage.getItem('webbs_active_player') || 'guest';
        const msg = { type: 'CHAT', payload: { text, sender } };
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
        const playerID = sessionStorage.getItem('webbs_active_player') || 'guest';
        this.conn.send({ type: 'REQUEST_JOIN', playerID });
    },

    // --- Message Handling ---
    handleMessage(data, senderConn = null) {
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
                const pos = data.assignedPosition || '2';
                alert(`You are now Player ${pos}!`);
                if (this.onJoinAccepted) this.onJoinAccepted(pos);
                break;
            case 'CHAT':
                if (this.onChatMessage) this.onChatMessage(data.payload);
                if (this.role === 'host') {
                    this.connections.forEach(conn => {
                        if (conn !== senderConn && conn.open) conn.send(data);
                    });
                }
                break;
        }
    }
};
