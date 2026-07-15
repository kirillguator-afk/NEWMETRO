
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';
import { BlackjackEngine } from './logic.js';

/**
 * Nexus Prime: Game Engine Controller
 * Handles actions with Optimistic Concurrency Control
 */
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
        // [SECURITY] Verify lobby ownership
        const lobby = await kv.get(`lobby:${lobbyId}`);
        if (!lobby || lobby.hostId !== tgUser.id) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        const existingGame = await kv.get(gameKey);
        if (existingGame && existingGame.status !== 'END') {
            return res.status(409).json({ error: 'Session active' });
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
    if (!state) return res.status(404).json({ error: 'Game not found' });

    if (state.hostId !== tgUser.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // [STABILITY] Turn-based versioning check
    if (expectedTurn !== undefined && state.turnCount !== expectedTurn) {
        return res.status(409).json({ error: 'Sync error', ...formatResponse(state) });
    }

    let changed = false;

    if (action === 'HIT') {
        if (state.status === 'PLAYER_TURN') {
            if (BlackjackEngine.getScore(state.playerHand) >= 21) {
                return res.status(400).json({ error: 'Action denied' });
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
