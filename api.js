
const getAuthHeaders = () => ({
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || ''
});

export const MetroAPI = {
    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return []; }
    },

    async publishLobby(userId, userName, bet, avatarUrl = null) {
        try {
            await fetch('/api/lobbies', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: userId, 
                    user: userName, 
                    bet: parseInt(bet),
                    avatar: avatarUrl 
                })
            });
        } catch (e) {}
    },

    async getUserProfile() {
        try {
            const res = await fetch('/api/avatar/profile', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return { avatarUrl: null }; }
    },

    async uploadAvatar(file) {
        try {
            const res = await fetch(`/api/avatar/upload?filename=${file.name}`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': file.type
                },
                body: file
            });
            return await res.json();
        } catch (e) {
            console.error("Upload Error:", e);
            return null;
        }
    },

    async sendPaymentRequest(payload) {
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch (e) { return null; }
    },

    async getAdminPayments() {
        try {
            const res = await fetch('/api/payments', { headers: getAuthHeaders() });
            return await res.json();
        } catch (e) { return []; }
    }
};

export const OWNER_ID = 123456789;
