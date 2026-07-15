
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Nexus Prime: Оптимизированная верификация Telegram
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData) {
        console.error("[AUTH] No initData provided");
        return false;
    }
    if (!botToken) {
        console.error("[AUTH] TELEGRAM_BOT_TOKEN is missing in Environment Variables");
        return false;
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const authDate = parseInt(urlParams.get('auth_date'));
        
        if (!hash || !authDate) return false;

        // 1. Окно валидации 15 минут
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - authDate) > 900) {
            console.error("[AUTH] Token expired:", now - authDate, "seconds ago");
            return false;
        }

        // 2. Replay Protection через KV (если KV доступен)
        try {
            const replayKey = `replay:${hash}`;
            const isUsed = await kv.get(replayKey);
            if (isUsed) {
                console.error("[AUTH] Replay attack detected or token re-used");
                return false;
            }
            await kv.set(replayKey, '1', { ex: 900 });
        } catch (e) {
            console.warn("[AUTH] KV Replay check failed, skipping...", e.message);
        }

        // 3. Формирование проверочной строки
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

        const isValid = hmac === hash;
        if (!isValid) console.error("[AUTH] Hash mismatch");
        
        return isValid;
    } catch (e) {
        console.error("[AUTH] Internal verification error:", e);
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
