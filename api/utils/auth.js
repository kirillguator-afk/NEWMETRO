
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Верификация данных Telegram Web App с защитой от Replay-атак через KV
 * Nexus Prime: Добавлена проверка наличия Bot Token и улучшена отказоустойчивость.
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) {
        console.error("Auth Error: Missing initData or Bot Token in Environment");
        return false;
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash) return false;
        
        // [SECURITY] Replay Attack Protection
        const replayKey = `replay:${hash}`;
        const isUsed = await kv.get(replayKey);
        if (isUsed) return false;

        urlParams.delete('hash');

        const authDate = parseInt(urlParams.get('auth_date'));
        const now = Math.floor(Date.now() / 1000);
        if (!authDate || Math.abs(now - authDate) > 300) {
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

        if (hmac === hash) {
            // Кэшируем хеш на 5 минут
            await kv.set(replayKey, '1', { ex: 300 });
            return true;
        }
        return false;
    } catch (e) {
        console.error("Auth internal failure:", e);
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
