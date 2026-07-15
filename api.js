
/**
 * Клиентский API-клиент для взаимодействия с Vercel Serverless Functions
 * Nexus Prime: Добавлены проверки res.ok и абсолютные пути
 */
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Lobbies fetch failed');
            return await res.json();
        } catch (e) { 
            console.error(e);
            return []; 
        }
    },

    async publishLobby(userId, userName, bet, avatarUrl = null, peerId) {
        try {
            const res = await fetch('/api/lobbies', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    id: peerId,
                    user: userName, 
                    bet: parseInt(bet),
                    avatar: avatarUrl 
                })
            });
            return res.ok;
        } catch (e) { return false; }
    },

    async startGame(lobbyId, bet) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'START', lobbyId, bet })
        });
        if (!res.ok) return { error: 'Failed to start game' };
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
                    expectedTurn: currentTurn
                })
            });

            if (res.status === 429) return { error: 'Too Many Requests' };
            if (res.status === 409) return { error: 'Sync error' };
            if (!res.ok) return { error: 'Action failed' };

            return await res.json();
        } catch (e) {
            return { error: 'Network failure' };
        }
    },

    async getUserProfile() {
        try {
            const res = await fetch('/api/avatar/profile', { headers: getAuthHeaders() });
            if (!res.ok) return { avatarUrl: null };
            return await res.json();
        } catch (e) { return { avatarUrl: null }; }
    },

    async uploadAvatar(file) {
        try {
            const res = await fetch(`/api/avatar/upload`, {
                method: 'POST',
                headers: {
                    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
                    'Content-Type': file.type
                },
                body: file
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    },

    async getAdminPayments() {
        try {
            const res = await fetch('/api/payments', { headers: getAuthHeaders() });
            if (!res.ok) return { error: 'Access denied' };
            return await res.json();
        } catch (e) { return { error: 'Fetch failed' }; }
    }
};
