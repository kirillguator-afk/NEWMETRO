
import crypto from 'crypto';

/**
 * Верификация данных Telegram Web App с проверкой срока жизни сессии
 */
export function verifyTelegramAuth(initData, botToken) {
    if (!initData) return false;

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // Проверка свежести данных (5 минут)
    const authDate = parseInt(urlParams.get('auth_date'));
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || (now - authDate) > 300) {
        console.warn("Auth expired or timestamp missing");
        return false;
    }

    const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return hmac === hash;
}

export function getUserData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        return JSON.parse(urlParams.get('user'));
    } catch (e) {
        return null;
    }
}
