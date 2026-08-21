import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  static getRecommendation(handCards, communityCards, currentStage = 'FLOP', potSize = 1200) {
    const activeHand = PokerEvaluator.getValidCards(handCards);
    const activeComm = PokerEvaluator.getValidCards(communityCards);

    if (activeHand.length < 2) {
      return { action: "WAIT", size: "0 Chips", text: "Pilih 2 Kartu Tangan Terlebih Dahulu" };
    }

    const totalCards = [...activeHand, ...activeComm];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    const nutAnalysis = PokerEvaluator.getBoardNutHand(activeComm);

    // KONDISI KRUSIAL RIVER: Kita memegang Straight TAPI Meja Punya Potensi Flush (3+ Same Suit)
    if (bestHand.score === 5 && nutAnalysis.hasFlushThreat) {
      return {
        action: "CHECK / CALL (PERINGATAN)",
        size: `${Math.round(potSize * 0.3)} Chips`,
        color: "warning",
        text: `[${currentStage}] Kombinasi Terbentuk: Straight! ⚠️ TETAPI PERHATIKAN MEJA: Terdapat potensi ${nutAnalysis.highestThreat}. Jangan All-In, kontrol pot dengan Check/Call!`
      };
    }

    // Jika Kombinasi Lebih Tinggi dari Flush (Flush, Full House, Quads, Straight Flush, Royal Flush)
    if (bestHand.score >= 6) {
      return {
        action: "RAISE / ALL-IN",
        size: `${potSize * 2} Chips`,
        color: "danger",
        text: `[${currentStage}] Kombinasi Terbentuk: ${bestHand.rankName}! Kartu sangat kuat, lakukan Value Bet besar atau Raise/All-In.`
      };
    }

    // Jika Memegang Straight Tanpa Potensi Flush Lawan
    if (bestHand.score === 5) {
      return {
        action: "RAISE / BET",
        size: `${potSize * 1.5} Chips`,
        color: "success",
        text: `[${currentStage}] Kombinasi Terbentuk: Straight! Meja aman, lakukan Raise untuk memaksimalkan pot.`
      };
    }

    // Two Pair / Three of a Kind
    if (bestHand.score >= 3) {
      return {
        action: "BET / RAISE",
        size: `${potSize} Chips`,
        color: "success",
        text: `[${currentStage}] Kombinasi Terbentuk: ${bestHand.rankName}. Pegang kendali permainan dengan taruhan sedang.`
      };
    }

    // One Pair
    if (bestHand.score === 2) {
      // Cek apakah pair As di meja mengancam Pocket Pair K-K/Q-Q
      const commRanks = activeComm.map(c => c.rank.value);
      if (commRanks.includes(14) && activeHand[0].rank.value < 14 && activeHand[1].rank.value < 14) {
        return {
          action: "CHECK / FOLD",
          size: "0 Chips",
          color: "warning",
          text: `[${currentStage}] Kartu Meja Memiliki As! Pair Tangan Anda berisiko kalah oleh lawan yang memegang As.`
        };
      }

      return {
        action: "CHECK / CALL",
        size: `${Math.round(potSize * 0.5)} Chips`,
        color: "info",
        text: `[${currentStage}] Kombinasi Terbentuk: One Pair. Mainkan secara pasif untuk melihat kartu berikutnya.`
      };
    }

    // Ada Potensi Draw (Kurang 1 Kartu)
    if (bestHand.draws && bestHand.draws.length > 0) {
      const topDraw = bestHand.draws[0];
      return {
        action: "CHECK / CALL",
        size: `${Math.round(potSize * 0.4)} Chips`,
        color: "info",
        text: `[${currentStage}] ${topDraw.text}! ${topDraw.needed}. Lakukan Call murah untuk mengejar kombinasi.`
      };
    }

    // High Card
    return {
      action: "CHECK / FOLD",
      size: "0 Chips",
      color: "secondary",
      text: `[${currentStage}] Kombinasi Belum Terbentuk (High Card). Disarankan Check atau Fold jika ada Raise besar dari lawan.`
    };
  }
}
