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

  static getBestHand(cards) {
    if (cards.length < 5) {
      if (cards.length === 0) return { rankName: '-', cards: [] };
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

  // Menghitung Kartu Terkuat (The Nuts) yang meng-counter kartu meja
  static analyzeBoardThreats(communityCards) {
    if (communityCards.length < 3) {
      return [{ text: "Masukkan minimal 3 Kartu Komunitas untuk menganalisis potensi.", safe: true, nutText: "" }];
    }

    const threats = [];

    // 1. Analisis Flush & Nut Flush Counter
    const suitCounts = {};
    communityCards.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);

    Object.entries(suitCounts).forEach(([suitSymbol, count]) => {
      if (count >= 3) {
        // Cari kartu bernilai tertinggi yang BELUM ada di meja untuk simbol tersebut
        const usedRanks = communityCards
          .filter(c => c.suit.symbol === suitSymbol)
          .map(c => c.rank.value);

        let nutRanks = [];
        if (!usedRanks.includes(14)) nutRanks.push('A');
        if (!usedRanks.includes(13)) nutRanks.push('K');
        if (!usedRanks.includes(12) && nutRanks.length < 2) nutRanks.push('Q');
        if (!usedRanks.includes(11) && nutRanks.length < 2) nutRanks.push('J');

        const needCount = count >= 5 ? 1 : 5 - count;
        const statusText = count >= 5 
          ? `⚠️ Meja SUDAH Flush (${suitSymbol})!` 
          : `⚡ Potensi Flush Lawan: Ada ${count} kartu ${suitSymbol} di meja.`;

        threats.push({
          text: statusText,
          safe: count < 4,
          nutText: `👉 Nut Flush terkuat butuh kartu pegangan: [${nutRanks.slice(0, needCount).join(' + ')}] (${suitSymbol})`
        });
      }
    });

    // 2. Analisis Straight & Nut Straight Counter
    const boardValues = [...new Set(communityCards.map(c => c.rank.value))].sort((a,b) => a - b);
    let straightNutText = "";

    // Cek kemungkinan 5 urutan angka
    for (let highVal = 14; highVal >= 5; highVal--) {
      const targetSeq = [highVal, highVal-1, highVal-2, highVal-3, highVal-4];
      const matchCount = targetSeq.filter(v => boardValues.includes(v)).length;

      if (matchCount >= 3) {
        const missingVals = targetSeq.filter(v => !boardValues.includes(v));
        const valToLabel = v => v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : v.toString();
        
        straightNutText = `👉 Nut Straight terkuat butuh kartu pegangan: [${missingVals.map(valToLabel).join(' + ')}]`;
        
        threats.push({
          text: `🎯 Ancaman Straight: Ada urutan kartu bersambung di meja.`,
          safe: matchCount < 4,
          nutText: straightNutText
        });
        break; // Tampilkan hanya yang paling tinggi (Nut Straight)
      }
    }

    // 3. Analisis Pair / Full House di Meja
    const rankCounts = {};
    communityCards.forEach(c => rankCounts[c.rank.label] = (rankCounts[c.rank.label] || 0) + 1);
    
    let pairs = [], trips = [];
    Object.entries(rankCounts).forEach(([label, cnt]) => {
      if (cnt === 2) pairs.push(label);
      if (cnt === 3) trips.push(label);
    });

    if (trips.length > 0 || pairs.length >= 2) {
      threats.push({
        text: `⚠️ Ancaman Full House / Four of a Kind di meja!`,
        safe: false,
        nutText: `👉 Kartu Counter Terkuat: Pemain yang memegang Pair kartu tertinggi di meja.`
      });
    } else if (pairs.length === 1) {
      threats.push({
        text: `⚡ Ada Pair (${pairs[0]}) di meja.`,
        safe: true,
        nutText: `👉 Counter Terkuat lawan: Pegang kartu [${pairs[0]}] untuk Three of a Kind / Full House.`
      });
    }

    if (threats.length === 0) {
      threats.push({
        text: "✅ Meja aman (Dry Board / Tidak ada potensi Flush/Straight tinggi).",
        safe: true,
        nutText: ""
      });
    }

    return threats;
  }

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
