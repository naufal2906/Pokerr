export class PokerEvaluator {
  static RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  static SUITS = ['♠', '♥', '♦', '♣'];

  // Helper untuk memfilter hanya kartu yang valid
  static getValidCards(cards) {
    if (!Array.isArray(cards)) return [];
    return cards.filter(c => c && c.rank && typeof c.rank.value === 'number' && c.suit);
  }

  // 1. Method Khusus Evaluasi 2 Kartu Tangan Murni (Diperlukan oleh app.js)
  static evaluateHoleCardsOnly(handCards) {
    const valid = this.getValidCards(handCards);
    if (valid.length < 2) return "-";

    const c1 = valid[0];
    const c2 = valid[1];

    if (c1.rank.value === c2.rank.value) {
      return `Pocket Pair (${c1.rank.label}s)`;
    }

    const highCard = c1.rank.value > c2.rank.value ? c1.rank.label : c2.rank.label;
    const isSuited = c1.suit.symbol === c2.suit.symbol;
    const suitedText = isSuited ? "Suited" : "Offsuit";

    return `High Card ${highCard} (${suitedText})`;
  }

  // 2. Evaluasi Kombinasi Kartu Terbaik
  static getBestHand(cards) {
    const validCards = this.getValidCards(cards);

    if (validCards.length === 0) {
      return { score: 0, rankName: "-", cards: [] };
    }

    if (validCards.length < 5) {
      const subResult = this.evaluateSubset(validCards);
      return {
        score: subResult.score,
        rankName: subResult.rankName,
        cards: validCards
      };
    }

    const combinations = this.getCombinations(validCards, 5);
    let bestHand = { score: 0, rankName: "High Card", cards: [] };

    for (const combo of combinations) {
      const evalResult = this.evaluate5CardHand(combo);
      if (evalResult.score > bestHand.score) {
        bestHand = {
          score: evalResult.score,
          rankName: evalResult.rankName,
          cards: combo
        };
      }
    }

    // Deteksi Teks Straight Draw jika kombinasi belum jadi Straight
    const ranks = [...new Set(validCards.map(c => c.rank.value))].sort((a, b) => a - b);
    const drawText = this.checkStraightDrawNeeded(ranks);
    if (drawText && bestHand.score < 5) {
      bestHand.rankName += ` (${drawText})`;
    }

    return bestHand;
  }

  // Evaluasi Subset (< 5 Kartu)
  static evaluateSubset(cards) {
    const validCards = this.getValidCards(cards);
    if (validCards.length === 0) return { score: 0, rankName: "-" };

    const ranks = validCards.map(c => c.rank.value);
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

  // Evaluasi 5 Kartu Murni
  static evaluate5CardHand(cards) {
    const validCards = this.getValidCards(cards);
    if (validCards.length < 5) return { score: 0, rankName: "-" };

    const isFlush = validCards.every(c => c.suit.symbol === validCards[0].suit.symbol);
    const ranks = validCards.map(c => c.rank.value).sort((a, b) => a - b);

    let isStraight = false;
    if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) {
      isStraight = true;
    } else if (ranks[4] === 14 && ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5) {
      isStraight = true; // Wheel Straight (A-2-3-4-5)
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

  // Deteksi Teks Kartu Penyambung Straight (A/9 dll)
  static checkStraightDrawNeeded(ranks) {
    if (!Array.isArray(ranks)) return null;
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

  // Helper Kombinasi
  static getCombinations(arr, k) {
    if (k === 0 || arr.length < k) return [[]];
    if (k === arr.length) return [arr];
    const [first, ...rest] = arr;
    const withFirst = this.getCombinations(rest, k - 1).map(c => [first, ...c]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  // Analisis Ancaman Meja
  static analyzeBoardThreats(communityCards) {
    const threats = [];
    const validComm = this.getValidCards(communityCards);
    if (validComm.length < 3) return threats;

    const suitCounts = {};
    const ranks = validComm.map(c => c.rank.value).sort((a, b) => a - b);

    validComm.forEach(c => {
      suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1;
    });

    if (Object.values(suitCounts).some(cnt => cnt >= 3)) {
      threats.push({ safe: false, text: "Potensi Flush lawan di meja", nutText: "Waspada Kartu Same Suit" });
    }

    const highRanks = ranks.filter(r => r >= 10);
    if (highRanks.length >= 3) {
      threats.push({ safe: false, text: "Papan rawan Straight lawan", nutText: "Waspada Konektor Tinggi" });
    }

    if (threats.length === 0) {
      threats.push({ safe: true, text: "Papan Relatif Aman", nutText: "" });
    }

    return threats;
  }

  // Hitung Estimasi Win Equity Sederhana
  static calculateStrength(handCards, communityCards) {
    const activeHand = this.getValidCards(handCards);
    const activeComm = this.getValidCards(communityCards);
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
