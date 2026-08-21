export class PokerEvaluator {
  static RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  static SUITS = ['♠', '♥', '♦', '♣'];

  static getValidCards(cards) {
    if (!Array.isArray(cards)) return [];
    return cards.filter(c => c && c.rank && typeof c.rank.value === 'number' && c.suit);
  }

  // Evaluasi 2 Kartu Tangan
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
    return `High Card ${highCard} (${isSuited ? "Suited" : "Offsuit"})`;
  }

  // Deteksi Kartu Terkuat Lawan di Board (The Nuts Counter)
  static getBoardNutHand(communityCards) {
    const validComm = this.getValidCards(communityCards);
    if (validComm.length < 3) return { hasFlushThreat: false, highestThreat: "-", nutCards: "-" };

    const suitCounts = {};
    validComm.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);

    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 3);
    const suitNames = { '♣': 'Keriting', '♠': 'Sekop', '♥': 'Hati', '♦': 'Diamond' };

    if (flushSuit) {
      const sName = suitNames[flushSuit] || flushSuit;
      return {
        hasFlushThreat: true,
        highestThreat: `Flush (${sName})`,
        nutCards: `Lawan memegang 2 kartu ${sName} (Terkuat: A${flushSuit} K${flushSuit})`
      };
    }

    return {
      hasFlushThreat: false,
      highestThreat: "Straight / Set",
      nutCards: "Kombinasi Murni Kartu Meja"
    };
  }

  // Deteksi Potensi Draw (Kurang 1 Kartu)
  static detectDraws(cards) {
    const validCards = this.getValidCards(cards);
    if (validCards.length < 3) return null;

    const suitNames = { '♣': 'Keriting', '♠': 'Sekop', '♥': 'Hati', '♦': 'Diamond' };
    const labelMap = { 14: 'As', 13: 'King', 12: 'Queen', 11: 'Jack', 10: '10', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };

    const straightWindows = [
      { window: [14, 2, 3, 4, 5], isRoyal: false },
      { window: [2, 3, 4, 5, 6], isRoyal: false },
      { window: [3, 4, 5, 6, 7], isRoyal: false },
      { window: [4, 5, 6, 7, 8], isRoyal: false },
      { window: [5, 6, 7, 8, 9], isRoyal: false },
      { window: [6, 7, 8, 9, 10], isRoyal: false },
      { window: [7, 8, 9, 10, 11], isRoyal: false },
      { window: [8, 9, 10, 11, 12], isRoyal: false },
      { window: [9, 10, 11, 12, 13], isRoyal: false },
      { window: [10, 11, 12, 13, 14], isRoyal: true }
    ];

    const draws = [];

    // 1. Royal Flush & Straight Flush Draw
    const cardsBySuit = {};
    validCards.forEach(c => {
      const symbol = c.suit.symbol;
      if (!cardsBySuit[symbol]) cardsBySuit[symbol] = [];
      cardsBySuit[symbol].push(c);
    });

    for (const [symbol, sCards] of Object.entries(cardsBySuit)) {
      if (sCards.length >= 4) {
        const sRankSet = new Set(sCards.map(c => c.rank.value));
        for (const sw of straightWindows) {
          const matchRanks = sw.window.filter(r => sRankSet.has(r));
          if (matchRanks.length === 4) {
            const missingRank = sw.window.find(r => !sRankSet.has(r));
            const isRoyal = sw.isRoyal;
            const drawType = isRoyal ? "ROYAL FLUSH DRAW" : "STRAIGHT FLUSH DRAW";
            const suitText = suitNames[symbol] || symbol;

            draws.push({
              type: isRoyal ? 'ROYAL_FLUSH_DRAW' : 'STRAIGHT_FLUSH_DRAW',
              text: drawType,
              needed: `KRUSIAL! Butuh Khusus Kartu ${labelMap[missingRank]} ${suitText}`
            });
            return draws;
          }
        }
      }
    }

    const counts = {};
    validCards.forEach(c => counts[c.rank.value] = (counts[c.rank.value] || 0) + 1);
    const pairs = Object.keys(counts).filter(r => counts[r] === 2);
    const trips = Object.keys(counts).filter(r => counts[r] === 3);

    // 2. Four of a Kind Draw
    if (trips.length > 0) {
      draws.push({
        type: 'QUADS_DRAW',
        text: 'Four of a Kind Draw',
        needed: `Butuh 1 Kartu ${labelMap[trips[0]]} lagi (Simbol Bebas)`
      });
    }

    // 3. Full House Draw
    if (pairs.length >= 2 && trips.length === 0) {
      const pairNames = pairs.map(r => labelMap[r]).join(" / ");
      draws.push({
        type: 'FULL_HOUSE_DRAW',
        text: 'Full House Draw',
        needed: `Butuh 1 Kartu ${pairNames} (Simbol Bebas)`
      });
    }

    // 4. Flush Draw
    const suitCounts = {};
    validCards.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);
    for (const [suitSymbol, count] of Object.entries(suitCounts)) {
      if (count === 4) {
        draws.push({
          type: 'FLUSH_DRAW',
          text: `Flush Draw (${suitNames[suitSymbol] || suitSymbol})`,
          needed: `Butuh 1 Kartu ${suitNames[suitSymbol] || suitSymbol} (Angka Bebas)`
        });
      }
    }

    // 5. Straight Draw
    const rankSet = new Set(validCards.map(c => c.rank.value));
    for (const sw of straightWindows) {
      const matchRanks = sw.window.filter(r => rankSet.has(r));
      if (matchRanks.length === 4) {
        const missingRank = sw.window.find(r => !rankSet.has(r));
        draws.push({
          type: 'STRAIGHT_DRAW',
          text: 'Straight Draw',
          missingRankValue: missingRank,
          needed: `Butuh Kartu ${labelMap[missingRank]} (Simbol Bebas)`
        });
        break; 
      }
    }

    // 6. Three of a Kind Draw
    if (pairs.length === 1 && trips.length === 0 && draws.length === 0) {
      draws.push({
        type: 'TRIPS_DRAW',
        text: 'Three of a Kind Draw',
        needed: `Butuh 1 Kartu ${labelMap[pairs[0]]} lagi (Simbol Bebas)`
      });
    }

    return draws.length > 0 ? draws : null;
  }

  // Evaluasi Kombinasi Terbaik
  static getBestHand(cards) {
    const validCards = this.getValidCards(cards);
    if (validCards.length === 0) return { score: 0, rankName: "-", cards: [] };

    if (validCards.length < 5) {
      const subResult = this.evaluateSubset(validCards);
      const draws = this.detectDraws(validCards);
      let rankText = subResult.rankName;
      if (draws && draws.length > 0) {
        rankText += ` [${draws.map(d => d.needed).join(' & ')}]`;
      }
      return { score: subResult.score, rankName: rankText, cards: validCards, draws: draws };
    }

    const combinations = this.getCombinations(validCards, 5);
    let bestHand = { score: 0, rankName: "High Card", cards: [] };

    for (const combo of combinations) {
      const evalResult = this.evaluate5CardHand(combo);
      if (evalResult.score > bestHand.score) {
        bestHand = { score: evalResult.score, rankName: evalResult.rankName, cards: combo };
      }
    }

    const draws = this.detectDraws(validCards);
    if (draws && bestHand.score < 5) {
      bestHand.rankName += ` [${draws.map(d => d.needed).join(' & ')}]`;
    }
    bestHand.draws = draws;

    return bestHand;
  }

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

  static evaluate5CardHand(cards) {
    const validCards = this.getValidCards(cards);
    if (validCards.length < 5) return { score: 0, rankName: "-" };

    const isFlush = validCards.every(c => c.suit.symbol === validCards[0].suit.symbol);
    const ranks = validCards.map(c => c.rank.value).sort((a, b) => a - b);

    let isStraight = false;
    if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) {
      isStraight = true;
    } else if (ranks[4] === 14 && ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5) {
      isStraight = true;
    }

    if (isFlush && isStraight) {
      if (ranks[0] === 10 && ranks[4] === 14) return { score: 10, rankName: "Royal Flush" };
      return { score: 9, rankName: "Straight Flush" };
    }

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
    const validComm = this.getValidCards(communityCards);
    if (validComm.length < 3) return threats;

    const suitCounts = {};
    const ranks = validComm.map(c => c.rank.value).sort((a, b) => a - b);

    validComm.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);

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

    if (best.draws && best.draws.length > 0) {
      const isRoyalOrSF = best.draws.some(d => d.type === 'ROYAL_FLUSH_DRAW' || d.type === 'STRAIGHT_FLUSH_DRAW');
      const isQuadsOrFH = best.draws.some(d => d.type === 'QUADS_DRAW' || d.type === 'FULL_HOUSE_DRAW');
      if (isRoyalOrSF) return 75;
      if (isQuadsOrFH) return 65;
      return 50;
    }

    if (best.score >= 5) return 85;
    if (best.score >= 3) return 65;
    if (best.score === 2) return 45;
    return 25;
  }
}
