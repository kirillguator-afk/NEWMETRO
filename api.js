
/**
 * MetroAPI - Secure Frontend Wrapper
 * Все запросы теперь включают x-telegram-init-data для серверной проверки.
 */
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-telegram-init-data': window.Telegram?.WebApp?.initData || ''
});

export const MetroAPI = {
    async getLobbies() {
        try {
            const res = await fetch('/api/lobbies', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Auth failed');
            return await res.json();
        } catch (e) {
            return [];
        }
    },

    async publishLobby(userId, userName, bet) {
        try {
            const res = await fetch('/api/lobbies', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id: userId, user: userName, bet: parseInt(bet) })
            });
            return await res.json();
        } catch (e) { return null; }
    },

    async sendPaymentRequest(payload) {
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    amount: payload.amount,
                    payType: payload.payType,
                    info: payload.info
                })
            });
            return await res.json();
        } catch (e) { return null; }
    },

    async getAdminPayments() {
        try {
            const res = await fetch('/api/payments', { headers: getAuthHeaders() });
            if (!res.ok) {
                console.error("Access Denied by Server");
                return [];
            }
            return await res.json();
        } catch (e) { return []; }
    }
};

// Константа OWNER_ID теперь берется из ENV на бэкенде, 
// здесь оставляем только для UI-триггеров (но сервер все равно проверит)
export const OWNER_ID = 123456789; 
