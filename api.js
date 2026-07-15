
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
                    id: peerId, // Отправляем динамический PeerID вместо статического UserID
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

    async performAction(lobbyId, action) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action, lobbyId })
        });
        return res.json();
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
    }
};
