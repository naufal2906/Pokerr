export class PokerEvaluator {
  static RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  static SUITS = ['♠', '♥', '♦', '♣'];

  static getBestHand(cards) {
    const validCards = (cards || []).filter(c => c !== null && c !== undefined);
    
    if (validCards.length === 0) {
      return { score: 0, rankName: "High Card" };
    }

    if (validCards.length < 5) {
      return this.evaluateSubset(validCards);
    }

    const combinations = this.getCombinations(validCards, 5);
    let bestHand = { score: 0, rankName: "High Card" };

    for (const combo of combinations) {
      const evalResult = this.evaluate5CardHand(combo);
      if (evalResult.score > bestHand.score) {
        bestHand = evalResult;
      }
    }

    const ranks = [...new Set(validCards.map(c => c.rank ? c.rank.value : 0))].filter(v => v > 0).sort((a, b) => a - b);
    const drawText = this.checkStraightDrawNeeded(ranks);
    if (drawText && bestHand.score < 5) {
      bestHand.rankName += ` (${drawText})`;
    }

    return bestHand;
  }

  static evaluateSubset(cards) {
    if (!cards || cards.length === 0) return { score: 0, rankName: "High Card" };

    const ranks = cards.map(c => c.rank ? c.rank.value : 0).filter(r => r > 0);
    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);

    const values = Object.values(counts);
    if (values.includes(4)) return { score: 8, rankName: "Four of a Kind (Quads)" };
    if (values.includes(3)) return { score: 4, rankName: "Three of a Kind (Trips)" };
    
    const pairCount = values.filter(v => v === 2).length;
    if (pairCount >= 2) return { score: 3, rankName: "Two Pair" };
    if (pairCount === 1) return { score: 2, rankName: "One Pair" };

    return { score: 1, rankName: "High Card" };
  }

  static evaluate5CardHand(cards) {
    const isFlush = cards.every(c => c.suit.symbol === cards[0].suit.symbol);
    const ranks = cards.map(c => c.rank.value).sort((a, b) => a - b);

    let isStraight = false;
    if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) {
      isStraight = true;
    } else if (ranks[4] === 14 && ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5) {
      isStraight = true;
    }

    if (isFlush && isStraight) return { score: 9, rankName: "Straight Flush" };

    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const countValues = Object.values(counts).sort((a, b) => b - a);

    if (countValues[0] === 4) return { score: 8, rankName: "Four of a Kind (Quads)" };
    if (countValues[0] === 3 && countValues[1] === 2) return { score: 7, rankName: "Full House" };
    if (isFlush) return { score: 6, rankName: "Flush" };
    if (isStraight) return { score: 5, rankName: "Straight" };
    if (countValues[0] === 3) return { score: 4, rankName: "Three of a Kind (Trips)" };
    if (countValues[0] === 2 && countValues[1] === 2) return { score: 3, rankName: "Two Pair" };
    if (countValues[0] === 2) return { score: 2, rankName: "One Pair" };

    return { score: 1, rankName: "High Card" };
  }

  static checkStraightDrawNeeded(ranks) {
    const rankSet = new Set(ranks);
    const needed = [];

    if (rankSet.has(10) && rankSet.has(11) && rankSet.has(12) && rankSet.has(13)) {
      if (!rankSet.has(14)) needed.push("As");
      if (!rankSet.has(9)) needed.push("9");
    } else if (rankSet.has(9) && rankSet.has(10) && rankSet.has(11) && rankSet.has(12)) {
      if (!rankSet.has(13)) needed.push("King");
      if (!rankSet.has(8)) needed.push("8");
    }

    if (needed.length > 0) {
      return `Butuh Kartu ${needed.join(" atau ")}`;
    }
    return null;
  }

  static getCombinations(arr, k) {
    if (k === 0 || arr.length < k) return [[]];
    if (k === arr.length) return [arr];
    const [first, ...rest] = arr;
    const withFirst = this.getCombinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  static analyzeBoardThreats(communityCards) {
    const threats = [];
    const validComm = (communityCards || []).filter(c => c !== null);
    if (validComm.length < 3) return threats;

    const suitCounts = {};
    const ranks = validComm.map(c => c.rank.value).sort((a, b) => a - b);

    validComm.forEach(c => {
      suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1;
    });

    if (Object.values(suitCounts).some(cnt => cnt >= 3)) {
      threats.push({ safe: false, text: "Potensi Flush lawan di meja" });
    }

    const highRanks = ranks.filter(r => r >= 10);
    if (highRanks.length >= 3) {
      threats.push({ safe: false, text: "Papan sangat rawan Straight lawan" });
    }

    return threats;
  }

  static calculateStrength(handCards, communityCards) {
    const activeHand = (handCards || []).filter(c => c !== null);
    const activeComm = (communityCards || []).filter(c => c !== null);
    if (activeHand.length < 2) return 0;

    const total = [...activeHand, ...activeComm];
    const best = this.getBestHand(total);

    if (activeComm.length === 0) {
      const isPair = activeHand[0].rank.value === activeHand[1].rank.value;
      const high = Math.max(activeHand[0].rank.value, activeHand[1].rank.value);
      if (isPair) return high >= 10 ? 80 : 60;
      return high >= 11 ? 55 : 35;
    }

    if (best.score >= 5) return 85;
    if (best.score >= 3) return 65;
    if (best.score === 2) return 45;
    return 20;
  }
}
