
export class MetroNetwork {
    constructor(userId, onMessage, onConnect, onError) {
        const entropy = Math.random().toString(36).slice(2, 8);
        this.peerId = `metro_${userId}_${entropy}`;
        this.conn = null;
        this.onMessage = onMessage;
        this.onConnect = onConnect;
        this.onError = onError;

        try {
            this.peer = new Peer(this.peerId, {
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                },
                debug: 1
            });

            this.peer.on('connection', (conn) => {
                if (this.conn && this.conn.open) {
                    conn.on('open', () => {
                        conn.send({ type: 'ERROR', msg: 'Busy' });
                        setTimeout(() => conn.close(), 500);
                    });
                    return;
                }
                this.conn = conn;
                this.setupListeners();
            });
            
            this.peer.on('error', (err) => {
                console.error("PeerJS Error:", err.type);
                if (this.onError) this.onError(err);
            });

        } catch (e) {
            console.error("PeerJS Constructor Failed:", e);
            if (this.onError) this.onError(e);
        }
    }

    connectTo(targetId) {
        if (this.conn) this.conn.close();
        this.conn = this.peer.connect(targetId, { reliable: true });
        this.setupListeners();
    }

    setupListeners() {
        this.conn.on('open', () => {
            if (this.onConnect) this.onConnect(this.conn);
        });
        this.conn.on('data', (data) => {
            if (this.onMessage) this.onMessage(data);
        });
        this.conn.on('close', () => {
            this.conn = null;
        });
    }

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, ...payload });
        }
    }
}
