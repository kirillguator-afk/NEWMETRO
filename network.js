
export class MetroNetwork {
    constructor(userId, onMessage, onConnect) {
        // [SECURITY] Добавляем энтропию в ID, чтобы избежать DoS и перехвата
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
            if (this.conn) {
                conn.on('open', () => {
                    conn.send({ type: 'ERROR', msg: 'Table busy' });
                    setTimeout(() => conn.close(), 500);
                });
                return;
            }
            this.conn = conn;
            this.setupListeners();
        });
        
        this.peer.on('error', (err) => {
            if (err.type === 'peer-unavailable') {
                console.error("Target peer not found");
            }
        });
    }

    connectTo(targetId) {
        // Ожидаем префикс metro_, но само подключение идет по точному ID
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
            console.warn("P2P Connection Closed");
        });
    }

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, ...payload });
        }
    }
}
