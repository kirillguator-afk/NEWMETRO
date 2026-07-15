
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifyTelegramAuth, getUserData } from './utils/auth.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const ownerId = parseInt(process.env.OWNER_ID);

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);

    if (req.method === 'POST') {
        const { amount, payType, info } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

        // [SECURITY] Простейший Rate Limit на транзакции (1 в 30 секунд)
        const rateKey = `limit:pay:${tgUser.id}`;
        const isLimited = await kv.get(rateKey);
        if (isLimited) return res.status(429).json({ error: 'Please wait before next request' });

        const txId = crypto.randomUUID();
        const payload = {
            txId,
            id: tgUser.id,
            user: tgUser.first_name,
            amount: parseInt(amount),
            payType: payType === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
            info: info ? info.substring(0, 128) : 'N/A',
            status: 'PENDING',
            ts: Date.now()
        };

        // [DURABILITY] Используем транзакционную модель вместо очереди ltrim
        const pipeline = kv.pipeline();
        pipeline.set(`tx:${txId}`, payload);
        pipeline.lpush('all_tx_index', txId);
        pipeline.set(rateKey, '1', { ex: 30 }); // Rate limit 30s
        await pipeline.exec();

        try {
            const text = `<b>💰 NEW TRANSACTION</b>\nType: ${payload.payType}\nUser: ${payload.user}\nAmt: ${payload.amount}\nTX: <code>${txId}</code>`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: process.env.CHANNEL_ID, text, parse_mode: 'HTML' })
            });
        } catch (e) {}

        return res.status(200).json({ success: true, txId });
    }

    if (req.method === 'GET') {
        if (tgUser.id !== ownerId) return res.status(403).json({ error: 'Forbidden' });

        // Получаем последние 50 ID транзакций
        const txIds = await kv.lrange('all_tx_index', 0, 49);
        if (txIds.length === 0) return res.status(200).json([]);

        // Загружаем данные по каждому ID
        const keys = txIds.map(id => `tx:${id}`);
        const payments = await kv.mget(...keys);
        
        return res.status(200).json(payments.filter(p => p !== null));
    }

    return res.status(405).end();
}
