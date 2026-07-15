
export const BOT_TOKEN = '8575086263:AAG74PmRjUT8ExtDkC_kOxfYfmss2BG0C_A';
export const CHANNEL_ID = '-1004498586017';
export const OWNER_ID = 123456789; 

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
            // Запрашиваем последние 100 обновлений. 
            // В продакшене лучше использовать сервер-посредник, но для P2P WebApp это стандартное решение.
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100&allowed_updates=["channel_post","message"]`);
            const data = await response.json();
            return data.ok ? data.result : [];
        } catch (e) { 
            console.error("MetroAPI: Fetch error", e);
            return []; 
        }
    },

    parseLobby(text, date) {
        if (!text || !text.includes('#METRO_LOBBY')) return null;
        
        const now = Math.floor(Date.now() / 1000);
        // Лобби валидно 2 минуты (120 секунд)
        if (now - date > 120) return null; 

        try {
            const parts = text.split('|');
            const data = {};
            parts.forEach(p => {
                const [key, val] = p.split(':');
                if (key && val) {
                    const cleanKey = key.replace('#METRO_LOBBY', '').replace('|', '').trim();
                    data[cleanKey] = val.trim();
                }
            });
            
            if (!data.ID) return null;

            return { 
                id: data.ID, 
                user: data.USER || 'Unknown Runner', 
                bet: data.BET || '0', 
                timestamp: date 
            };
        } catch (e) {
            return null;
        }
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
