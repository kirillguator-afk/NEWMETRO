
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
            // Используем offset -100 чтобы всегда получать последние 100 сообщений
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-100&limit=100&allowed_updates=["channel_post","message"]`);
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
        // Увеличиваем срок жизни до 300 секунд (5 минут) для стабильности
        if (now - date > 300) return null; 

        try {
            // Очищаем текст от HTML тегов, которые может добавить Telegram
            const cleanText = text.replace(/<[^>]*>/g, '');
            const parts = cleanText.split('|');
            const data = {};
            
            parts.forEach(p => {
                const kv = p.split(':');
                if (kv.length >= 2) {
                    const key = kv[0].replace('#METRO_LOBBY', '').trim();
                    const val = kv.slice(1).join(':').trim(); // Собираем остаток (для ID с двоеточиями)
                    data[key] = val;
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
            console.error("Parse error:", e);
            return null;
        }
    },

    parsePayment(text) {
        if (!text || !text.includes('#PAY_REQ')) return null;
        const parts = text.split('|');
        const data = {};
        parts.forEach(p => {
            const [k, v] = p.split(':');
            if (k && v) data[k.replace('#PAY_REQ|', '')] = v;
        });
        return data;
    }
};
