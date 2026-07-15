
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const ownerId = parseInt(process.env.OWNER_ID);

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);

    if (req.method === 'POST') {
        const { amount, payType, info } = req.body;
        
        // Валидация на сервере
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        const payload = {
            id: tgUser.id,
            user: tgUser.first_name,
            amount: parseInt(amount),
            payType: payType === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
            info: info ? info.substring(0, 128) : 'N/A',
            ts: Date.now()
        };

        // Сохраняем в защищенную очередь Redis
        await kv.lpush('payments_queue', payload);
        await kv.ltrim('payments_queue', 0, 99); // Храним только последние 100 транзакций

        // Отправка уведомления в канал через сервер
        try {
            const text = `<b>💰 NEW TRANSACTION</b>\nType: ${payload.payType}\nUser: ${payload.user}\nAmt: ${payload.amount}\nID: ${payload.id}`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: process.env.CHANNEL_ID, text, parse_mode: 'HTML' })
            });
        } catch (e) {}

        return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
        // Проверка прав администратора на БЭКЕНДЕ
        if (tgUser.id !== ownerId) {
            return res.status(403).json({ error: 'Forbidden: Admin access only' });
        }

        const payments = await kv.lrange('payments_queue', 0, 50);
        return res.status(200).json(payments);
    }

    return res.status(405).end();
}
