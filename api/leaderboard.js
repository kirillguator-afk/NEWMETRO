
import { kv } from '@vercel/kv';
import { verifyTelegramAuth } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // [ATOMIC FETCH] Get top 50 players from Sorted Set
        const top = await kv.zrange('lb_wins', 0, 49, { rev: true, withScores: true });
        const results = [];
        for (let i = 0; i < top.length; i += 2) {
            const [id, name] = top[i].split(':');
            results.push({ id, name, wins: top[i + 1] });
        }
        return res.status(200).json(results);
    } catch (e) {
        return res.status(200).json([]);
    }
}
