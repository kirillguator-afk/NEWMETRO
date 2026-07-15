
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';
import { BlackjackEngine } from './logic.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const isAuthenticated = await verifyTelegramAuth(initData, botToken);
    if (!isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

    const { action, lobbyId, expectedTurn } = req.body;
    const tgUser = getUserData(initData);
    const gameKey = `game_session:${lobbyId}`;

    if (action === 'START') {
        const balance = await kv.get(`user:${tgUser.id}:balance`) || 1000;
        const bet = Math.min(Math.max(10, parseInt(req.body.bet) || 100), 10000);
        
        if (balance < bet) return res.status(400).json({ error: 'Insufficient balance' });

        const deck = BlackjackEngine.createDeck();
        const state = {
            deck,
            hostId: tgUser.id,
            hostName: tgUser.first_name,
            guestId: null,
            guestName: null,
            hostHand: [deck.pop(), deck.pop()],
            guestHand: [],
            dealerHand: [deck.pop(), deck.pop()],
            status: 'WAIT_GUEST',
            bet,
            turnCount: 1,
            activePlayer: 'host' 
        };
        
        // Списываем ставку сразу
        await kv.decrby(`user:${tgUser.id}:balance`, bet);
        
        await kv.set(gameKey, state, { ex: 900 });
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Game expired' });

    if (action === 'JOIN') {
        if (state.hostId === tgUser.id) return res.status(200).json(formatResponse(state, tgUser.id));
        if (state.guestId && state.guestId !== tgUser.id) return res.status(403).json({ error: 'Table full' });
        
        const balance = await kv.get(`user:${tgUser.id}:balance`) || 1000;
        if (balance < state.bet) return res.status(400).json({ error: 'Insufficient balance' });

        if (!state.guestId) {
            state.guestId = tgUser.id;
            state.guestName = tgUser.first_name;
            state.guestHand = [state.deck.pop(), state.deck.pop()];
            state.status = 'HOST_TURN';
            state.turnCount++;
            await kv.decrby(`user:${tgUser.id}:balance`, state.bet);
            await kv.set(gameKey, state, { ex: 900 });
        }
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    if (expectedTurn !== undefined && state.turnCount !== expectedTurn && action !== 'SYNC_REQUEST') {
        return res.status(409).json({ error: 'Sync error', ...formatResponse(state, tgUser.id) });
    }

    const isHost = tgUser.id === state.hostId;
    const isGuest = tgUser.id === state.guestId;
    const canAct = (isHost && state.status === 'HOST_TURN') || (isGuest && state.status === 'GUEST_TURN');

    if (!canAct && action !== 'SYNC_REQUEST') {
        return res.status(403).json({ error: 'Not your turn' });
    }

    let changed = false;
    if (action === 'HIT') {
        const targetHand = (state.status === 'HOST_TURN') ? state.hostHand : state.guestHand;
        targetHand.push(state.deck.pop());
        state.turnCount++;
        if (BlackjackEngine.getScore(targetHand) >= 21) advanceTurn(state);
        changed = true;
    } else if (action === 'STAND') {
        advanceTurn(state);
        state.turnCount++;
        changed = true;
    }

    if (changed || action === 'SYNC_REQUEST') {
        if (state.status === 'END' && changed) {
            await finalizeGame(state);
        }
        if (changed) await kv.set(gameKey, state, { ex: 900 });
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    return res.status(400).json({ error: 'Invalid move' });
}

async function finalizeGame(state) {
    const dScore = BlackjackEngine.getScore(state.dealerHand);
    
    const processResult = async (userId, pScore) => {
        if (!userId) return;
        const win = (pScore <= 21) && (dScore > 21 || pScore > dScore);
        const push = (pScore <= 21) && (pScore === dScore);
        
        const statsKey = `user:${userId}:stats`;
        const stats = await kv.get(statsKey) || { wins: 0, losses: 0, totalGames: 0 };
        stats.totalGames++;
        
        if (win) {
            stats.wins++;
            await kv.incrby(`user:${userId}:balance`, state.bet * 2);
        } else if (push) {
            await kv.incrby(`user:${userId}:balance`, state.bet);
        } else {
            stats.losses++;
        }
        await kv.set(statsKey, stats);
        
        // Update leaderboard logic here if needed
    };

    await processResult(state.hostId, BlackjackEngine.getScore(state.hostHand));
    await processResult(state.guestId, BlackjackEngine.getScore(state.guestHand));
}

function advanceTurn(state) {
    if (state.status === 'HOST_TURN') {
        state.status = 'GUEST_TURN';
    } else if (state.status === 'GUEST_TURN') {
        state.status = 'DEALER_TURN';
        while (BlackjackEngine.getScore(state.dealerHand) < 17) {
            state.dealerHand.push(state.deck.pop());
        }
        state.status = 'END';
    }
}

function formatResponse(state, viewerId) {
    const res = { ...state };
    delete res.deck;
    res.hostScore = BlackjackEngine.getScore(state.hostHand);
    res.guestScore = state.guestId ? BlackjackEngine.getScore(state.guestHand) : 0;
    const showDealer = state.status === 'END' || state.status === 'DEALER_TURN';
    res.dealerScore = showDealer ? BlackjackEngine.getScore(state.dealerHand) : '?';
    return res;
}
