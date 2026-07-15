
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Верификация данных Telegram Web App с защитой от Replay-атак (SET NX)
 * Nexus Prime Status: SECURE_AUDITED
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) return false;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const authDate = parseInt(urlParams.get('auth_date'));
        
        if (!hash || !authDate) return false;

        // [SECURITY] 1. Проверка актуальности (120 секунд)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - authDate) > 120) return false;

        // [SECURITY] 2. Атомарная проверка Replay-атаки через SET NX
        // Если ключ уже есть, значит запрос повторный.
        const wasSet = await kv.set(`replay:${hash}`, '1', { nx: true, ex: 120 });
        if (!wasSet) return false;

        urlParams.delete('hash');

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
