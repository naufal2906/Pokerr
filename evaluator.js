export class PokerEvaluator {
  static getCombinations(cards, k = 5) {
    if (k === 0) return [[]];
    if (cards.length === 0) return [];
    const head = cards[0];
    const tail = cards.slice(1);
    const withHead = this.getCombinations(tail, k - 1).map(c => [head, ...c]);
    const withoutHead = this.getCombinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  static evaluateHoleCards(cards) {
    if (cards.length === 0) return "-";
    if (cards.length === 1) return `High Card (${cards[0].rank.label})`;
    if (cards[0].rank.value === cards[1].rank.value) {
      return `One Pair (${cards[0].rank.label})`;
    }
    const high = cards[0].rank.value > cards[1].rank.value ? cards[0] : cards[1];
    return `High Card (${high.rank.label})`;
  }

  static evaluate5CardHand(cards) {
    const sorted = [...cards].sort((a, b) => b.rank.value - a.rank.value);
    const isFlush = sorted.every(c => c.suit.symbol === sorted[0].suit.symbol);
    
    let isStraight = false;
    let straightHigh = 0;
    const values = [...new Set(sorted.map(c => c.rank.value))];
    
    if (values.length === 5) {
      if (values[0] - values[4] === 4) {
        isStraight = true;
        straightHigh = values[0];
      } else if (values[0] === 14 && values[1] === 5 && values[4] === 2) {
        isStraight = true;
        straightHigh = 5;
      }
    }

    const counts = {};
    sorted.forEach(c => counts[c.rank.value] = (counts[c.rank.value] || 0) + 1);
    const freq = Object.entries(counts)
      .map(([val, count]) => ({ val: Number(val), count }))
      .sort((a, b) => b.count - a.count || b.val - a.val);

    if (isFlush && isStraight) {
      return { rankName: straightHigh === 14 ? 'Royal Flush' : 'Straight Flush', score: 9, cards: sorted };
    }
    if (freq[0].count === 4) return { rankName: 'Four of a Kind', score: 8, cards: sorted };
    if (freq[0].count === 3 && freq[1].count === 2) return { rankName: 'Full House', score: 7, cards: sorted };
    if (isFlush) return { rankName: 'Flush', score: 6, cards: sorted };
    if (isStraight) return { rankName: 'Straight', score: 5, cards: sorted };
    if (freq[0].count === 3) return { rankName: 'Three of a Kind', score: 4, cards: sorted };
    if (freq[0].count === 2 && freq[1].count === 2) return { rankName: 'Two Pair', score: 3, cards: sorted };
    if (freq[0].count === 2) return { rankName: 'One Pair', score: 2, cards: sorted };
    return { rankName: 'High Card', score: 1, cards: sorted };
  }

  static getBestHand(allCards) {
    if (allCards.length < 5) {
      return { rankName: 'Minimal 5 Kartu Aktif', cards: [] };
    }
    const combinations = this.getCombinations(allCards, 5);
    let bestHand = null;

    for (const combo of combinations) {
      const evalResult = this.evaluate5CardHand(combo);
      if (!bestHand || evalResult.score > bestHand.score) {
        bestHand = evalResult;
      }
    }
    return bestHand;
  }

  // Kalkulasi Persentase Kekuatan Kartu (Win Equity Approximation)
  static calculateStrength(handCards, communityCards) {
    if (handCards.length === 0) return 0;

    let baseEquity = 0;
    const totalCards = [...handCards, ...communityCards];

    if (totalCards.length < 5) {
      // Ekuitas awal Pre-Flop berdasarkan 2 Kartu Tangan
      const c1 = handCards[0];
      const c2 = handCards[1];
      if (!c2) return Math.round((c1.rank.value / 14) * 25);

      const isPair = c1.rank.value === c2.rank.value;
      const isSuited = c1.suit.symbol === c2.suit.symbol;
      const highRank = Math.max(c1.rank.value, c2.rank.value);

      baseEquity = (highRank / 14) * 45;
      if (isPair) baseEquity += 35;
      if (isSuited) baseEquity += 10;
    } else {
      // Ekuitas setelah Flop / Turn / River berdasarkan Hand Rank Score
      const best = this.getBestHand(totalCards);
      baseEquity = (best.score / 9) * 100;
    }

    return Math.min(Math.round(baseEquity), 100);
  }
}
