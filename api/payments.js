
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHANNEL_ID = process.env.CHANNEL_ID;

    if (req.method === 'POST') {
        const payload = req.body;
        // 1. Сохраняем в БД для админа
        await kv.lpush('payments_queue', { ...payload, ts: Date.now() });
        
        // 2. Уведомляем админа в Telegram (опционально, так как есть админка)
        const text = `<b>💰 NEW REQUEST</b>\nType: ${payload.payType}\nUser: ${payload.user}\nAmt: ${payload.amount}`;
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: 'HTML' })
        });

        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        // Проверка прав (в идеале сверять с OWNER_ID из env)
        const payments = await kv.lrange('payments_queue', 0, 50);
        return res.status(200).json(payments);
    }

    return res.status(405).end();
}
