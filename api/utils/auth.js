
import crypto from 'crypto';
import { kv } from '@vercel/kv';

/**
 * Nexus Prime: Полноценная верификация Telegram Mini App
 */
export async function verifyTelegramAuth(initData, botToken) {
    if (!initData || !botToken) {
        console.error("[AUTH] Missing initData or token");
        return false;
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        const authDate = parseInt(urlParams.get('auth_date'));
        
        if (!hash || !authDate) return false;

        // 1. Окно валидации расширено до 24 часов для бета-теста
        // Это предотвращает 401 ошибку, если пользователь не закрывал приложение долгое время
        const now = Math.floor(Date.now() / 1000);
        const timeDiff = Math.abs(now - authDate);
        if (timeDiff > 86400) {
            console.error(`[AUTH] Token expired. Diff: ${timeDiff}s (Limit: 86400s)`);
            return false;
        }

        // 2. Replay Protection (Атомарно на 15 минут, чтобы не забивать KV)
        try {
            const replayKey = `replay:${hash}`;
            const isUsed = await kv.set(replayKey, '1', { nx: true, ex: 900 });
            if (!isUsed) {
                console.error("[AUTH] Replay attempt detected");
                return false;
            }
        } catch (kvErr) {
            // Если KV недоступен, продолжаем валидацию HMAC
            console.warn("[AUTH] KV protection offline, bypassing to HMAC...");
        }

        // 3. Формирование строки данных (обязательная сортировка ключей)
        const entries = [];
        urlParams.forEach((val, key) => {
            if (key !== 'hash') entries.push(`${key}=${val}`);
        });
        
        const dataCheckString = entries.sort().join('\n');

        // 4. Проверка HMAC-SHA256
        const secretKey = crypto.createHmac('sha256', 'WebAppData')
            .update(botToken).digest();
        const hmac = crypto.createHmac('sha256', secretKey)
            .update(dataCheckString).digest('hex');

        if (hmac !== hash) {
            console.error("[AUTH] Hash Mismatch!");
            return false;
        }

        return true;
    } catch (e) {
        console.error("[AUTH] Critical exception:", e.message);
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
