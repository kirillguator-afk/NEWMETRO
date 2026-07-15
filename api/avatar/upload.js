
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
    const filename = req.query.filename || `avatar_${tgUser.id}.webp`;

    try {
        // 1. Загружаем файл в Vercel Blob
        // Примечание: В Serverless функциях req является ReadableStream
        const blob = await put(filename, req, {
            access: 'public', // Ставим public для простоты отображения в P2P
            contentType: req.headers['content-type'],
        });

        // 2. Сохраняем URL аватарки в профиль пользователя в KV
        await kv.set(`user:${tgUser.id}:profile`, {
            avatarUrl: blob.url,
            updatedAt: Date.now()
        });

        return res.status(200).json(blob);
    } catch (error) {
        console.error('Blob Upload Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

export const config = {
    api: {
        bodyParser: false, // Отключаем стандартный парсер для прямой стриминговой загрузки
    },
};
