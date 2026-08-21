import { Card, RANKS, SUITS } from './card.js';

export class PokerEvaluator {
  static getValidCards(cards) {
    if (!Array.isArray(cards)) return [];
    return cards.filter(c => c && c.rank && typeof c.rank.value === 'number' && c.suit);
  }

  static getBoardNutHand(communityCards) {
    const comm = this.getValidCards(communityCards);
    if (comm.length < 3) return { hasFlushThreat: false, highestThreat: "-" };

    // Hitung jumlah suit
    const suitCounts = {};
    comm.forEach(c => {
      const s = c.suit.symbol || c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });

    let hasFlushThreat = false;
    let highestThreat = "-";

    Object.keys(suitCounts).forEach(s => {
      if (suitCounts[s] >= 3) {
        hasFlushThreat = true;
        highestThreat = `Flush (${s})`;
      }
    });

    return { hasFlushThreat, highestThreat };
  }

  // ANALISIS ANCAMAN MEJA & COUNTER KARTU TERKUAT (THE NUTS)
  static analyzeBoardThreats(communityCards) {
    const comm = this.getValidCards(communityCards);
    if (comm.length < 3) return [{ text: "Menunggu Flop (Minimal 3 Kartu Komunitas)", safe: true }];

    const threats = [];
    const ranks = comm.map(c => c.rank.value).sort((a, b) => b - a); // Urutkan terbesar ke terkecil
    const maxRank = ranks[0];

    // Hitung Kemunculan Rank (Deteksi Pair di Meja)
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const hasBoardPair = Object.values(rankCounts).some(cnt => cnt >= 2);

    // Hitung Kemunculan Suit
    const suitCounts = {};
    comm.forEach(c => {
      const s = c.suit.symbol || c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    const maxSuitCount = Math.max(...Object.values(suitCounts), 0);

    // 1. ANCAMAN FLUSH
    if (maxSuitCount >= 3) {
      threats.push({
        text: `⚠️ Papan Rawan Flush (${maxSuitCount} Kartu Sejenis)`,
        nutText: "Counter Terkuat: Flush As (Nut Flush)",
        safe: false
      });
    }

    // 2. ANCAMAN FULL HOUSE / QUADS (Jika ada Pair di Meja)
    if (hasBoardPair) {
      threats.push({
        text: "⚠️ Papan Berpasangan (Board Paired)",
        nutText: "Counter Terkuat: Full House / Quads",
        safe: false
      });
    }

    // 3. ANCAMAN HIGH CARDS / OVERCARDS (King / Queen / Ace di Meja)
    if (maxRank >= 12 && !hasBoardPair && maxSuitCount < 3) { // Q = 12, K = 13, A = 14
      const highLabel = maxRank === 14 ? 'As' : maxRank === 13 ? 'King' : 'Queen';
      threats.push({
        text: `⚠️ Ada Kartu Tinggi (${highLabel}) di Meja`,
        nutText: `Counter Terkuat: Set (${highLabel}s) / Two Pair (${ranks[0] > 12 ? 'K-Q' : 'Q-J'})`,
        safe: false
      });
    }

    // Jika Meja Sangat Aman (Tidak ada Flush, tidak ada Pair, tidak ada Straight Draw)
    if (threats.length === 0) {
      threats.push({
        text: "Papan Relatif Aman (Tidak Ada Ancaman Flush/Pair Besar)",
        nutText: `Kartu Terkuat (The Nuts): Set / Three of a Kind (${ranks[0]}s)`,
        safe: true
      });
    }

    return threats;
  }

  // EVALUASI HAND TERBAIK (5 KARTU)
  static getBestHand(allCards) {
    const valid = this.getValidCards(allCards);
    if (valid.length < 2) {
      return { score: 0, rankName: "Pilih Kartu Tangan", cards: [], draws: [] };
    }

    // Hitung Frekuensi Rank
    const rankCounts = {};
    const suitCounts = {};
    valid.forEach(c => {
      rankCounts[c.rank.value] = (rankCounts[c.rank.value] || 0) + 1;
      const s = c.suit.symbol || c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });

    const uniqueRanks = Object.keys(rankCounts).map(Number).sort((a, b) => b - a);
    const sortedCards = [...valid].sort((a, b) => b.rank.value - a.rank.value);

    // Deteksi Flush
    let flushSuit = null;
    Object.keys(suitCounts).forEach(s => {
      if (suitCounts[s] >= 5) flushSuit = s;
    });

    // 1. Full House / Three of a Kind / Pairs
    const trips = uniqueRanks.filter(r => rankCounts[r] === 3);
    const pairs = uniqueRanks.filter(r => rankCounts[r] === 2);

    if (trips.length > 0 && (trips.length >= 2 || pairs.length >= 1)) {
      return { score: 7, rankName: "Full House", cards: sortedCards.slice(0, 5), draws: [] };
    }

    if (flushSuit) {
      const flushCards = sortedCards.filter(c => (c.suit.symbol || c.suit) === flushSuit);
      return { score: 6, rankName: "Flush", cards: flushCards.slice(0, 5), draws: [] };
    }

    if (trips.length > 0) {
      return { score: 4, rankName: "Three of a Kind", cards: sortedCards.slice(0, 5), draws: [] };
    }

    if (pairs.length >= 2) {
      return { score: 3, rankName: "Two Pair", cards: sortedCards.slice(0, 5), draws: [] };
    }

    if (pairs.length === 1) {
      // Deteksi Draw HANYA jika kartu meja kurang dari 5 (Sebelum River)
      const draws = [];
      const commCards = valid.length > 2 ? valid.slice(2) : [];
      
      if (commCards.length > 0 && commCards.length < 5) {
        draws.push({ text: "Two Pair / Three of a Kind", needed: "Butuh Kartu Penguat di Turn/River" });
      }

      return { score: 2, rankName: "One Pair", cards: sortedCards.slice(0, 5), draws };
    }

    return { score: 1, rankName: "High Card", cards: sortedCards.slice(0, 5), draws: [] };
  }

  static evaluateHoleCardsOnly(handCards) {
    const valid = this.getValidCards(handCards);
    if (valid.length < 2) return "Pilih 2 Kartu Tangan";

    const c1 = valid[0];
    const c2 = valid[1];

    if (c1.rank.value === c2.rank.value) {
      return `Pocket Pair (${c1.rank.label}s)`;
    }

    const sameSuit = (c1.suit.symbol || c1.suit) === (c2.suit.symbol || c2.suit);
    const suitText = sameSuit ? "Suited" : "Offsuit";

    if (c1.rank.value >= 10 && c2.rank.value >= 10) {
      return `Konektor Tinggi (${c1.rank.label}-${c2.rank.label} ${suitText})`;
    }

    return `${c1.rank.label}-${c2.rank.label} ${suitText}`;
  }

  static calculateStrength(handCards, communityCards) {
    const validHand = this.getValidCards(handCards);
    if (validHand.length < 2) return 0;

    const total = [...validHand, ...this.getValidCards(communityCards)];
    const best = this.getBestHand(total);

    if (best.score >= 7) return 95;
    if (best.score === 6) return 88;
    if (best.score === 5) return 80;
    if (best.score === 4) return 72;
    if (best.score === 3) return 65;
    if (best.score === 2) return 50;
    return 30;
  }
}
