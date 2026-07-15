
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifyTelegramAuth, getUserData } from './utils/auth.js';

/**
 * Nexus Prime: Атомарная платежная система
 */
export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const tgUser = getUserData(initData);
    const balanceKey = `user:${tgUser.id}:balance`;

    if (req.method === 'POST') {
        const { amount, payType } = req.body;
        const amt = parseInt(amount);
        if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

        // [SECURITY] Атомарная проверка баланса
        if (payType === 'WITHDRAW') {
            const current = await kv.get(balanceKey) || 0;
            if (current < amt) return res.status(400).json({ error: 'Insufficient funds' });
            
            const newBal = await kv.decrby(balanceKey, amt);
            if (newBal < 0) {
                await kv.incrby(balanceKey, amt); // Rollback
                return res.status(400).json({ error: 'Balance error' });
            }
        }

        const txId = crypto.randomUUID();
        const payload = {
            txId, id: tgUser.id, user: tgUser.first_name,
            amount: amt, payType, status: 'PENDING', ts: Date.now()
        };

        const pipe = kv.pipeline();
        pipe.set(`tx:${txId}`, payload);
        pipe.lpush('all_tx_index', txId);
        await pipe.exec();

        return res.status(200).json({ success: true, txId });
    }

    return res.status(405).end();
}
