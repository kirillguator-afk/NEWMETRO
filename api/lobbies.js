
import { kv } from '@vercel/kv';
import { verifyTelegramAuth } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Обязательная проверка авторизации
    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Telegram Signature' });
    }

    if (req.method === 'POST') {
        const { id, user, bet } = req.body;
        if (!id || !user || isNaN(bet)) return res.status(400).json({ error: 'Validation failed' });
        
        const lobbyKey = `lobby:${id}`;
        const payload = {
            id,
            user: user.substring(0, 32), // Защита от переполнения
            bet: Math.min(Math.max(parseInt(bet), 1), 1000000), // Лимиты ставки
            ts: Date.now()
        };

        await kv.set(lobbyKey, payload, { ex: 600 });
        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        const keys = await kv.keys('lobby:*');
        if (keys.length === 0) return res.status(200).json([]);
        
        // mget может вернуть null для протухших ключей, фильтруем их
        const lobbies = await kv.mget(...keys);
        const result = lobbies.filter(l => l !== null);
        
        return res.status(200).json(result);
    }

    return res.status(405).end();
}
