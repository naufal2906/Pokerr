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

  // Evaluasi khusus kombinasi yang sudah terbentuk saat ini (Made Hand)
  static evaluateMadeHand(allCards) {
    if (allCards.length === 0) return "-";
    if (allCards.length < 5) {
      // Jika kurang dari 5 kartu, cek Pair/Three of a Kind sederhana
      const counts = {};
      allCards.forEach(c => counts[c.rank.label] = (counts[c.rank.label] || 0) + 1);
      const pairs = Object.entries(counts).filter(([_, count]) => count === 2);
      const trips = Object.entries(counts).filter(([_, count]) => count === 3);

      if (trips.length > 0) return `Three of a Kind (${trips[0][0]})`;
      if (pairs.length === 2) return `Two Pair (${pairs[0][0]} & ${pairs[1][0]})`;
      if (pairs.length === 1) return `One Pair (${pairs[0][0]})`;
      return `High Card`;
    }
    return this.getBestHand(allCards).rankName;
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
    if (allCards.length < 5) return { rankName: 'Butuh minimal 5 kartu', cards: [] };
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

  // Menghitung potensi/perkiraan kombinasi yang bisa terbentuk (Draws & Out Prospects)
  static detectPotentialDraws(handCards, communityCards) {
    const total = [...handCards, ...communityCards];
    if (total.length === 0) return ["Masukkan Kartu Tangan"];

    const potentials = [];

    // Cek Potensi Flush (4 kartu lambang sama)
    const suitCounts = {};
    total.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);
    Object.entries(suitCounts).forEach(([suit, count]) => {
      if (count === 4) potentials.push(`♠♥♣♦ Flush Draw (Butuh 1 kartu ${suit} lagi)`);
      if (count === 3 && total.length < 5) potentials.push(`♠♥♣♦ Backdoor Flush Potential (${suit})`);
    });

    // Cek Potensi Pair / Sets / Full House
    const rankCounts = {};
    total.forEach(c => rankCounts[c.rank.label] = (rankCounts[c.rank.label] || 0) + 1);
    
    let pairCount = 0;
    let tripCount = 0;
    Object.values(rankCounts).forEach(cnt => {
      if (cnt === 2) pairCount++;
      if (cnt === 3) tripCount++;
    });

    if (tripCount > 0) potentials.push("🔥 Potensi Full House / Four of a Kind");
    else if (pairCount >= 2) potentials.push("⚡ Potensi Full House");
    else if (pairCount === 1) potentials.push("📈 Potensi Three of a Kind / Two Pair");

    // Cek Potensi Straight
    const uniqueValues = [...new Set(total.map(c => c.rank.value))].sort((a,b) => a - b);
    if (uniqueValues.length >= 4) {
      for (let i = 0; i <= uniqueValues.length - 4; i++) {
        if (uniqueValues[i+3] - uniqueValues[i] <= 4) {
          potentials.push("🎯 Straight Draw (Potensi Straight)");
          break;
        }
      }
    }

    if (potentials.length === 0) potentials.push("Tidak ada potensi draw khusus (High Card / Pair)");

    return potentials;
  }

  // Kalkulasi persentase kekuatan kartu berdasarkan kombinasi aktif & potensi
  static calculateStrength(handCards, communityCards) {
    if (handCards.length === 0) return 0;
    const total = [...handCards, ...communityCards];

    if (total.length < 5) {
      let equity = 30;
      if (handCards.length === 2 && handCards[0].rank.value === handCards[1].rank.value) equity += 40;
      if (communityCards.length > 0) {
        const made = this.evaluateMadeHand(total);
        if (made.includes('One Pair')) equity += 25;
        if (made.includes('Two Pair')) equity += 45;
        if (made.includes('Three of a Kind')) equity += 55;
      }
      return Math.min(equity, 100);
    } else {
      const best = this.getBestHand(total);
      return Math.min(Math.round((best.score / 9) * 100), 100);
    }
  }
}
