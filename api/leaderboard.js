
import { kv } from '@vercel/kv';
import { verifyTelegramAuth } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // В продакшене мы бы использовали ZRANGE, но для беты в KV 
    // мы можем хранить список топ-игроков в отдельном ключе, обновляемом при победах.
    const leaderboard = await kv.get('global_leaderboard') || [];
    
    return res.status(200).json(leaderboard.slice(0, 10));
}
