
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
        if (!id) return res.status(400).json({ error: 'Lobby ID required' });
        
        const userActiveKey = `active_user_lobby:${tgUser.id}`;
        const existingLobbyId = await kv.get(userActiveKey);
        
        if (existingLobbyId && existingLobbyId !== id) {
            await kv.del(`lobby:${existingLobbyId}`);
            await kv.srem('active_lobbies_set', `lobby:${existingLobbyId}`);
        }

        const lobbyKey = `lobby:${id}`;
        const safeName = tgUser.first_name.replace(/[^\w\sа-яА-Я]/gi, '').substring(0, 20);

        const payload = {
            id,
            hostId: tgUser.id,
            user: safeName,
            bet: Math.max(10, Math.min(10000, parseInt(bet) || 100)),
            avatar: avatar || null,
            ts: Date.now()
        };

        const pipeline = kv.pipeline();
        pipeline.set(lobbyKey, payload, { ex: 600 });
        pipeline.sadd('active_lobbies_set', lobbyKey);
        pipeline.set(userActiveKey, id, { ex: 600 });
        await pipeline.exec();
        
        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        // [OPTIMIZATION] Ограничиваем выборку для стабильности при росте аудитории
        const keys = await kv.smembers('active_lobbies_set');
        if (!keys || keys.length === 0) return res.status(200).json([]);
        
        // Берем последние 50 созданных лобби
        const limitedKeys = keys.slice(-50);
        const lobbies = await kv.mget(...limitedKeys);
        
        const validLobbies = [];
        const deadKeys = [];

        lobbies.forEach((lobby, index) => {
            if (lobby) {
                validLobbies.push(lobby);
            } else {
                deadKeys.push(limitedKeys[index]);
            }
        });

        // Неблокирующая фоновая очистка "мертвых" ссылок
        if (deadKeys.length > 0) {
            kv.srem('active_lobbies_set', ...deadKeys).catch(() => {});
        }
        
        return res.status(200).json(validLobbies);
    }

    return res.status(405).end();
}
