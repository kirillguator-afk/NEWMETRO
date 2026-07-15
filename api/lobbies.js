
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);

    if (req.method === 'POST') {
        const { id, bet, avatar } = req.body;
        if (!id) return res.status(400).json({ error: 'Lobby ID is required' });
        
        const lobbyKey = `lobby:${id}`;
        const safeName = tgUser.first_name.replace(/[<>]/g, '').substring(0, 25);

        const payload = {
            id,
            hostId: tgUser.id,
            user: safeName,
            bet: Math.max(0, parseInt(bet) || 0),
            avatar: avatar || null,
            ts: Date.now()
        };

        const pipeline = kv.pipeline();
        pipeline.set(lobbyKey, payload, { ex: 600 });
        pipeline.sadd('active_lobbies_set', lobbyKey);
        await pipeline.exec();
        
        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        const keys = await kv.smembers('active_lobbies_set');
        if (keys.length === 0) return res.status(200).json([]);
        
        const lobbies = await kv.mget(...keys);
        
        // [OPTIMIZATION] Фильтруем протухшие ключи без блокировки
        const validLobbies = [];
        const deadKeys = [];

        lobbies.forEach((lobby, index) => {
            if (lobby) {
                validLobbies.push(lobby);
            } else {
                deadKeys.push(keys[index]);
            }
        });

        // Очищаем индекс от пустых ссылок в фоне
        if (deadKeys.length > 0) {
            kv.srem('active_lobbies_set', ...deadKeys).catch(() => {});
        }
        
        return res.status(200).json(validLobbies);
    }

    return res.status(405).end();
}
