
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    async getProfile() {
        try {
            const res = await fetch('/api/profile/data', { headers: getAuthHeaders() });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    },

    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    },

    async publishLobby(bet, peerId) {
        await fetch('/api/lobbies', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: peerId, bet: parseInt(bet) })
        });
    },

    async startGame(lobbyId, bet) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'START', lobbyId, bet })
        });
        return await res.json();
    },

    async joinGame(lobbyId) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'JOIN', lobbyId })
        });
        return await res.json();
    },

    async performAction(lobbyId, action, turn) {
        try {
            const res = await fetch('/api/game/action', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action, lobbyId, expectedTurn: turn })
            });
            return await res.json();
        } catch (e) { return { error: 'Network Error' }; }
    },

    async getLeaderboard() {
        try {
            const res = await fetch('/api/leaderboard', { headers: getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }
};
