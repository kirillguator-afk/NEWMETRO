
export const Blackjack = {
    createDeck() {
        const suits = ['♠', '♣', '♥', '♦'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let deck = [];
        suits.forEach(s => values.forEach(v => deck.push({ suit: s, value: v })));
        return this.shuffle(deck);
    },

    /**
     * Криптографически стойкое перемешивание Фишера-Йейтса
     */
    shuffle(deck) {
        const randomValues = new Uint32Array(deck.length);
        window.crypto.getRandomValues(randomValues);
        
        for (let i = deck.length - 1; i > 0; i--) {
            const j = randomValues[i] % (i + 1);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    },

    getScore(hand) {
        let score = 0;
        let aces = 0;
        hand.forEach(c => {
            if (c.value === 'A') { aces += 1; score += 11; }
            else if (['J', 'Q', 'K'].includes(c.value)) score += 10;
            else score += parseInt(c.value);
        });
        while (score > 21 && aces > 0) { score -= 10; aces -= 1; }
        return score;
    }
};
