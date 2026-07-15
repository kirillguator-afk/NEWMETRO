
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Nexus Prime: Reference Telegram HMAC Validation
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) return false;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const authDate = parseInt(urlParams.get('auth_date'));
        
        if (!hash || !authDate) return false;

        // 1. Окно валидации 15 минут (для беты и медленного интернета)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - authDate) > 900) return false;

        // 2. Replay Protection (Атомарно)
        const replayKey = `replay:${hash}`;
        const isUsed = await kv.set(replayKey, '1', { nx: true, ex: 900 });
        if (!isUsed) return false;

        // 3. Сбор проверочной строки (сортировка + фильтрация hash)
        const dataCheckString = Array.from(urlParams.entries())
            .filter(([key]) => key !== 'hash')
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        // 4. Расчет HMAC-SHA256
        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(botToken).digest();
        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString).digest('hex');

        return hmac === hash;
    } catch (e) {
        console.error("Critical Auth Error:", e);
        return false;
    }
}

export function getUserData(initData) {
    try {
        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) { return null; }
}
