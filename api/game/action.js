
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';
import { BlackjackEngine } from './logic.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, lobbyId } = req.body;
    const tgUser = getUserData(initData);
    const gameKey = `game_session:${lobbyId}`;

    // 1. Инициализация игры (только Хост)
    if (action === 'START') {
        const deck = BlackjackEngine.createDeck();
        const gameState = {
            deck,
            playerHand: [deck.pop(), deck.pop()],
            dealerHand: [deck.pop(), deck.pop()],
            status: 'PLAYER_TURN',
            bet: req.body.bet || 100,
            hostId: tgUser.id
        };
        await kv.set(gameKey, gameState, { ex: 600 });
        // Убираем колоду из ответа для клиента (Security)
        const publicState = { ...gameState };
        delete publicState.deck;
        return res.status(200).json(publicState);
    }

    // 2. Игровые действия (Hit/Stand)
    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Game not found' });

    if (action === 'HIT') {
        if (state.status !== 'PLAYER_TURN') return res.status(400).json({ error: 'Invalid turn' });
        
        const card = state.deck.pop();
        state.playerHand.push(card);
        
        if (BlackjackEngine.getScore(state.playerHand) > 21) {
            state.status = 'END';
        }
    }

    if (action === 'STAND') {
        state.status = 'DEALER_TURN';
        while (BlackjackEngine.getScore(state.dealerHand) < 17) {
            state.dealerHand.push(state.deck.pop());
        }
        state.status = 'END';
    }

    await kv.set(gameKey, state, { ex: 600 });
    delete state.deck; // Не отправляем колоду клиенту
    return res.status(200).json(state);
}
