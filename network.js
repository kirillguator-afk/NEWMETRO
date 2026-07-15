
export class MetroNetwork {
    constructor(userId, onMessage, onConnect) {
        this.peerId = `metro_${userId}`;
        this.peer = new Peer(this.peerId);
        this.conn = null;
        this.onMessage = onMessage;
        this.onConnect = onConnect;

        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupListeners();
            if (this.onConnect) this.onConnect(conn);
        });
        
        this.peer.on('error', (err) => console.error("Peer Error:", err));
    }

    connectTo(targetId) {
        this.conn = this.peer.connect(targetId);
        this.setupListeners();
    }

    setupListeners() {
        this.conn.on('data', (data) => this.onMessage && this.onMessage(data));
        this.conn.on('open', () => console.log("Connection Established"));
        this.conn.on('close', () => alert("Opponent disconnected"));
    }

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, ...payload });
        }
    }
}
