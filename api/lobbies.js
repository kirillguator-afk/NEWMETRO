
import { kv } from '@vercel/kv';
import { verifyTelegramAuth } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST') {
        const { id, user, bet, avatar } = req.body;
        if (!id || !user) return res.status(400).json({ error: 'Invalid data' });
        
        const lobbyKey = `lobby:${id}`;
        const payload = {
            id,
            user: user.substring(0, 20),
            bet: parseInt(bet) || 0,
            avatar: avatar || null,
            ts: Date.now()
        };

        // Используем SET для хранения списка ключей (O(1))
        await kv.set(lobbyKey, payload, { ex: 600 });
        await kv.sadd('active_lobbies_set', lobbyKey);
        
        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        // Получаем ключи из сета
        const keys = await kv.smembers('active_lobbies_set');
        if (keys.length === 0) return res.status(200).json([]);
        
        const lobbies = await kv.mget(...keys);
        const validLobbies = [];
        const expiredKeys = [];

        // Фильтруем протухшие ключи (Redis KV удаляет сам, но в сете они могут остаться)
        lobbies.forEach((lobby, index) => {
            if (lobby) {
                validLobbies.push(lobby);
            } else {
                expiredKeys.push(keys[index]);
            }
        });

        // Чистим сет от старых ключей в фоне
        if (expiredKeys.length > 0) {
            await kv.srem('active_lobbies_set', ...expiredKeys);
        }
        
        return res.status(200).json(validLobbies);
    }

    return res.status(405).end();
}
