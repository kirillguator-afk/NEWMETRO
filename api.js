
/**
 * Metro API Client
 * Абсолютные пути заменены на относительные для совместимости с любым хостингом
 */
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    async getProfile() {
        try {
            const res = await fetch('./api/profile/data', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (e) {
            console.error("Profile API Error:", e);
            return null;
        }
    },

    async getLobbies() {
        try {
            const res = await fetch('./api/lobbies', { headers: getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    },

    async publishLobby(bet, peerId) {
        try {
            await fetch('./api/lobbies', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id: peerId, bet: parseInt(bet) })
            });
        } catch (e) {}
    },

    async startGame(lobbyId, bet) {
        try {
            const res = await fetch('./api/game/action', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'START', lobbyId, bet })
            });
            return await res.json();
        } catch (e) { return { error: 'Start failed' }; }
    },

    async joinGame(lobbyId) {
        try {
            const res = await fetch('./api/game/action', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'JOIN', lobbyId })
            });
            return await res.json();
        } catch (e) { return { error: 'Join failed' }; }
    },

    async performAction(lobbyId, action, turn) {
        try {
            const res = await fetch('./api/game/action', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action, lobbyId, expectedTurn: turn })
            });
            return await res.json();
        } catch (e) { return { error: 'Network Error' }; }
    },

    async getLeaderboard() {
        try {
            const res = await fetch('./api/leaderboard', { headers: getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }
};
