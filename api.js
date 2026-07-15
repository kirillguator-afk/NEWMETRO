
export const BOT_TOKEN = '8575086263:AAG74PmRjUT8ExtDkC_kOxfYfmss2BG0C_A';
export const CHANNEL_ID = '-1004498586017';
export const OWNER_ID = 123456789; // Замените на ваш ID

/**
 * ВАЖНО: Для GitHub Pages токен остается в коде. 
 * В продакшене замените прямые вызовы fetch на ваш прокси-сервер (Vercel/Netlify Functions).
 */

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
            // Получаем последние 100 обновлений для актуальности списка
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-100&limit=100&allowed_updates=["channel_post","message"]`);
            const data = await response.json();
            return data.ok ? data.result : [];
        } catch (e) { return []; }
    },

    /**
     * Создает структурированное сообщение с JSON
     */
    async publishLobby(userId, userName, bet) {
        const payload = {
            type: 'LOBBY',
            id: `metro_${userId}`,
            user: userName,
            bet: parseInt(bet),
            ts: Math.floor(Date.now() / 1000)
        };
        const text = `#METRO_JSON|${JSON.stringify(payload)}`;
        return await this.sendMessage(CHANNEL_ID, text);
    },

    parseData(text, date) {
        if (!text || !text.startsWith('#METRO_JSON|')) return null;
        try {
            const jsonStr = text.split('|')[1];
            const data = JSON.parse(jsonStr);
            
            // Проверка "свежести" (не старше 10 минут для пользовательских серверов)
            const now = Math.floor(Date.now() / 1000);
            if (now - date > 600) return null;
            
            return { ...data, timestamp: date };
        } catch (e) {
            console.error("MetroAPI: JSON Parse Error", e);
            return null;
        }
    }
};
