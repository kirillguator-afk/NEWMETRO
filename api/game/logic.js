
import crypto from 'crypto';

/**
 * Server-Side Game Logic (Source of Truth)
 * Nexus Prime: Enhanced with Strict Data Validation
 */
export const BlackjackEngine = {
    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let deck = [];
        suits.forEach(s => values.forEach(v => deck.push({ suit: s, value: v })));
        
        // [SECURITY] Fisher-Yates Shuffle with Cryptographically Secure RNG
        for (let i = deck.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    },

    getScore(hand) {
        if (!Array.isArray(hand)) return 0;
        
        let score = 0;
        let aces = 0;
        
        hand.forEach(c => {
            if (!c || !c.value) return; // Defensive check
            
            if (c.value === 'A') { 
                aces += 1; 
                score += 11; 
            } else if (['J', 'Q', 'K'].includes(c.value)) {
                score += 10;
            } else {
                const val = parseInt(c.value);
                score += isNaN(val) ? 0 : val;
            }
        });
        
        while (score > 21 && aces > 0) { 
            score -= 10; 
            aces -= 1; 
        }
        return score;
    }
};
