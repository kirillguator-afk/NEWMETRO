
/**
 * Клиентский API-клиент для взаимодействия с Vercel Serverless Functions
 */
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    // Получение списка активных лобби
    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return []; }
    },

    // Публикация своего лобби
    async publishLobby(userId, userName, bet, avatarUrl = null, peerId) {
        try {
            await fetch('/api/lobbies', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    id: peerId,
                    user: userName, 
                    bet: parseInt(bet),
                    avatar: avatarUrl 
                })
            });
        } catch (e) {}
    },

    // Создание игровой сессии на сервере
    async startGame(lobbyId, bet) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'START', lobbyId, bet })
        });
        return res.json();
    },

    // Игровые действия (Hit, Stand, Sync)
    async performAction(lobbyId, action) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action, lobbyId })
        });
        return res.json();
    },

    // Получение профиля (аватара)
    async getUserProfile() {
        try {
            const res = await fetch('/api/avatar/profile', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return { avatarUrl: null }; }
    },

    // Загрузка нового аватара в Vercel Blob
    async uploadAvatar(file) {
        try {
            const res = await fetch(`/api/avatar/upload`, {
                method: 'POST',
                headers: {
                    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
                    'Content-Type': file.type,
                    'Content-Length': file.size.toString()
                },
                body: file
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    // Админ-панель: получение очереди выплат
    async getAdminPayments() {
        try {
            const res = await fetch('/api/payments', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return { error: 'Fetch failed' }; }
    },

    // Запрос на выплату или депозит
    async requestPayment(amount, payType, info) {
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ amount, payType, info })
            });
            return await res.json();
        } catch (e) { return { error: 'Network error' }; }
    }
};
