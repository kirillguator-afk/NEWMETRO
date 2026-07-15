
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

export const config = {
    api: { bodyParser: false },
};

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
        return res.status(400).json({ error: 'Images only' });
    }

    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 2 * 1024 * 1024) {
        return res.status(413).json({ error: 'Limit 2MB' });
    }

    const tgUser = getUserData(initData);
    
    // [SECURITY] Используем криптографически стойкий ID для файла
    const fileId = crypto.randomBytes(8).toString('hex');
    const filename = `avatars/${tgUser.id}/${fileId}.webp`;

    try {
        const blob = await put(filename, req, {
            access: 'public',
            contentType: 'image/webp',
        });

        await kv.set(`user:${tgUser.id}:profile`, {
            avatarUrl: blob.url,
            updatedAt: Date.now()
        });

        return res.status(200).json(blob);
    } catch (error) {
        return res.status(500).json({ error: 'Internal Error' });
    }
}
