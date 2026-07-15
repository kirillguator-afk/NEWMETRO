
import crypto from 'crypto';

/**
 * Верификация данных Telegram Web App
 * @param {string} initData - Строка из window.Telegram.WebApp.initData
 * @param {string} botToken - Токен бота из ENV
 */
export function verifyTelegramAuth(initData, botToken) {
    if (!initData) return false;

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return hmac === hash;
}

/**
 * Извлекает данные пользователя из initData
 */
export function getUserData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const user = JSON.parse(urlParams.get('user'));
        return user;
    } catch (e) {
        return null;
    }
}
