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
      if (low >= 10) return isSuited ? 1 : 2;
      if (isSuited) return 3;
      return 4;
    }

    if (high === 13 && low >= 10) return isSuited ? 2 : 3;
    if (isSuited && high - low === 1 && high >= 9) return 3;

    return 4;
  }

  static getBettingRecommendation(handCards, communityCards, bigBlind = 1200) {
    const activeHand = handCards.filter(c => c !== null);
    const activeCommunity = communityCards.filter(c => c !== null);

    if (activeHand.length < 2) {
      return { action: "WAIT", amount: 0, reason: "Masukkan 2 kartu tangan untuk analisis." };
    }

    const commCount = activeCommunity.length;

    // === 1. PASE PRE-FLOP ===
    if (commCount === 0) {
      const tier = this.getPreFlopTier(activeHand);

      switch (tier) {
        case 1:
          return {
            action: "RAISE / RE-RAISE",
            amount: bigBlind * 3,
            reason: "Kartu monster pre-flop. Lakukan raise 2.5x–3x Big Blind untuk membendung limper."
          };
        case 2:
          return {
            action: "RAISE / CALL",
            amount: Math.round(bigBlind * 2.5),
            reason: "Kartu kuat. Open raise jika belum ada aksi, atau Call jika ada open raise."
          };
        case 3:
          return {
            action: "CALL / LIMP",
            amount: bigBlind,
            reason: "Kartu bernilai set-mine/draw. Masuk pot dengan biaya murah."
          };
        default:
          return {
            action: "CHECK / FOLD",
            amount: 0,
            reason: "Kartu pre-flop terlalu lemah. Fold jika ada raise dari lawan."
          };
      }
    }

    // === 2. PASE POST-FLOP (FLOP, TURN, RIVER) ===
    const totalCards = [...activeHand, ...activeCommunity];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const equity = PokerEvaluator.calculateStrength(activeHand, activeCommunity);
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunity);
    
    // Perbaikan: Cek spesifik apakah ada ancaman Flush, Full House, atau Straight Nyata
    const hasStraightThreat = threats.some(t => t.text.includes("Straight"));
    const hasDangerThreat = threats.some(t => !t.safe) || hasStraightThreat;

    let phaseName = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";

    // Kategori Kombinasi Kartu
    const isMonster = bestHand.score >= 6; // Flush, Full House, 4-of-a-kind
    const isStrong = bestHand.score >= 3;  // Two Pair, Three of a Kind, Straight

    // A. Monster Hand
    if (isMonster) {
      return {
        action: "RAISE / BET",
        amount: bigBlind * 4,
        reason: `[${phaseName}] Anda membuat ${bestHand.rankName}! Lakukan Value Bet besar untuk memaksimalkan pot.`
      };
    }

    // B. Strong Hand (Three of a Kind / Two Pair / Straight)
    if (isStrong) {
      // PERBAIKAN KHUSUS RIVER: Jika memegang Set/Trips tapi papan terkoneksi Straight
      if (phaseName === "RIVER" && hasStraightThreat) {
        return {
          action: "CHECK / CALL",
          amount: bigBlind,
          reason: `[${phaseName}] Anda punya ${bestHand.rankName}, namun ada potensi Straight lawan (K+J) di meja. Sebaiknya Check / Call taruhan kecil saja.`
        };
      }

      if (hasDangerThreat && phaseName !== "FLOP") {
        return {
          action: "CHECK / CALL",
          amount: bigBlind * 1.5,
          reason: `[${phaseName}] Anda punya ${bestHand.rankName}, tetapi ada potensi Flush/Straight di meja. Bermain hati-hati dengan Check/Call.`
        };
      }

      return {
        action: "BET / RAISE",
        amount: Math.round(bigBlind * 2.5),
        reason: `[${phaseName}] ${bestHand.rankName} tergolong kuat. Lakukan Bet ukuran 1/2 s.d 2/3 Pot.`
      };
    }

    // C. Medium Hand (One Pair)
    if (bestHand.score === 2) {
      if (hasDangerThreat) {
        return {
          action: "CHECK / FOLD",
          amount: 0,
          reason: `[${phaseName}] Hanya memegang One Pair dengan papan berbahaya. Check/Fold jika lawan memasang bet.`
        };
      }
      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Memegang One Pair. Lebih aman Check/Call bet kecil.`
      };
    }

    // D. High Card / Drawing
    if (equity >= 40 && commCount < 5) {
      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Memiliki potensi Flush/Straight Draw. Coba amati gratisan (Check) atau Call murah.`
      };
    }

    return {
      action: "CHECK / FOLD",
      amount: 0,
      reason: `[${phaseName}] Tidak memiliki kombinasi berarti. Segera Check atau Fold.`
    };
  }
}
