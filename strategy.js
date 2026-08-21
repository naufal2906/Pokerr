import { PokerEvaluator } from './evaluator.js';

export class PokerStrategy {
  // Pembulatan nominal bet ke kelipatan Big Blind terdekat (Default BB = 600)
  static formatBetSize(rawAmount, bigBlind = 600) {
    if (rawAmount <= 0) return "0 Chips";
    
    // Taruhan minimal untuk Bet/Raise/Call tidak boleh di bawah 1 BB (600)
    let adjusted = Math.max(rawAmount, bigBlind);
    
    // Dibulatkan ke kelipatan Big Blind (600)
    adjusted = Math.round(adjusted / bigBlind) * bigBlind;
    
    return `${adjusted.toLocaleString('id-ID')} Chips`;
  }

  static getRecommendation(handCards, communityCards, currentStage = null, potSize = 600, bigBlind = 600) {
    const activeHand = PokerEvaluator.getValidCards(handCards);
    const activeComm = PokerEvaluator.getValidCards(communityCards);

    // Deteksi Otomatis Stage berdasarkan kartu meja
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
    
    let nutAnalysis = { hasFlushThreat: false, highestThreat: "-" };
    if (typeof PokerEvaluator.getBoardNutHand === 'function') {
      nutAnalysis = PokerEvaluator.getBoardNutHand(activeComm) || nutAnalysis;
    }

    // 1. KONDISI KRUSIAL: Straight TAPI Meja Punya Potensi Flush (3+ Same Suit)
    if (bestHand.score === 5 && nutAnalysis.hasFlushThreat) {
      return {
        action: "CHECK / CALL (WARNING)",
        size: this.formatBetSize(bigBlind, bigBlind), // Standard Call 1 BB (600 Chips)
        color: "warning",
        text: `[${stage}] Kombinasi Terbentuk: Straight! ⚠️ Waspada potensi ${nutAnalysis.highestThreat}. Kontrol pot dengan Check/Call!`
      };
    }

    // 2. Kombinasi Flush ke Atas (Flush, Full House, Quads, Straight Flush, Royal)
    if (bestHand.score >= 6) {
      return {
        action: "RAISE / ALL-IN",
        size: this.formatBetSize(potSize * 4, bigBlind), // Output kelipatan 2.400 / 3.000 Chips
        color: "danger",
        text: `[${stage}] Kombinasi Terbentuk: ${bestHand.rankName}! Kartu sangat kuat, lakukan Value Bet besar atau Raise/All-In.`
      };
    }

    // 3. Straight Tanpa Ancaman Flush
    if (bestHand.score === 5) {
      return {
        action: "RAISE / BET",
        size: this.formatBetSize(potSize * 3, bigBlind), // Output kelipatan 1.800 / 2.400 Chips
        color: "success",
        text: `[${stage}] Kombinasi Terbentuk: Straight! Meja aman, lakukan Raise untuk memaksimalkan pot.`
      };
    }

    // 4. Two Pair / Three of a Kind
    if (bestHand.score >= 3) {
      return {
        action: "BET / RAISE",
        size: this.formatBetSize(potSize * 2, bigBlind), // Output kelipatan 1.200 / 1.800 Chips
        color: "success",
        text: `[${stage}] Kombinasi Terbentuk: ${bestHand.rankName}. Pegang kendali permainan dengan taruhan sedang.`
      };
    }

    // 5. One Pair / Pocket Pair
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
        size: this.formatBetSize(bigBlind, bigBlind), // Standard Call 1 BB (600 Chips)
        color: "info",
        text: `[${stage}] Kombinasi Terbentuk: One Pair / Pocket Pair. Mainkan pasif untuk melihat kartu berikutnya.`
      };
    }

    // 6. Ada Potensi Draw (Flush Draw, Straight Draw, dll)
    if (bestHand.draws && bestHand.draws.length > 0) {
      const topDraw = bestHand.draws[0];
      return {
        action: "CHECK / CALL",
        size: this.formatBetSize(bigBlind, bigBlind), // Standard Call 1 BB (600 Chips)
        color: "info",
        text: `[${stage}] Potensi ${topDraw.text}! ${topDraw.needed}. Lakukan Call murah untuk mengejar kombinasi.`
      };
    }

    // 7. High Card
    return {
      action: "CHECK / FOLD",
      size: "0 Chips",
      color: "secondary",
      text: `[${stage}] Kombinasi Belum Terbentuk (High Card). Disarankan Check atau Fold jika ada Raise besar.`
    };
  }
}
