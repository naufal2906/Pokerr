import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  static getRecommendation(handCards, communityCards, currentStage = null, potSize = 1200) {
    const activeHand = PokerEvaluator.getValidCards(handCards);
    const activeComm = PokerEvaluator.getValidCards(communityCards);

    // 1. Deteksi Otomatis Stage berdasarkan Jumlah Kartu Komunitas
    let stage = currentStage;
    if (!stage || typeof stage !== 'string') {
      if (activeComm.length === 3) stage = 'FLOP';
      else if (activeComm.length === 4) stage = 'TURN';
      else if (activeComm.length === 5) stage = 'RIVER';
      else stage = 'PRE-FLOP';
    }

    if (activeHand.length < 2) {
      return { 
        action: "WAIT", 
        size: "0 Chips", 
        color: "secondary", 
        text: "Pilih 2 Kartu Tangan Terlebih Dahulu" 
      };
    }

    const totalCards = [...activeHand, ...activeComm];
    const bestHand = PokerEvaluator.getBestHand(totalCards);
    
    // Safety check untuk nutAnalysis
    let nutAnalysis = { hasFlushThreat: false, highestThreat: "-" };
    if (typeof PokerEvaluator.getBoardNutHand === 'function') {
      nutAnalysis = PokerEvaluator.getBoardNutHand(activeComm) || nutAnalysis;
    }

    // 2. KONDISI KRUSIAL: Kartu Straight TAPI Meja Punya Potensi Flush (3+ Same Suit)
    if (bestHand.score === 5 && nutAnalysis.hasFlushThreat) {
      return {
        action: "CHECK / CALL (WARNING)",
        size: `${Math.round(potSize * 0.3)} Chips`,
        color: "warning",
        text: `[${stage}] Kombinasi Terbentuk: Straight! ⚠️ Waspada potensi ${nutAnalysis.highestThreat}. Kontrol pot dengan Check/Call!`
      };
    }

    // 3. Kombinasi Flush ke Atas (Flush, Full House, Quads, Straight Flush, Royal)
    if (bestHand.score >= 6) {
      return {
        action: "RAISE / ALL-IN",
        size: `${potSize * 2} Chips`,
        color: "danger",
        text: `[${stage}] Kombinasi Terbentuk: ${bestHand.rankName}! Kartu sangat kuat, lakukan Value Bet besar atau Raise/All-In.`
      };
    }

    // 4. Straight Tanpa Ancaman Flush
    if (bestHand.score === 5) {
      return {
        action: "RAISE / BET",
        size: `${potSize * 1.5} Chips`,
        color: "success",
        text: `[${stage}] Kombinasi Terbentuk: Straight! Meja aman, lakukan Raise untuk memaksimalkan pot.`
      };
    }

    // 5. Two Pair / Three of a Kind
    if (bestHand.score >= 3) {
      return {
        action: "BET / RAISE",
        size: `${potSize} Chips`,
        color: "success",
        text: `[${stage}] Kombinasi Terbentuk: ${bestHand.rankName}. Pegang kendali permainan dengan taruhan sedang.`
      };
    }

    // 6. One Pair / Pocket Pair
    if (bestHand.score === 2) {
      const commRanks = activeComm.map(c => c.rank.value);
      if (commRanks.includes(14) && activeHand[0].rank.value < 14 && activeHand[1].rank.value < 14) {
        return {
          action: "CHECK / FOLD",
          size: "0 Chips",
          color: "warning",
          text: `[${stage}] Kartu Meja Memiliki As! Pair Tangan Anda berisiko kalah oleh lawan yang memegang As.`
        };
      }

      return {
        action: "CHECK / CALL",
        size: `${Math.round(potSize * 0.5)} Chips`,
        color: "info",
        text: `[${stage}] Kombinasi Terbentuk: One Pair / Pocket Pair. Mainkan pasif untuk melihat kartu berikutnya.`
      };
    }

    // 7. Ada Potensi Draw (Full House Draw, Flush Draw, Straight Draw, dll)
    if (bestHand.draws && bestHand.draws.length > 0) {
      const topDraw = bestHand.draws[0];
      return {
        action: "CHECK / CALL",
        size: `${Math.round(potSize * 0.4)} Chips`,
        color: "info",
        text: `[${stage}] Potensi ${topDraw.text}! ${topDraw.needed}. Lakukan Call murah untuk mengejar kombinasi.`
      };
    }

    // 8. High Card
    return {
      action: "CHECK / FOLD",
      size: "0 Chips",
      color: "secondary",
      text: `[${stage}] Kombinasi Belum Terbentuk (High Card). Disarankan Check atau Fold jika ada Raise besar.`
    };
  }
}
