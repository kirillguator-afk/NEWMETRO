
/**
 * Клиентский API-клиент для взаимодействия с Vercel Serverless Functions
 * Nexus Prime: Enhanced with Turn tracking and 429/409 handling
 */
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return []; }
    },

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

    async startGame(lobbyId, bet) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'START', lobbyId, bet })
        });
        return res.json();
    },

    async performAction(lobbyId, action, currentTurn = null) {
        try {
            const res = await fetch('/api/game/action', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    action, 
                    lobbyId, 
                    expectedTurn: currentTurn // Pass version to prevent race conditions
                })
            });

            if (res.status === 429) return { error: 'Too Many Requests. Slow down.' };
            if (res.status === 409) return { error: 'Action conflict. Syncing...' };

            return await res.json();
        } catch (e) {
            return { error: 'Network failure' };
        }
    },

    async getUserProfile() {
        try {
            const res = await fetch('/api/avatar/profile', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return { avatarUrl: null }; }
    },

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

    async getAdminPayments() {
        try {
            const res = await fetch('/api/payments', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return { error: 'Fetch failed' }; }
    },

    async requestPayment(amount, payType, info) {
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ amount, payType, info })
            });
            if (res.status === 429) return { error: 'Withdrawal limit reached. Try in 30s.' };
            return await res.json();
        } catch (e) { return { error: 'Network error' }; }
    }
};
