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

  // Evaluasi khusus 5 Kartu
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

  // Cari Kombinasi 5 Kartu Terbaik dari sekumpulan kartu
  static getBestHand(cards) {
    if (cards.length < 5) {
      if (cards.length === 0) return { rankName: '-', cards: [] };
      // Evaluasi Parsial untuk kartu < 5
      const counts = {};
      cards.forEach(c => counts[c.rank.label] = (counts[c.rank.label] || 0) + 1);
      const pairs = Object.entries(counts).filter(([_, count]) => count === 2);
      const trips = Object.entries(counts).filter(([_, count]) => count === 3);

      if (trips.length > 0) return { rankName: `Three of a Kind (${trips[0][0]})`, cards };
      if (pairs.length === 2) return { rankName: `Two Pair (${pairs[0][0]} & ${pairs[1][0]})`, cards };
      if (pairs.length === 1) return { rankName: `One Pair (${pairs[0][0]})`, cards };
      return { rankName: 'High Card', cards };
    }

    const combinations = this.getCombinations(cards, 5);
    let bestHand = null;

    for (const combo of combinations) {
      const evalResult = this.evaluate5CardHand(combo);
      if (!bestHand || evalResult.score > bestHand.score) {
        bestHand = evalResult;
      }
    }
    return bestHand;
  }

  // Mengevaluasi Khusus Kartu Komunitas Murni (Board Only)
  static evaluateBoardOnly(communityCards) {
    if (communityCards.length === 0) return "Belum ada kartu meja";
    return this.getBestHand(communityCards).rankName;
  }

  // Mengecek Potensi Ancaman Kartu Meja Bagi Pemain Lain
  static analyzeBoardThreats(communityCards) {
    if (communityCards.length < 3) return [{ text: "Menunggu Flop (min 3 kartu meja)", safe: true }];

    const threats = [];

    // 1. Cek Potensi Flush di Meja
    const suitCounts = {};
    communityCards.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);
    
    Object.entries(suitCounts).forEach(([suit, count]) => {
      if (count >= 5) {
        threats.push({ text: `⚠️ WARNING: Meja sudah membentuk FLUSH (${suit})!`, safe: false });
      } else if (count === 4) {
        threats.push({ text: `⚠️ Ancaman Flush Tinggi! Ada 4 kartu ${suit} di meja.`, safe: false });
      } else if (count === 3) {
        threats.push({ text: `⚡ Potensi Flush: Ada 3 kartu ${suit} di meja.`, safe: true });
      }
    });

    // 2. Cek Potensi Pair / Full House di Meja
    const rankCounts = {};
    communityCards.forEach(c => rankCounts[c.rank.label] = (rankCounts[c.rank.label] || 0) + 1);
    
    let pairs = 0, trips = 0;
    Object.values(rankCounts).forEach(cnt => {
      if (cnt === 2) pairs++;
      if (cnt === 3) trips++;
    });

    if (trips > 0 || pairs >= 2) {
      threats.push({ text: `⚠️ Ancaman Full House / Four of a Kind di meja!`, safe: false });
    } else if (pairs === 1) {
      threats.push({ text: `⚡ Ada Pair di meja (Potensi Trips/Full House lawan).`, safe: true });
    }

    // 3. Cek Potensi Straight di Meja
    const values = [...new Set(communityCards.map(c => c.rank.value))].sort((a,b) => a - b);
    if (values.length >= 3) {
      let straightPotential = false;
      for (let i = 0; i <= values.length - 3; i++) {
        if (values[i+2] - values[i] <= 4) {
          straightPotential = true;
          break;
        }
      }
      if (straightPotential) {
        threats.push({ text: `🎯 Ancaman Straight: Kartu meja saling bersambungan.`, safe: true });
      }
    }

    if (threats.length === 0) {
      threats.push({ text: "✅ Meja relatif aman (Dry Board / Tidak ada koneksi kuat).", safe: true });
    }

    return threats;
  }

  // Kalkulasi Win Equity Kartu Tangan Anda
  static calculateStrength(handCards, communityCards) {
    if (handCards.length === 0) return 0;
    const total = [...handCards, ...communityCards];

    if (total.length < 5) {
      let equity = 30;
      if (handCards.length === 2 && handCards[0].rank.value === handCards[1].rank.value) equity += 35;
      if (communityCards.length > 0) {
        const myHand = this.getBestHand(total).rankName;
        if (myHand.includes('One Pair')) equity += 20;
        if (myHand.includes('Two Pair')) equity += 40;
        if (myHand.includes('Three of a Kind')) equity += 55;
      }
      return Math.min(equity, 100);
    } else {
      const best = this.getBestHand(total);
      return Math.min(Math.round((best.score / 9) * 100), 100);
    }
  }
}
