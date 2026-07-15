
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';
import { BlackjackEngine } from './logic.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const isAuthenticated = await verifyTelegramAuth(initData, botToken);
    if (!isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, lobbyId, expectedTurn } = req.body;
    const tgUser = getUserData(initData);
    const gameKey = `game_session:${lobbyId}`;

    if (action === 'START') {
        // [SECURITY] Проверка владения лобби перед запуском игры
        const lobby = await kv.get(`lobby:${lobbyId}`);
        if (!lobby || lobby.hostId !== tgUser.id) {
            return res.status(403).json({ error: 'Unauthorized: You are not the host of this table' });
        }

        // Проверка: нет ли уже активной игры
        const existingGame = await kv.get(gameKey);
        if (existingGame && existingGame.status !== 'END') {
            return res.status(409).json({ error: 'Game already in progress' });
        }

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
        
        if (BlackjackEngine.getScore(playerHand) === 21) {
            gameState.status = 'END';
        }

        await kv.set(gameKey, gameState, { ex: 900 });
        return res.status(200).json(formatResponse(gameState));
    }

    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Session not found' });

    if (state.hostId !== tgUser.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (expectedTurn !== undefined && state.turnCount !== expectedTurn) {
        return res.status(409).json({ error: 'Action conflict', ...formatResponse(state) });
    }

    let changed = false;

    if (action === 'HIT') {
        if (state.status === 'PLAYER_TURN') {
            if (BlackjackEngine.getScore(state.playerHand) >= 21) {
                return res.status(400).json({ error: 'Cannot hit with current score' });
            }

            state.playerHand.push(state.deck.pop());
            state.turnCount++;
            
            if (BlackjackEngine.getScore(state.playerHand) >= 21) {
                state.status = 'DEALER_TURN';
                processDealerPlay(state);
            }
            changed = true;
        }
    } else if (action === 'STAND') {
        if (state.status === 'PLAYER_TURN') {
            state.status = 'DEALER_TURN';
            processDealerPlay(state);
            state.turnCount++;
            changed = true;
        }
    }

    if (changed) {
        await kv.set(gameKey, state, { ex: 900 });
    }
    
    return res.status(200).json(formatResponse(state));
}

function processDealerPlay(state) {
    while (BlackjackEngine.getScore(state.dealerHand) < 17) {
        state.dealerHand.push(state.deck.pop());
    }
    state.status = 'END';
}

function formatResponse(state) {
    const res = { ...state };
    delete res.deck; 
    res.playerScore = BlackjackEngine.getScore(state.playerHand);
    const showDealer = state.status === 'END' || state.status === 'DEALER_TURN';
    res.dealerScore = showDealer ? BlackjackEngine.getScore(state.dealerHand) : '?';
    return res;
}
