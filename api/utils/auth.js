
import crypto from 'crypto';

/**
 * Верификация данных Telegram Web App с защитой от Replay-атак
 */
export function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) return false;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash) return false;
        
        urlParams.delete('hash');

        // [SECURITY] Проверка "свежести" (300 секунд / 5 минут)
        // 60 секунд было слишком мало для медленного мобильного интернета
        const authDate = parseInt(urlParams.get('auth_date'));
        const now = Math.floor(Date.now() / 1000);
        if (!authDate || (now - authDate) > 300) {
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
