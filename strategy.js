import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  static getPreFlopTier(handCards) {
    if (handCards.length < 2) return 0;

    const c1 = handCards[0];
    const c2 = handCards[1];
    const high = Math.max(c1.rank.value, c2.rank.value);
    const low = Math.min(c1.rank.value, c2.rank.value);
    const isPair = c1.rank.value === c2.rank.value;
    const isSuited = c1.suit.symbol === c2.suit.symbol;

    if (isPair) {
      if (high >= 11) return 1; // Pocket Premium (AA, KK, QQ, JJ)
      if (high >= 8) return 2;  // Pocket Medium (1010, 99, 88)
      return 3;                 // Pocket Small (77-22)
    }

    if (high === 14) {
      if (low === 13) return isSuited ? 1 : 2;
      if (low >= 10) return isSuited ? 2 : 3;
      if (isSuited) return 3;
      return 4;
    }

    if (isSuited && (high - low === 1) && high >= 8) return 2;
    if (high === 13 && low >= 10) return isSuited ? 2 : 3;

    return 4;
  }

  static getBettingRecommendation(handCards, communityCards, bigBlind = 600) {
    const activeHand = handCards.filter(c => c !== null);
    const activeCommunity = communityCards.filter(c => c !== null);

    if (activeHand.length < 2) {
      return { action: "WAIT", amount: 0, reason: "Masukkan 2 kartu tangan untuk analisis strategi." };
    }

    const commCount = activeCommunity.length;

    // === 1. FASE PRE-FLOP ===
    if (commCount === 0) {
      const tier = this.getPreFlopTier(activeHand);

      switch (tier) {
        case 1:
          return {
            action: "RAISE / RE-RAISE",
            amount: 2400, // Standar Raise Kartu Bagus (4x Big Blind)
            reason: "Kartu Monster Pre-Flop. Lakukan Raise 2.400 - 3.000 untuk mendominasi pot."
          };
        case 2:
          return {
            action: "RAISE / CALL",
            amount: 1800, // Open Raise sedang (3x Big Blind)
            reason: "Kartu Tangan Kuat. Raise 1.800 atau Call jika ada taruhan lawan."
          };
        case 3:
          return {
            action: "CALL / LIMP",
            amount: 600, // Minimal Call (1x Big Blind)
            reason: "Kartu Potensial. Masuk pot murah 600 chips untuk mencari Set/Flush Draw."
          };
        default:
          return {
            action: "CHECK / FOLD",
            amount: 0,
            reason: "Kartu Pre-Flop Lemah. Fold jika ada yang Raise."
          };
      }
    }

    // === 2. FASE POST-FLOP (FLOP, TURN, RIVER) ===
    const totalCards = [...activeHand, ...activeCommunity];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunity);

    const boardRanks = activeCommunity.map(c => c.rank.value);
    const maxBoardRank = boardRanks.length > 0 ? Math.max(...boardRanks) : 0;

    const commCounts = {};
    activeCommunity.forEach(c => commCounts[c.rank.value] = (commCounts[c.rank.value] || 0) + 1);
    const hasTripsOnBoard = Object.values(commCounts).some(count => count >= 3);

    const hasStraightThreat = threats.some(t => t.text.includes("Straight"));
    const hasDangerThreat = threats.some(t => !t.safe) || hasStraightThreat;

    let phaseName = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";

    const isPocketPair = activeHand[0].rank.value === activeHand[1].rank.value;
    const isOverpair = isPocketPair && activeHand[0].rank.value > maxBoardRank;

    // A. MONSTER HAND (Full House, Quads, Flush, Straight Flush)
    if (bestHand.score >= 6) {
      if (hasTripsOnBoard && bestHand.score === 7) {
        return {
          action: "CHECK / CALL",
          amount: 600,
          reason: `[${phaseName}] Anda memegang Full House, tapi ada 3 kartu kembar di meja. Waspada Quads lawan.`
        };
      }

      return {
        action: "RAISE / ALL-IN",
        amount: 3000, // Di atas 3000 mendorong ke All-In / Value Bet maksimal
        reason: `[${phaseName}] Kombinasi Monster (${bestHand.rankName})! Raise besar 3.000+ atau All-In.`
      };
    }

    // B. STRONG HAND (Set, Two Pair, Straight, Overpair)
    if (bestHand.score >= 3 || isOverpair) {
      if (phaseName === "RIVER" && hasStraightThreat) {
        return {
          action: "CHECK / CALL",
          amount: 600,
          reason: `[${phaseName}] Kombinasi ${isOverpair ? 'Overpair' : bestHand.rankName} kuat, namun ada ancaman Straight di meja.`
        };
      }

      if (hasDangerThreat && phaseName !== "FLOP") {
        return {
          action: "CHECK / CALL",
          amount: 1200,
          reason: `[${phaseName}] Kombinasi kuat, namun ada ancaman Flush/Straight. Main aman Check/Call.`
        };
      }

      return {
        action: "BET / RAISE",
        amount: 2400, // Raise di rentang 2.400
        reason: `[${phaseName}] ${isOverpair ? 'Overpair Sangat Kuat!' : 'Kombinasi Terbentuk: ' + bestHand.rankName}. Lakukan Value Bet 2.400 untuk menguras chip lawan!`
      };
    }

    // C. ANALISIS POTENSI DRAW (Mencari Kartu Tambahan di Flop & Turn)
    if (commCount < 5) {
      const suitCounts = {};
      totalCards.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);
      const flushSuitSymbol = Object.keys(suitCounts).find(s => suitCounts[s] === 4);

      const uniqueRanks = [...new Set(totalCards.map(c => c.rank.value))].sort((a,b) => a - b);
      let isStraightDraw = false;
      
      for (let i = 0; i < uniqueRanks.length - 3; i++) {
        if (uniqueRanks[i+3] - uniqueRanks[i] <= 4) {
          isStraightDraw = true;
          break;
        }
      }

      if (flushSuitSymbol) {
        const suitNames = { '♣': 'Keriting', '♠': 'Sekop', '♥': 'Hati', '♦': 'Diamond' };
        const name = suitNames[flushSuitSymbol] || flushSuitSymbol;
        return {
          action: "CHECK / CALL",
          amount: 600,
          reason: `[${phaseName}] FLUSH DRAW! Terkumpul 4 kartu ${name} (${flushSuitSymbol}). Butuh 1 kartu ${name} lagi untuk membuat Flush.`
        };
      }

      if (isStraightDraw) {
        return {
          action: "CHECK / CALL",
          amount: 600,
          reason: `[${phaseName}] STRAIGHT DRAW! Terbentuk 4 urutan angka. Butuh 1 kartu penyambung (simbol bebas) untuk Straight.`
        };
      }
    }

    // D. MEDIUM HAND (One Pair Biasa)
    if (bestHand.score === 2) {
      if (hasDangerThreat) {
        return {
          action: "CHECK / FOLD",
          amount: 0,
          reason: `[${phaseName}] Hanya One Pair di meja rawan. Check/Fold jika lawan bet besar.`
        };
      }

      return {
        action: "CHECK / CALL",
        amount: 600,
        reason: `[${phaseName}] Memegang One Pair. Pasang bet kecil 600 atau Check/Call.`
      };
    }

    // E. HIGH CARD / DRAW GAGAL
    return {
      action: "CHECK / FOLD",
      amount: 0,
      reason: `[${phaseName}] Kartu tidak berkembang. Check atau Fold.`
    };
  }
}
