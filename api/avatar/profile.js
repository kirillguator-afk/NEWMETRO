
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);

    if (req.method === 'GET') {
        const profile = await kv.get(`user:${tgUser.id}:profile`);
        return res.status(200).json(profile || { avatarUrl: null });
    }

    return res.status(405).end();
}
