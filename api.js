
/**
 * Metro API Client with Error Propagation
 */
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    async getProfile() {
        const res = await fetch('./api/profile/data', { headers: getAuthHeaders() });
        if (res.status === 401) throw new Error("UNAUTHORIZED");
        if (!res.ok) throw new Error("SERVER_ERROR_" + res.status);
        return await res.json();
    },

    async getLobbies() {
        try {
            const res = await fetch('./api/lobbies', { headers: getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    },

    async publishLobby(bet, peerId) {
        await fetch('./api/lobbies', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: peerId, bet: parseInt(bet) })
        });
    },

    async startGame(lobbyId, bet) {
        const res = await fetch('./api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'START', lobbyId, bet })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "FAILED_TO_START");
        return data;
    },

    async joinGame(lobbyId) {
        const res = await fetch('./api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'JOIN', lobbyId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "FAILED_TO_JOIN");
        return data;
    },

    async performAction(lobbyId, action, turn) {
        const res = await fetch('./api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action, lobbyId, expectedTurn: turn })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "ACTION_ERROR");
        return data;
    },

    async getLeaderboard() {
        try {
            const res = await fetch('./api/leaderboard', { headers: getAuthHeaders() });
            return res.ok ? await res.json() : [];
        } catch (e) { return []; }
    }
};
