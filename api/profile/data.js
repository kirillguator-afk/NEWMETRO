
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);
    const userId = tgUser.id;

    // Собираем данные из разных ключей
    const [balance, stats, profile] = await Promise.all([
        kv.get(`user:${userId}:balance`),
        kv.get(`user:${userId}:stats`),
        kv.get(`user:${userId}:profile`)
    ]);

    return res.status(200).json({
        id: userId,
        name: tgUser.first_name,
        balance: balance || 1000, // Начальный капитал для беты
        stats: stats || { wins: 0, losses: 0, totalGames: 0 },
        avatarUrl: profile?.avatarUrl || null
    });
}
