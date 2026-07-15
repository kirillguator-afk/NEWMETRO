
export class MetroNetwork {
    constructor(userId, onMessage, onConnect) {
        this.peer = new Peer(`metro_${userId}`);
        this.conn = null;
        this.onMessage = onMessage;
        this.onConnect = onConnect;

        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupListeners();
            if (this.onConnect) this.onConnect(conn);
        });
    }

    connectTo(targetId) {
        this.conn = this.peer.connect(targetId);
        this.setupListeners();
    }

    setupListeners() {
        this.conn.on('data', (data) => {
            console.log("Net Recv:", data);
            if (this.onMessage) this.onMessage(data);
        });
        this.conn.on('close', () => alert("Connection lost"));
    }

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, ...payload });
        }
    }
}
