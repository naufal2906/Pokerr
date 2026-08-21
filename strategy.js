import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  static getPreFlopTier(handCards) {
    if (handCards.length < 2) return 0;

    const c1 = handCards[0];
    const c2 = handCards[1];
    const high = Math.max(c1.rank.value, c2.rank.value);
    const low = Math.min(c1.rank.value, c2.rank.value);
    const isPair = c1.rank.value === c2.rank.value;
    
    // Cek apakah simbol/lambang kartu sama (Suited)
    const isSuited = c1.suit.symbol === c2.suit.symbol;

    // 1. Pocket Pairs (AA, KK, QQ, JJ, dst)
    if (isPair) {
      if (high >= 11) return 1; // Tier 1: Premium Pairs (AA, KK, QQ, JJ)
      if (high >= 8) return 2;  // Tier 2: Medium Pairs (1010, 99, 88)
      return 3;                 // Tier 3: Small Pairs (77-22)
    }

    // 2. Kombinasi Kartu Tinggi (As & King)
    if (high === 14) { // Kartu As
      if (low === 13) return isSuited ? 1 : 2; // AK Suited = Tier 1, AK Offsuit = Tier 2
      if (low >= 10) return isSuited ? 2 : 3;  // AQ/AJ Suited lebih kuat
      if (isSuited) return 3;                  // A-2 s/d A-9 Suited punya potensi Nut Flush
      return 4;
    }

    // 3. Suited Connectors (misal: J♣-10♣, 10♠-9♠)
    if (isSuited && (high - low === 1) && high >= 8) {
      return 2;
    }

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

    // === 1. FASE PRE-FLOP ===
    if (commCount === 0) {
      const tier = this.getPreFlopTier(activeHand);

      switch (tier) {
        case 1:
          return {
            action: "RAISE / RE-RAISE",
            amount: bigBlind * 3,
            reason: "Kartu monster pre-flop. Potensi kuat membuat Set, Top Pair, atau Flush/Straight!"
          };
        case 2:
          return {
            action: "RAISE / CALL",
            amount: Math.round(bigBlind * 2.5),
            reason: "Kartu kuat dengan fleksibilitas baik. Open raise atau Call raise lawan."
          };
        case 3:
          return {
            action: "CALL / LIMP",
            amount: bigBlind,
            reason: "Kartu bernilai 'Set-Mining' (mencari Set) atau 'Flush Draw'. Masuk pot murah."
          };
        default:
          return {
            action: "CHECK / FOLD",
            amount: 0,
            reason: "Kartu pre-flop terlalu lemah. Fold jika lawan melakukan raise."
          };
      }
    }

    // === 2. FASE POST-FLOP (FLOP, TURN, RIVER) ===
    const totalCards = [...activeHand, ...activeCommunity];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const equity = PokerEvaluator.calculateStrength(activeHand, activeCommunity);
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunity);

    // Variabel Analisis Kartu
    const boardRanks = activeCommunity.map(c => c.rank.value);
    const maxBoardRank = boardRanks.length > 0 ? Math.max(...boardRanks) : 0;

    // Deteksi Trips di Board (3 kartu kembar di meja)
    const commCounts = {};
    activeCommunity.forEach(c => commCounts[c.rank.value] = (commCounts[c.rank.value] || 0) + 1);
    const hasTripsOnBoard = Object.values(commCounts).some(count => count >= 3);

    const hasStraightThreat = threats.some(t => t.text.includes("Straight"));
    const hasDangerThreat = threats.some(t => !t.safe) || hasStraightThreat;

    let phaseName = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";

    // Cek Karakteristik Pair
    const isPocketPair = activeHand[0].rank.value === activeHand[1].rank.value;
    const isOverpair = isPocketPair && activeHand[0].rank.value > maxBoardRank;

    // A. MONSTER HAND (Full House, Four of a Kind, Flush, Straight Flush)
    if (bestHand.score >= 6) {
      // Penjagaan khusus jika ada 3 kartu kembar di meja
      if (hasTripsOnBoard && bestHand.score === 7) {
        return {
          action: "CHECK / CALL",
          amount: bigBlind,
          reason: `[${phaseName}] Anda memegang Full House, tetapi ada 3 kartu kembar di meja. Waspada lawan membuat Quads. Check/Call.`
        };
      }

      return {
        action: "RAISE / BET",
        amount: bigBlind * 4,
        reason: `[${phaseName}] Kombinasi Monster (${bestHand.rankName})! Lakukan Value Bet besar.`
      };
    }

    // B. STRONG HAND (Set / Three of a Kind, Two Pair, Straight, atau OVERPAIR)
    if (bestHand.score >= 3 || isOverpair) {
      if (phaseName === "RIVER" && hasStraightThreat) {
        return {
          action: "CHECK / CALL",
          amount: bigBlind,
          reason: `[${phaseName}] Kombinasi Anda kuat (${isOverpair ? 'Overpair' : bestHand.rankName}), tetapi ada potensi Straight di meja. Check/Call.`
        };
      }

      if (hasDangerThreat && phaseName !== "FLOP") {
        return {
          action: "CHECK / CALL",
          amount: bigBlind * 1.5,
          reason: `[${phaseName}] Kombinasi kuat, namun ada ancaman Flush/Straight di meja. Bermain aman.`
        };
      }

      let reasonText = `[${phaseName}] `;
      if (isOverpair) {
        reasonText += `Overpair Sangat Kuat! Pair tangan Anda mendominasi Pair di meja lawan. Lakukan Value Bet!`;
      } else if (bestHand.score === 4) { // Three of a Kind / Set
        reasonText += `Berhasil membuat Set/Three of a Kind! Peluang menang sangat tinggi. Bet / Raise!`;
      } else {
        reasonText += `${bestHand.rankName} tergolong kuat. Lakukan Bet / Raise untuk mengambil pot.`;
      }

      return {
        action: "BET / RAISE",
        amount: Math.round(bigBlind * 2.5),
        reason: reasonText
      };
    }

    // C. MEDIUM HAND (One Pair / Top Pair)
    if (bestHand.score === 2) {
      if (hasDangerThreat) {
        return {
          action: "CHECK / FOLD",
          amount: 0,
          reason: `[${phaseName}] Hanya memegang One Pair di papan yang berbahaya. Check/Fold jika lawan bertaruh.`
        };
      }

      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Memegang One Pair. Pasang taruhan kecil atau Check/Call.`
      };
    }

    // D. DRAWING HAND (Potensi Set/Flush/Straight yang belum jadi)
    if (equity >= 40 && commCount < 5) {
      return {
        action: "CHECK / CALL",
        amount: bigBlind,
        reason: `[${phaseName}] Memiliki potensi berkembang (Draw) yang bagus. Amati kartu berikutnya secara murah.`
      };
    }

    return {
      action: "CHECK / FOLD",
      amount: 0,
      reason: `[${phaseName}] Kombinasi kartu lemah. Segera Check atau Fold.`
    };
  }
}
