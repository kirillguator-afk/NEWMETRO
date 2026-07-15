
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';
import { BlackjackEngine } from './logic.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // [CRITICAL FIX] Гарантированный await
    const isAuthenticated = await verifyTelegramAuth(initData, botToken);
    if (!isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, lobbyId, expectedTurn } = req.body;
    const tgUser = getUserData(initData);
    const gameKey = `game_session:${lobbyId}`;

    if (action === 'START') {
        const deck = BlackjackEngine.createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        
        const gameState = {
            deck,
            playerHand,
            dealerHand,
            status: 'PLAYER_TURN',
            bet: Math.min(Math.max(10, parseInt(req.body.bet) || 100), 10000),
            hostId: tgUser.id,
            turnCount: 1
        };
        await kv.set(gameKey, gameState, { ex: 900 });
        
        return res.status(200).json(formatResponse(gameState));
    }

    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Session not found' });

    if (state.hostId !== tgUser.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Optimistic Concurrency Control
    if (expectedTurn !== undefined && state.turnCount !== expectedTurn) {
        return res.status(409).json({ error: 'Out of sync', ...formatResponse(state) });
    }

    let changed = false;

    if (action === 'HIT') {
        if (state.status === 'PLAYER_TURN') {
            state.playerHand.push(state.deck.pop());
            state.turnCount++;
            if (BlackjackEngine.getScore(state.playerHand) > 21) {
                state.status = 'END';
            }
            changed = true;
        }
    } else if (action === 'STAND') {
        if (state.status === 'PLAYER_TURN') {
            state.status = 'DEALER_TURN';
            while (BlackjackEngine.getScore(state.dealerHand) < 17) {
                state.dealerHand.push(state.deck.pop());
            }
            state.status = 'END';
            state.turnCount++;
            changed = true;
        }
    }

    if (changed) {
        await kv.set(gameKey, state, { ex: 900 });
    }
    
    return res.status(200).json(formatResponse(state));
}

/**
 * Nexus Prime: Унификация ответа.
 * Возвращаем очки, чтобы клиент не гадал.
 */
function formatResponse(state) {
    const res = { ...state };
    delete res.deck; // Скрываем колоду от клиента
    res.playerScore = BlackjackEngine.getScore(state.playerHand);
    
    // Дилер показывает счет только в конце или когда его ход
    const showDealer = state.status === 'END' || state.status === 'DEALER_TURN';
    res.dealerScore = showDealer ? BlackjackEngine.getScore(state.dealerHand) : '?';
    
    return res;
}
