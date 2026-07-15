
export class MetroNetwork {
    constructor(userId, onMessage, onConnect) {
        this.peerId = `metro_${userId}`;
        // Конфигурация с STUN серверами для обхода NAT (важно для мобильного интернета)
        this.peer = new Peer(this.peerId, {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            },
            debug: 1
        });
        
        this.conn = null;
        this.onMessage = onMessage;
        this.onConnect = onConnect;

        // Слушатель для Хоста
        this.peer.on('connection', (conn) => {
            if (this.conn) {
                // Если кто-то уже играет, отклоняем новое подключение
                conn.on('open', () => {
                    conn.send({ type: 'ERROR', msg: 'Table is full' });
                    setTimeout(() => conn.close(), 500);
                });
                return;
            }
            this.conn = conn;
            this.setupListeners();
            console.log("Host: Player connected");
        });
        
        this.peer.on('error', (err) => {
            console.error("Peer Error:", err.type);
            if (err.type === 'peer-unavailable') {
                alert("Host is offline or table no longer exists.");
                window.location.reload();
            }
        });
    }

    // Метод для Клиента
    connectTo(targetId) {
        console.log("Connecting to:", targetId);
        this.conn = this.peer.connect(targetId, {
            reliable: true
        });
        this.setupListeners();
    }

    setupListeners() {
        this.conn.on('open', () => {
            console.log("Connection Established");
            if (this.onConnect) this.onConnect(this.conn);
        });

        this.conn.on('data', (data) => {
            if (this.onMessage) this.onMessage(data);
        });

        this.conn.on('close', () => {
            alert("Connection lost. Game terminated.");
            window.location.reload();
        });
    }

    send(type, payload = {}) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type, ...payload });
        }
    }
}
