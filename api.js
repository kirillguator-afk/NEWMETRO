
export const BOT_TOKEN = '8575086263:AAG74PmRjUT8ExtDkC_kOxfYfmss2BG0C_A';
export const CHANNEL_ID = '-1004498586017';
export const OWNER_ID = 123456789; // Замените на ваш ID

export const MetroAPI = {
    async sendMessage(chatId, text) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
            });
            return await response.json();
        } catch (e) { return null; }
    },

    async getUpdates() {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-50&allowed_updates=["message","channel_post"]`);
            const data = await response.json();
            return data.ok ? data.result : [];
        } catch (e) { return []; }
    },

    parseLobby(text, date) {
        if (!text || !text.startsWith('#METRO_LOBBY')) return null;
        const now = Math.floor(Date.now() / 1000);
        if (now - date > 60) return null; 

        const parts = text.split('|');
        const data = {};
        parts.forEach(p => {
            const [key, val] = p.split(':');
            if (key && val) data[key.replace('#METRO_LOBBY|', '')] = val;
        });
        return { id: data.ID, user: data.USER, bet: data.BET, timestamp: date };
    },

    parsePayment(text) {
        if (!text || !text.startsWith('#PAY_REQ')) return null;
        const parts = text.split('|');
        const data = {};
        parts.forEach(p => {
            const [k, v] = p.split(':');
            if (k && v) data[k.replace('#PAY_REQ|', '')] = v;
        });
        return data;
    }
};
