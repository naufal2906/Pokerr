export class PokerStrategy {
  static getStrategy(handCards, communityCards, bestHand) {
    const validHand = handCards.filter(c => c && c.rank);
    const validComm = communityCards.filter(c => c && c.rank);

    // 1. FASE PRE-FLOP (MEJA MASIH KOSONG)
    if (validComm.length === 0) {
      return this.getPreFlopStrategy(validHand);
    }

    // 2. FASE POST-FLOP (FLOP / TURN / RIVER)
    const score = bestHand ? bestHand.score : 0;
    const stage = validComm.length === 3 ? "FLOP" : validComm.length === 4 ? "TURN" : "RIVER";

    // MONSTER HAND: Four of a Kind / Full House / Flush / Straight
    if (score >= 5) {
      return {
        action: "RAISE / ALL-IN",
        amount: "2.400 Chips",
        reason: `[${stage}] Kombinasi Terbentuk: ${bestHand.rankName}! Kartu sangat kuat, kumpulkan pot maksimal dengan Raise besar / All-In.`
      };
    }

    // STRONG HAND: Three of a Kind / Two Pair
    if (score >= 3) {
      return {
        action: "BET / RAISE",
        amount: "1.200 Chips",
        reason: `[${stage}] Kombinasi Terbentuk: ${bestHand.rankName}. Pegang kendali meja dengan taruhan sedang.`
      };
    }

    // MEDIUM HAND: One Pair
    if (score === 2) {
      return {
        action: "CHECK / CALL",
        amount: "600 Chips",
        reason: `[${stage}] Kombinasi Terbentuk: One Pair. Mainkan aman dengan kontrol pot (Check/Call).`
      };
    }

    // WEAK HAND: High Card
    return {
      action: "CHECK / FOLD",
      amount: "0 Chips",
      reason: `[${stage}] Belum Membentuk Kombinasi (High Card). Disarankan Check jika gratis, atau Fold jika di-bet lawan.`
    };
  }

  static getPreFlopStrategy(holeCards) {
    if (!holeCards || holeCards.length < 2) {
      return { action: "WAIT", amount: "0 Chips", reason: "Pilih 2 Kartu Tangan Terlebih Dahulu." };
    }

    const c1 = holeCards[0];
    const c2 = holeCards[1];
    const isPair = c1.rank.value === c2.rank.value;
    const maxRank = Math.max(c1.rank.value, c2.rank.value);
    const minRank = Math.min(c1.rank.value, c2.rank.value);
    const isSuited = (c1.suit.symbol || c1.suit) === (c2.suit.symbol || c2.suit);

    // TIER 1: Monster Hands (AA, KK, QQ, AK Suited) -> RAISE UMPAN / CALL ALL-IN
    if ((isPair && maxRank >= 12) || (maxRank === 14 && minRank === 13 && isSuited)) {
      return {
        action: "RAISE / CALL ALL-IN",
        amount: "1.800 - 3.000 Chips",
        reason: "[PRE-FLOP] [Tier 1] Memegang Monster Hand! Buka Raise 1.800 - 3.000 Chips untuk memancing lawan. Jika lawan Re-Raise / All-In, langsung CALL!"
      };
    }

    // TIER 2: Strong Pairs & AK Offsuit / AQ Suited (JJ, 1010, AK Off, AQ Suited) -> RAISE KONTROL
    if ((isPair && maxRank >= 10) || (maxRank === 14 && minRank >= 13) || (maxRank === 14 && minRank === 12 && isSuited)) {
      return {
        action: "RAISE",
        amount: "1.200 - 1.800 Chips",
        reason: "[PRE-FLOP] [Tier 2] Kartu Sangat Kuat. Lakukan Raise untuk membangun pot dan menyaring kartu sampah lawan."
      };
    }

    // TIER 3: Middle Pairs & Suited Broadway (99, 88, AJ/KQ/KJ/QJ Suited) -> RAISE SEDANG
    if ((isPair && maxRank >= 8) || (maxRank >= 11 && minRank >= 10 && isSuited) || (maxRank === 14 && minRank >= 11)) {
      const label = isSuited ? "Suited Broadway" : "Pair Menengah";
      return {
        action: "RAISE / CALL",
        amount: "900 - 1.200 Chips",
        reason: `[PRE-FLOP] [Tier 3] Kartu Bagus (${label}). Lakukan Raise sedang atau Call jika ada yang raise.`
      };
    }

    // TIER 4: Small Pocket Pairs (7-7 s/d 2-2), Suited Connectors, & High Cards -> CALL (Set Mining)
    if (isPair || isSuited || maxRank >= 10) {
      const typeLabel = isPair ? `Small Pair (${maxRank}s)` : isSuited ? "Suited Potential" : "High Card";
      return {
        action: "CALL",
        amount: "600 Chips",
        reason: `[PRE-FLOP] [Tier 4] Memegang ${typeLabel}. Lakukan Call Big Blind untuk melihat Flop (Set Mining / Potensial Kombinasi dengan biaya murah).`
      };
    }

    // TIER 5: Weak / Trash Hands -> CHECK / FOLD
    return {
      action: "CHECK / FOLD",
      amount: "0 Chips",
      reason: "[PRE-FLOP] [Tier 5] Kartu tangan lemah. Mainkan pasif (Check jika gratis) atau Fold jika lawan Raise."
    };
  }
}
