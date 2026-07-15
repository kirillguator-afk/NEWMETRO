
import { kv } from '@vercel/kv';
import { verifyTelegramAuth, getUserData } from '../utils/auth.js';
import { BlackjackEngine } from './logic.js';

export default async function handler(req, res) {
    const initData = req.headers['x-telegram-init-data'];
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!await verifyTelegramAuth(initData, botToken)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, lobbyId, expectedTurn } = req.body;
    const tgUser = getUserData(initData);
    const gameKey = `game_session:${lobbyId}`;

    if (action === 'START') {
        const balance = await kv.get(`user:${tgUser.id}:balance`) || 1000;
        const bet = Math.min(Math.max(10, parseInt(req.body.bet) || 100), 10000);
        if (balance < bet) return res.status(400).json({ error: 'Insufficient balance' });

        const deck = BlackjackEngine.createDeck();
        const state = {
            deck, hostId: tgUser.id, hostName: tgUser.first_name,
            guestId: null, guestName: null, hostHand: [deck.pop(), deck.pop()],
            guestHand: [], dealerHand: [deck.pop(), deck.pop()],
            status: 'WAIT_GUEST', bet, turnCount: 1
        };
        
        await kv.decrby(`user:${tgUser.id}:balance`, bet);
        await kv.set(gameKey, state, { ex: 600 });
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Session expired' });

    if (action === 'JOIN') {
        if (state.hostId === tgUser.id) return res.status(200).json(formatResponse(state, tgUser.id));
        if (state.guestId && state.guestId !== tgUser.id) return res.status(403).json({ error: 'Table full' });
        
        const balance = await kv.get(`user:${tgUser.id}:balance`) || 1000;
        if (balance < state.bet) return res.status(400).json({ error: 'Balance too low' });

        if (!state.guestId) {
            state.guestId = tgUser.id;
            state.guestName = tgUser.first_name;
            state.guestHand = [state.deck.pop(), state.deck.pop()];
            state.status = 'HOST_TURN';
            state.turnCount++;
            await kv.decrby(`user:${tgUser.id}:balance`, state.bet);
            await kv.set(gameKey, state, { ex: 600 });
        }
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    if (expectedTurn !== undefined && state.turnCount !== expectedTurn && action !== 'SYNC_REQUEST') {
        return res.status(409).json({ error: 'Sync error', ...formatResponse(state, tgUser.id) });
    }

    const isHost = tgUser.id === state.hostId;
    const isGuest = tgUser.id === state.guestId;
    const myTurn = (isHost && state.status === 'HOST_TURN') || (isGuest && state.status === 'GUEST_TURN');

    if (!myTurn && action !== 'SYNC_REQUEST') return res.status(403).json({ error: 'Wait for turn' });

    let changed = false;
    if (action === 'HIT') {
        const hand = isHost ? state.hostHand : state.guestHand;
        if (BlackjackEngine.getScore(hand) < 21) {
            hand.push(state.deck.pop());
            state.turnCount++;
            if (BlackjackEngine.getScore(hand) >= 21) advanceTurn(state);
            changed = true;
        }
    } else if (action === 'STAND') {
        advanceTurn(state);
        state.turnCount++;
        changed = true;
    }

    if (changed || action === 'SYNC_REQUEST') {
        if (state.status === 'END' && changed) await finalize(state);
        if (changed) await kv.set(gameKey, state, { ex: 600 });
        return res.status(200).json(formatResponse(state, tgUser.id));
    }
    return res.status(400).end();
}

function advanceTurn(state) {
    if (state.status === 'HOST_TURN') {
        if (state.guestId) state.status = 'GUEST_TURN';
        else runDealer(state);
    } else if (state.status === 'GUEST_TURN') {
        runDealer(state);
    }
}

function runDealer(state) {
    state.status = 'DEALER_TURN';
    while (BlackjackEngine.getScore(state.dealerHand) < 17) state.dealerHand.push(state.deck.pop());
    state.status = 'END';
}

async function finalize(state) {
    const ds = BlackjackEngine.getScore(state.dealerHand);
    const process = async (uid, name, hand) => {
        if (!uid) return;
        const ps = BlackjackEngine.getScore(hand);
        const win = ps <= 21 && (ds > 21 || ps > ds);
        const push = ps <= 21 && ps === ds;
        const statsKey = `user:${uid}:stats`;
        const stats = await kv.get(statsKey) || { wins: 0, losses: 0, totalGames: 0 };
        stats.totalGames++;
        if (win) {
            stats.wins++;
            await kv.incrby(`user:${uid}:balance`, state.bet * 2);
            // [ATOMIC LEADERBOARD] Using Redis Sorted Set
            await kv.zadd('lb_wins', { score: stats.wins, member: `${uid}:${name}` });
        } else if (push) {
            await kv.incrby(`user:${uid}:balance`, state.bet);
        } else stats.losses++;
        await kv.set(statsKey, stats);
    };
    await Promise.all([
        process(state.hostId, state.hostName, state.hostHand),
        process(state.guestId, state.guestName, state.guestHand)
    ]);
}

function formatResponse(state, viewerId) {
    const res = { ...state }; delete res.deck;
    res.hostScore = BlackjackEngine.getScore(state.hostHand);
    res.guestScore = state.guestId ? BlackjackEngine.getScore(state.guestHand) : 0;
    const showD = state.status === 'END' || state.status === 'DEALER_TURN';
    res.dealerScore = showD ? BlackjackEngine.getScore(state.dealerHand) : '?';
    res.myRole = viewerId === state.hostId ? 'host' : 'guest';
    return res;
}
