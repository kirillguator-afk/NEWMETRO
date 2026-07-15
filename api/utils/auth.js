
import crypto from 'crypto';

/**
 * Верификация данных Telegram Web App с повышенной безопасностью
 */
export function verifyTelegramAuth(initData, botToken) {
    if (!initData) return false;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');

        // [SECURITY] Проверка "свежести" данных (60 секунд) против Replay-атак
        const authDate = parseInt(urlParams.get('auth_date'));
        const now = Math.floor(Date.now() / 1000);
        if (!authDate || Math.abs(now - authDate) > 60) {
            console.warn("Auth token expired or too old");
            return false;
        }

        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        return hmac === hash;
    } catch (e) {
        return false;
    }
}

export function getUserData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        return null;
    }
}
