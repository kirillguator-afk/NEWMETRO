
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Nexus Prime: Bulletproof Telegram Auth
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) return false;

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const authDate = parseInt(urlParams.get('auth_date'));
        
        if (!hash || !authDate) return false;

        // 1. Свежесть (2 минуты)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - authDate) > 120) return false;

        // 2. Replay Protection через KV
        try {
            const replayKey = `replay:${hash}`;
            const isUsed = await kv.get(replayKey);
            if (isUsed) return false;
            await kv.set(replayKey, '1', { ex: 120 });
        } catch (kvError) {
            console.warn("KV Replay check skipped (DB down?)");
        }

        urlParams.delete('hash');

        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(botToken).digest();
        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString).digest('hex');

        return hmac === hash;
    } catch (e) {
        console.error("Auth Exception:", e);
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
