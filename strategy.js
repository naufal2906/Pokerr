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

  static getBettingRecommendation(handCards, communityCards, bigBlind = 1200) {
    const activeHand = handCards.filter(c => c !== null);
    const activeCommunity = communityCards.filter(c => c !== null);

    if (activeHand.length < 2) {
      return { action: "WAIT", amount: 0, reason: "Masukkan 2 kartu tangan untuk analisis strategi." };
    }

    const commCount = activeCommunity.length;

    // === 1. FASE PRE-FLOP (Kartu Komunitas Belum Terbuka) ===
    if (commCount === 0) {
      const tier = this.getPreFlopTier(activeHand);

      switch (tier) {
        case 1:
          return {
            action: "RAISE / RE-RAISE",
            amount: bigBlind * 3,
            reason: "Kartu monster pre-flop. Lakukan raise untuk mengontrol piringan taruhan."
          };
        case 2:
          return {
            action: "RAISE / CALL",
            amount: Math.round(bigBlind * 2.5),
            reason: "Kartu tangan kuat dengan potensi bagus. Lakukan open raise atau call."
          };
        case 3:
          return {
            action: "CALL / LIMP",
            amount: bigBlind,
            reason: "Kartu berpotensi (Set-Mine / Flush Draw). Masuk pot dengan biaya murah."
          };
        default:
          return {
            action: "CHECK / FOLD",
            amount: 0,
            reason: "Kartu pre-flop lemah. Fold jika ada raise lawan."
          };
      }
    }

    // === 2. FASE POST-FLOP (FLOP, TURN, RIVER) ===
    const totalCards = [...activeHand, ...activeCommunity];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const equity = PokerEvaluator.calculateStrength(activeHand, activeCommunity);
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunity);

    const boardRanks = activeCommunity.map(c => c.rank.value);
    const maxBoardRank = boardRanks.length > 0 ? Math.max(...boardRanks) : 0;

    // Cek Trips di Board (3 kartu kembar di meja)
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
          amount: bigBlind,
          reason: `[${phaseName}] Anda memegang Full House, tetapi ada 3 kartu kembar di meja. Waspada Quads lawan.`
        };
      }

      return {
        action: "RAISE / BET",
        amount: bigBlind * 4,
        reason: `[${phaseName}] Kombinasi Terbentuk: ${bestHand.rankName}! Lakukan Value Bet besar.`
      };
    }

    // B. STRONG HAND (Set / Three of a Kind, Two Pair, Straight, Overpair)
    if (bestHand.score >= 3 || isOverpair) {
      if (phaseName === "RIVER" && hasStraightThreat) {
        return {
          action: "CHECK / CALL",
          amount: bigBlind,
          reason: `[${phaseName}] Kombinasi ${isOverpair ? 'Overpair' : bestHand.rankName} kuat, namun ada ancaman Straight lawan di meja.`
        };
      }

      if (hasDangerThreat && phaseName !== "FLOP") {
        return {
          action: "CHECK / CALL",
          amount: bigBlind * 1.5,
          reason: `[${phaseName}] Kombinasi kuat, namun ada ancaman Flush/Straight di meja. Main aman.`
        };
      }

      let textReason = `[${phaseName}] `;
      if (isOverpair) {
        textReason += `Overpair Sangat Kuat! Pair tangan Anda mendominasi kartu tertinggi di meja. Lakukan Value Bet!`;
      } else {
        textReason += `Kombinasi Terbentuk: ${bestHand.rankName}. Lakukan Bet / Raise untuk mengambil pot!`;
      }

      return {
        action: "BET / RAISE",
        amount: Math.round(bigBlind * 2.5),
        reason: textReason
      };
    }

    // C. ANALISIS POTENSI DRAW (Mencari Kartu Tambahan di Flop & Turn)
    if (commCount < 5) {
      // 1. Deteksi Flush Draw
      const suitCounts = {};
      totalCards.forEach(c => suitCounts[c.suit.symbol] = (suitCounts[c.suit.symbol] || 0) + 1);
      const flushSuitSymbol = Object.keys(suitCounts).find(s => suitCounts[s] === 4);

      // 2. Deteksi Straight Draw
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
          amount: bigBlind,
          reason: `[${phaseName}] FLUSH DRAW! Terkumpul 4 kartu ${name} (${flushSuitSymbol}). Butuh 1 kartu simbol ${name} lagi di meja untuk membuat Flush.`
        };
      }

      if (isStraightDraw) {
        return {
          action: "CHECK / CALL",
          amount: bigBlind,
          reason: `[${phaseName}] STRAIGHT DRAW! Terbentuk 4 urutan angka. Butuh 1 kartu penyambung urutan (simbol bebas) untuk membuat Straight.`
        };
      }
    }

    // D. MEDIUM HAND (One Pair Biasa)
    if (bestHand.score === 2) {
      if (hasDangerThreat) {
        return {
          action: "CHECK / FOLD",
          amount: 0,
          reason: `[${phaseName}] Hanya memegang One Pair di papan rawan. Disarankan Check/Fold.`
        };
      }

      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Kombinasi saat ini: One Pair. Lakukan Check atau Call murah.`
      };
    }

    // E. HIGH CARD / DRAW GAGAL
    return {
      action: "CHECK / FOLD",
      amount: 0,
      reason: `[${phaseName}] Tidak ada kombinasi atau potensi draw berarti. Segera Check atau Fold.`
    };
  }
}
