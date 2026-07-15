
/**
 * MetroAPI - Frontend Wrapper for Vercel Backend
 * Все запросы теперь идут на наши Serverless функции.
 * Токены больше не нужны на фронтенде.
 */
export const MetroAPI = {
    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies');
            return await res.json();
        } catch (e) {
            console.error("Fetch Lobbies Error:", e);
            return [];
        }
    },

    async publishLobby(userId, userName, bet) {
        try {
            const res = await fetch('/api/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: `metro_${userId}`, user: userName, bet: parseInt(bet) })
            });
            return await res.json();
        } catch (e) { return null; }
    },

    async sendPaymentRequest(payload) {
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return await res.json();
        } catch (e) { return null; }
    },

    async getAdminPayments() {
        try {
            const res = await fetch('/api/payments');
            return await res.json();
        } catch (e) { return []; }
    }
};

// Константы для совместимости
export const OWNER_ID = 123456789; // Все еще нужен на фронте для базовой отрисовки админки
