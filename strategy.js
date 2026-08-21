import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  static getPreFlopTier(handCards) {
    const valid = PokerEvaluator.getValidCards(handCards);
    if (valid.length < 2) return 0;

    const c1 = valid[0];
    const c2 = valid[1];
    const high = Math.max(c1.rank.value, c2.rank.value);
    const low = Math.min(c1.rank.value, c2.rank.value);
    const isPair = c1.rank.value === c2.rank.value;
    const isSuited = c1.suit.symbol === c2.suit.symbol;

    if (isPair) {
      if (high >= 11) return 1;
      if (high >= 8) return 2;
      return 3;
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
    const activeHand = PokerEvaluator.getValidCards(handCards);
    const activeCommunity = PokerEvaluator.getValidCards(communityCards);

    if (activeHand.length < 2) {
      return { action: "WAIT", amount: 0, reason: "Masukkan 2 kartu tangan untuk analisis strategi." };
    }

    const commCount = activeCommunity.length;

    // FASE PRE-FLOP
    if (commCount === 0) {
      const tier = this.getPreFlopTier(activeHand);

      switch (tier) {
        case 1:
          return {
            action: "RAISE / RE-RAISE",
            amount: bigBlind * 4,
            reason: "Kartu Monster Pre-Flop. Lakukan Raise besar untuk mendominasi pot."
          };
        case 2:
          return {
            action: "RAISE / CALL",
            amount: bigBlind * 3,
            reason: "Kartu Tangan Kuat. Raise atau Call jika ada taruhan lawan."
          };
        case 3:
          return {
            action: "CALL / LIMP",
            amount: bigBlind,
            reason: "Kartu Potensial. Masuk pot murah untuk mencari Set/Flush Draw."
          };
        default:
          return {
            action: "CHECK / FOLD",
            amount: 0,
            reason: "Kartu Pre-Flop Lemah. Fold jika ada yang Raise."
          };
      }
    }

    // FASE POST-FLOP (FLOP, TURN, RIVER)
    const totalCards = [...activeHand, ...activeCommunity];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunity);
    const draws = bestHand.draws;

    let phaseName = commCount < 3 ? "FLOP" : commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";

    // 1. UTAMAKAN DETEKSI POTENSI DRAW (Kurang 1 Kartu) pada Flop & Turn
    if (commCount < 5 && draws && draws.length > 0) {
      const drawInfo = draws.map(d => d.needed).join(" DAN ");
      
      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] POTENSI DRAW TERDETEKSI! ${drawInfo}. Sangat disarankan Check / Call taruhan murah untuk melihat kartu berikutnya!`
      };
    }

    // 2. KOMBINASI JADI (FLUSH, STRAIGHT, FULL HOUSE, DLL)
    if (bestHand.score >= 5) {
      return {
        action: "RAISE / ALL-IN",
        amount: bigBlind * 5,
        reason: `[${phaseName}] Kombinasi Terbentuk: ${bestHand.rankName}! Lakukan Value Bet / Raise besar!`
      };
    }

    // 3. TWO PAIR / THREE OF A KIND
    if (bestHand.score >= 3) {
      return {
        action: "BET / RAISE",
        amount: BigBlind * 3,
        reason: `[${phaseName}] Kombinasi Kuat: ${bestHand.rankName}. Pasang Bet 3x BB.`
      };
    }

    // 4. ONE PAIR
    if (bestHand.score === 2) {
      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Terbentuk One Pair. Pasang bet kecil atau Check/Call.`
      };
    }

    // 5. HIGH CARD
    return {
      action: "CHECK / FOLD",
      amount: 0,
      reason: `[${phaseName}] Belum ada kombinasi atau potensi Draw. Check atau Fold jika lawan bet.`
    };
  }
}
