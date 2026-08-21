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

  // Evaluasi 2 Kartu di Tangan
  static evaluateHoleCards(cards) {
    if (cards.length === 0) return "-";
    if (cards.length === 1) return `High Card (${cards[0].rank.label})`;
    if (cards[0].rank.value === cards[1].rank.value) {
      return `One Pair (${cards[0].rank.label})`;
    }
    const high = cards[0].rank.value > cards[1].rank.value ? cards[0] : cards[1];
    return `High Card (${high.rank.label})`;
  }

  // Evaluasi dasar 5 kartu
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

  // Evaluasi fleksibel untuk 3 hingga 5 Kartu Komunitas
  static evaluatePartialCards(cards) {
    if (cards.length < 3) return "Minimal 3 Kartu Komunitas";
    if (cards.length === 5) return this.evaluate5CardHand(cards).rankName;

    // Untuk 3 atau 4 kartu komunitas
    const sorted = [...cards].sort((a, b) => b.rank.value - a.rank.value);
    const counts = {};
    sorted.forEach(c => counts[c.rank.value] = (counts[c.rank.value] || 0) + 1);
    const freq = Object.entries(counts)
      .map(([val, count]) => ({ val: Number(val), count }))
      .sort((a, b) => b.count - a.count || b.val - a.val);

    if (freq[0].count === 4) return 'Four of a Kind';
    if (freq[0].count === 3 && freq[1]?.count === 2) return 'Full House';
    if (freq[0].count === 3) return 'Three of a Kind';
    if (freq[0].count === 2 && freq[1]?.count === 2) return 'Two Pair';
    if (freq[0].count === 2) return 'One Pair';
    return `High Card (${sorted[0].rank.label})`;
  }

  // Evaluasi Kombinasi Tertinggi (Total 5 - 7 Kartu)
  static getBestHand(allCards) {
    if (allCards.length < 5) {
      return { rankName: 'Minimal 5 Kartu di Meja', cards: [] };
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
}
