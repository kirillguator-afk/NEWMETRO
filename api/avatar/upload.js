
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);
    // Генерируем уникальное имя на сервере для безопасности
    const randomId = Math.random().toString(36).slice(2, 10);
    const filename = `avatars/${tgUser.id}_${randomId}.webp`;

    try {
        const blob = await put(filename, req, {
            access: 'public',
            contentType: req.headers['content-type'] || 'image/webp',
        });

        await kv.set(`user:${tgUser.id}:profile`, {
            avatarUrl: blob.url,
            updatedAt: Date.now()
        });

        return res.status(200).json(blob);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export const config = {
    api: { bodyParser: false },
};
