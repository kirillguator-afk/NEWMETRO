
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
    'Content-Type': 'application/json'
});

export const MetroAPI = {
    async getProfile() {
        const res = await fetch('/api/profile/data', { headers: getAuthHeaders() });
        return res.json();
    },

    async getLobbies() {
        const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
        return res.json();
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
        return res.json();
    },

    async joinGame(lobbyId) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'JOIN', lobbyId })
        });
        return res.json();
    },

    async performAction(lobbyId, action, turn) {
        const res = await fetch('/api/game/action', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action, lobbyId, expectedTurn: turn })
        });
        return res.json();
    },

    async uploadAvatar(file) {
        const res = await fetch(`/api/avatar/upload`, {
            method: 'POST',
            headers: { 'x-telegram-init-data': window.Telegram?.WebApp?.initData || '', 'Content-Type': file.type },
            body: file
        });
        return res.json();
    },

    async getLeaderboard() {
        const res = await fetch('/api/leaderboard', { headers: getAuthHeaders() });
        return res.json();
    }
};
