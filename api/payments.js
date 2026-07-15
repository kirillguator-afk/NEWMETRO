
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
    const balanceKey = `user:${tgUser.id}:balance`;

    if (req.method === 'POST') {
        const { amount, payType, info } = req.body;
        const amt = parseInt(amount);
        if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

        // [ATOMICITY] Использование атомарного списания вместо GET -> SET
        if (payType === 'WITHDRAW') {
            const newBalance = await kv.decrby(balanceKey, amt);
            if (newBalance < 0) {
                // Возвращаем баланс назад, если он ушел в минус
                await kv.incrby(balanceKey, amt);
                return res.status(400).json({ error: 'Insufficient funds' });
            }
        }

        const rateKey = `limit:pay:${tgUser.id}`;
        const isLimited = await kv.get(rateKey);
        if (isLimited) return res.status(429).json({ error: 'Rate limit. Wait 30s.' });

        const txId = crypto.randomUUID();
        const payload = {
            txId, id: tgUser.id, user: tgUser.first_name,
            amount: amt, payType: payType === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
            info: info?.substring(0, 128) || 'N/A',
            status: 'PENDING', ts: Date.now()
        };

        const pipeline = kv.pipeline();
        pipeline.set(`tx:${txId}`, payload);
        pipeline.lpush('all_tx_index', txId);
        pipeline.set(rateKey, '1', { ex: 30 }); 
        await pipeline.exec();

        // Уведомление администратора
        try {
            const text = `<b>💰 TRANSACTION</b>\nType: ${payload.payType}\nUser: ${payload.user}\nAmt: ${payload.amount}\nTX: <code>${txId}</code>`;
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
        const txIds = await kv.lrange('all_tx_index', 0, 49);
        if (txIds.length === 0) return res.status(200).json([]);
        const rawPayments = await kv.mget(...txIds.map(id => `tx:${id}`));
        return res.status(200).json(rawPayments.filter(Boolean));
    }

    return res.status(405).end();
}
