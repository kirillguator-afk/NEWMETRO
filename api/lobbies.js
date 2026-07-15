
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // В продакшене здесь должна быть проверка Telegram InitData
    
    if (req.method === 'POST') {
        const { id, user, bet } = req.body;
        if (!id || !user) return res.status(400).json({ error: 'Missing data' });
        
        const lobbyKey = `lobby:${id}`;
        await kv.set(lobbyKey, { id, user, bet, ts: Date.now() }, { ex: 600 }); // TTL 10 минут
        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        const keys = await kv.keys('lobby:*');
        if (keys.length === 0) return res.status(200).json([]);
        
        const lobbies = await kv.mget(...keys);
        return res.status(200).json(lobbies.filter(l => l !== null));
    }

    return res.status(405).end();
}
