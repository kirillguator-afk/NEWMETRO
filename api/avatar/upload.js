
import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';

export const config = {
    api: { bodyParser: true }, // Используем bodyParser для возможности чтения заголовка файла
};

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);

    if (req.method === 'POST') {
        // [SECURITY] Проверка Magic Bytes (базовая проверка заголовка WEBP/PNG/JPG)
        // Для этого нам нужно тело как Buffer (vercel конвертирует body в строку или JSON)
        // В Node.js среде Vercel, если bodyParser включен, body — это объект или строка.
        // Для строгой проверки лучше стримить, но здесь добавим проверку типа из Content-Type 
        // и ограничим размер.
        
        const contentType = req.headers['content-type'] || '';
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
            return res.status(400).json({ error: 'Invalid image format. WEBP/PNG/JPG only.' });
        }

        const contentLength = parseInt(req.headers['content-length'] || '0');
        if (contentLength > 1.5 * 1024 * 1024) {
            return res.status(413).json({ error: 'File too large (1.5MB limit)' });
        }

        const fileId = crypto.randomBytes(8).toString('hex');
        const filename = `avatars/${tgUser.id}/${fileId}.webp`;

        try {
            // Пересылаем тело напрямую в Blob
            // Примечание: req в Vercel является ReadableStream
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
            console.error(error);
            return res.status(500).json({ error: 'Internal Error' });
        }
    }

    return res.status(405).end();
}
