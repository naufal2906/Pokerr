import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  // Mengukur kekuatan pre-flop berdasarkan standar Chen Formula / Grouping Sklansky
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
      return 3;                 // Pocket Small (77 down to 22)
    }

    if (high === 14) { // Memegang As
      if (low >= 10) return isSuited ? 1 : 2; // AK, AQ, AJ, AT
      if (isSuited) return 3;                // Axs (Suited Ace)
      return 4;                              // Offsuit Ace biasa
    }

    if (high === 13 && low >= 10) return isSuited ? 2 : 3; // KQ, KJ, KT
    if (isSuited && high - low === 1 && high >= 9) return 3; // Suited Connectors tinggi (J10s, 109s)

    return 4; // Trash / Marginal Hand
  }

  // Rekomendasi Betting untuk Setiap Fase Permainan
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
        case 1: // Kartu Super Kuat (AA, KK, QQ, AKs)
          return {
            action: "RAISE / RE-RAISE",
            amount: bigBlind * 3, // 3.600
            reason: "Kartu monster pre-flop. Lakukan raise 2.5x–3x Big Blind untuk membendung limper dan membangun pot."
          };
        case 2: // Kartu Bagus (JJ, TT, AQ, KQs)
          return {
            action: "RAISE / CALL",
            amount: Math.round(bigBlind * 2.5), // 3.000
            reason: "Kartu kuat. Open raise jika belum ada aksi, atau Call jika lawan melakukan standard open raise."
          };
        case 3: // Kartu Spekulatif (Pair Kecil, Suited Connectors, Axs)
          return {
            action: "CALL / LIMP",
            amount: bigBlind, // 1.200
            reason: "Kartu bernilai set-mine/draw. Masuk pot dengan biaya murah untuk melihat Flop."
          };
        default: // Kartu Lemah / Sampah
          return {
            action: "CHECK / FOLD",
            amount: 0,
            reason: "Kartu pre-flop terlalu lemah. Fold jika ada raise dari lawan, atau Check jika di posisi Big Blind."
          };
      }
    }

    // === 2. PASE POST-FLOP (FLOP, TURN, RIVER) ===
    const totalCards = [...activeHand, ...activeCommunity];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const equity = PokerEvaluator.calculateStrength(activeHand, activeCommunity);
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunity);
    const hasDangerThreat = threats.some(t => !t.safe);

    let phaseName = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";

    // Kategori Kombinasi Kartu
    const isMonster = bestHand.score >= 6; // Flush, Full House, 4-of-a-kind, Straight Flush
    const isStrong = bestHand.score >= 3;  // Two Pair, Three of a Kind, Straight
    const isMedium = bestHand.score === 2;  // One Pair

    // A. Monster Hand
    if (isMonster) {
      return {
        action: "RAISE / BET",
        amount: bigBlind * 4, // ~4.800 (Value Bet Besar)
        reason: `[${phaseName}] Anda membuat ${bestHand.rankName}! Lakukan Value Bet besar atau Re-raise untuk memaksimalkan pot.`
      };
    }

    // B. Strong Hand (Trips / Two Pair / Straight)
    if (isStrong) {
      if (hasDangerThreat && phaseName !== "FLOP") {
        return {
          action: "CHECK / CALL",
          amount: bigBlind * 2,
          reason: `[${phaseName}] Anda punya ${bestHand.rankName}, tetapi ada ancaman Flush/Full House di meja. Bermain aman dengan Check/Call.`
        };
      }
      return {
        action: "BET / RAISE",
        amount: Math.round(bigBlind * 2.5), // ~3.000
        reason: `[${phaseName}] ${bestHand.rankName} tergolong kuat. Lakukan Bet ukuran 1/2 s.d 2/3 Pot untuk mengekstrak value.`
      };
    }

    // C. Medium Hand (One Pair)
    if (isMedium) {
      if (hasDangerThreat) {
        return {
          action: "CHECK / FOLD",
          amount: 0,
          reason: `[${phaseName}] Hanya memegang One Pair dengan papan meja yang berbahaya. Lakukan Check, Fold jika lawan memasang bet tinggi.`
        };
      }
      return {
        action: "CHECK / CALL",
        amount: bigBlind, // Call seukuran 1 BB (1.200)
        reason: `[${phaseName}] Memegang One Pair. Lebih aman Check/Call bet kecil untuk kontrol pot.`
      };
    }

    // D. High Card / Drawing Hand (Tanpa Pair)
    if (equity >= 40 && commCount < 5) {
      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Memiliki potensi Flush/Straight Draw. Coba ambil gratisan (Check) atau Call jika harganya murah.`
      };
    }

    return {
      action: "CHECK / FOLD",
      amount: 0,
      reason: `[${phaseName}] Tidak memiliki kombinasi/potensi berarti. Segera Check atau Fold jika menghadapi taruhan lawan.`
    };
  }
}
