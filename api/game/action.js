
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

    // 1. Инициализация (START)
    if (action === 'START') {
        const deck = BlackjackEngine.createDeck();
        const gameState = {
            deck,
            playerHand: [deck.pop(), deck.pop()],
            dealerHand: [deck.pop(), deck.pop()],
            status: 'PLAYER_TURN',
            bet: Math.min(Math.max(10, parseInt(req.body.bet) || 100), 10000),
            hostId: tgUser.id // Привязываем игру к создателю
        };
        await kv.set(gameKey, gameState, { ex: 900 }); // 15 мин TTL
        
        const publicState = { ...gameState };
        delete publicState.deck;
        return res.status(200).json(publicState);
    }

    // 2. Загрузка состояния
    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Session expired or not found' });

    // [CRITICAL SECURITY] Проверка владения сессией
    if (state.hostId !== tgUser.id) {
        return res.status(403).json({ error: 'Access denied: You are not the player of this session' });
    }

    if (action === 'HIT') {
        if (state.status !== 'PLAYER_TURN') return res.status(400).json({ error: 'Not your turn' });
        
        const card = state.deck.pop();
        state.playerHand.push(card);
        
        if (BlackjackEngine.getScore(state.playerHand) > 21) {
            state.status = 'END';
        }
    } else if (action === 'STAND') {
        if (state.status !== 'PLAYER_TURN') return res.status(400).json({ error: 'Invalid sequence' });
        
        state.status = 'DEALER_TURN';
        // Логика дилера
        while (BlackjackEngine.getScore(state.dealerHand) < 17) {
            state.dealerHand.push(state.deck.pop());
        }
        state.status = 'END';
    } else if (action === 'SYNC_REQUEST') {
        // Просто возвращаем текущее состояние
    } else {
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Сохраняем обновленное состояние
    await kv.set(gameKey, state, { ex: 900 });
    
    // Безопасный ответ (без колоды)
    const secureState = { ...state };
    delete secureState.deck;
    return res.status(200).json(secureState);
}
