
export class MetroNetwork {
    constructor(userId, onMessage, onConnect) {
        const entropy = Math.random().toString(36).slice(2, 8);
        this.peerId = `metro_${userId}_${entropy}`;
        
        this.peer = new Peer(this.peerId, {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            },
            debug: 1
        });
        
        this.conn = null;
        this.onMessage = onMessage;
        this.onConnect = onConnect;

        this.peer.on('connection', (conn) => {
            // Если соединение уже есть, корректно закрываем новое
            if (this.conn && this.conn.open) {
                conn.on('open', () => {
                    conn.send({ type: 'ERROR', msg: 'Table occupied' });
                    setTimeout(() => conn.close(), 500);
                });
                return;
            }
            this.conn = conn;
            this.setupListeners();
        });
        
        this.peer.on('error', (err) => {
            console.error("PeerJS Error:", err.type);
            if (err.type === 'peer-unavailable') {
                window.Telegram?.WebApp?.showAlert("Player node offline.");
            }
        });
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
            console.warn("P2P Link Severed");
        });
    }

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, ...payload });
        }
    }
}
