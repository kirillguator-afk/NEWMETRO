
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Nexus Prime: Выверенная верификация Telegram Mini App
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) return false;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const authDate = parseInt(urlParams.get('auth_date'));
        
        if (!hash || !authDate) return false;

        // 1. Окно 24 часа для стабильности беты
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - authDate) > 86400) return false;

        // 2. Replay Protection (Атомарно)
        const replayKey = `replay:${hash}`;
        const isUsed = await kv.set(replayKey, '1', { nx: true, ex: 3600 });
        if (!isUsed) return false;

        // 3. Формирование строки (Сортировка по ключу)
        const entries = [];
        urlParams.forEach((v, k) => {
            if (k !== 'hash') entries.push(`${k}=${v}`);
        });
        const dataCheckString = entries.sort().join('\n');

        // 4. HMAC-SHA256
        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(botToken).digest();
        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString).digest('hex');

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
    } catch (e) { return null; }
}
