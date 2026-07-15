
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

/**
 * Nexus Prime: bodyParser must be DISABLED for direct streaming to Vercel Blob.
 */
export const config = {
    api: { bodyParser: false },
};

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);

    if (req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        // Поддерживаем основные форматы изображений
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
            return res.status(400).json({ error: 'Invalid format. Use WEBP, PNG or JPG.' });
        }

        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > 1.5 * 1024 * 1024) {
            return res.status(413).json({ error: 'File too large (1.5MB limit)' });
        }

        const fileId = crypto.randomBytes(8).toString('hex');
        // Сохраняем расширение из content-type
        const ext = contentType.split('/')[1] || 'webp';
        const filename = `avatars/${tgUser.id}/${fileId}.${ext}`;

        try {
            // [STREAMING] Передаем req напрямую как ReadableStream
            const blob = await put(filename, req, {
                access: 'public',
                contentType: contentType,
            });

            await kv.set(`user:${tgUser.id}:profile`, {
                avatarUrl: blob.url,
                updatedAt: Date.now()
            });

            return res.status(200).json(blob);
        } catch (error) {
            console.error("Blob upload error:", error);
            return res.status(500).json({ error: 'Internal Storage Error' });
        }
    }

    return res.status(405).end();
}
