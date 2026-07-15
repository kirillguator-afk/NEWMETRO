
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

export const config = {
    api: { bodyParser: false }, // Важно для стриминга напрямую в Blob
};

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // [SECURITY] Проверка типа файла
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) {
        return res.status(400).json({ error: 'Only images are allowed' });
    }

    // [SECURITY] Ограничение размера (2MB)
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 2 * 1024 * 1024) {
        return res.status(413).json({ error: 'File too large (max 2MB)' });
    }

    const tgUser = getUserData(initData);
    const randomId = Math.random().toString(36).slice(2, 10);
    const filename = `avatars/${tgUser.id}_${randomId}.webp`;

    try {
        const blob = await put(filename, req, {
            access: 'public',
            contentType: contentType || 'image/webp',
        });

        await kv.set(`user:${tgUser.id}:profile`, {
            avatarUrl: blob.url,
            updatedAt: Date.now()
        });

        return res.status(200).json(blob);
    } catch (error) {
        return res.status(500).json({ error: 'Upload failed' });
    }
}
