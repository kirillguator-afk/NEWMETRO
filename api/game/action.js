
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

    // 1. Инициализация стола Хостом
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
            turnCount: 1
        };
        
        // Атомарное списание ставки
        await kv.decrby(`user:${tgUser.id}:balance`, bet);
        await kv.set(gameKey, state, { ex: 900 });
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    const state = await kv.get(gameKey);
    if (!state) return res.status(404).json({ error: 'Session expired' });

    // 2. Вход Гостя
    if (action === 'JOIN') {
        if (state.hostId === tgUser.id) return res.status(200).json(formatResponse(state, tgUser.id));
        if (state.guestId && state.guestId !== tgUser.id) return res.status(403).json({ error: 'Table is full' });
        
        if (!state.guestId) {
            const balance = await kv.get(`user:${tgUser.id}:balance`) || 1000;
            if (balance < state.bet) return res.status(400).json({ error: 'Insufficient funds to join' });

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

    // 3. Синхронизация (без мутаций)
    if (action === 'SYNC_REQUEST') {
        return res.status(200).json(formatResponse(state, tgUser.id));
    }

    // 4. Игровые действия (HIT / STAND)
    if (expectedTurn !== undefined && state.turnCount !== expectedTurn) {
        return res.status(409).json({ error: 'Out of sync', ...formatResponse(state, tgUser.id) });
    }

    const isHost = tgUser.id === state.hostId;
    const isGuest = tgUser.id === state.guestId;
    const myTurn = (isHost && state.status === 'HOST_TURN') || (isGuest && state.status === 'GUEST_TURN');

    if (!myTurn) return res.status(403).json({ error: 'Waiting for opponent...' });

    let changed = false;
    const currentHand = isHost ? state.hostHand : state.guestHand;

    if (action === 'HIT') {
        if (BlackjackEngine.getScore(currentHand) < 21) {
            currentHand.push(state.deck.pop());
            state.turnCount++;
            if (BlackjackEngine.getScore(currentHand) >= 21) advanceGameStatus(state);
            changed = true;
        }
    } else if (action === 'STAND') {
        advanceGameStatus(state);
        state.turnCount++;
        changed = true;
    }

    if (changed) {
        if (state.status === 'END') await finalizePayouts(state);
        await kv.set(gameKey, state, { ex: 900 });
    }

    return res.status(200).json(formatResponse(state, tgUser.id));
}

function advanceGameStatus(state) {
    if (state.status === 'HOST_TURN') {
        state.status = state.guestId ? 'GUEST_TURN' : 'DEALER_TURN';
        if (state.status === 'DEALER_TURN') runDealerLogic(state);
    } else if (state.status === 'GUEST_TURN') {
        state.status = 'DEALER_TURN';
        runDealerLogic(state);
    }
}

function runDealerLogic(state) {
    while (BlackjackEngine.getScore(state.dealerHand) < 17) {
        state.dealerHand.push(state.deck.pop());
    }
    state.status = 'END';
}

async function finalizePayouts(state) {
    const ds = BlackjackEngine.getScore(state.dealerHand);
    const pipeline = kv.pipeline();

    const resolvePlayer = async (uid, name, hand) => {
        if (!uid) return;
        const ps = BlackjackEngine.getScore(hand);
        const win = ps <= 21 && (ds > 21 || ps > ds);
        const push = ps <= 21 && ps === ds;

        const statsKey = `user:${uid}:stats`;
        const stats = await kv.get(statsKey) || { wins: 0, losses: 0, totalGames: 0 };
        stats.totalGames++;

        if (win) {
            stats.wins++;
            pipeline.incrby(`user:${uid}:balance`, state.bet * 2);
            pipeline.zadd('lb_wins', { score: stats.wins, member: `${uid}:${name}` });
        } else if (push) {
            pipeline.incrby(`user:${uid}:balance`, state.bet);
        } else {
            stats.losses++;
        }
        pipeline.set(statsKey, stats);
    };

    await resolvePlayer(state.hostId, state.hostName, state.hostHand);
    await resolvePlayer(state.guestId, state.guestName, state.guestHand);
    await pipeline.exec();
}

function formatResponse(state, viewerId) {
    const res = { ...state };
    delete res.deck;
    res.hostScore = BlackjackEngine.getScore(state.hostHand);
    res.guestScore = state.guestId ? BlackjackEngine.getScore(state.guestHand) : 0;
    const showDealer = state.status === 'END' || state.status === 'DEALER_TURN';
    res.dealerScore = showDealer ? BlackjackEngine.getScore(state.dealerHand) : '?';
    res.myRole = viewerId === state.hostId ? 'host' : 'guest';
    return res;
}
