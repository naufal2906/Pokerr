import { RANKS, SUITS } from './card.js';

export class PokerEvaluator {
  static getValidCards(cards) {
    return (cards || []).filter(c => c && (c.rank || c.value));
  }

  static formatCardText(card) {
    if (!card) return '';
    const label = card.rank ? card.rank.label : (card.label || card.value);
    const symbol = card.suit ? (card.suit.symbol || card.suit) : '';
    return `${label}${symbol}`;
  }

  static getCardSuitSymbol(card) {
    if (!card) return '';
    return card.suit ? (card.suit.symbol || card.suit) : '';
  }

  // 1. EVALUASI KARTU TANGAN MURNI
  static evaluateHoleCardsOnly(holeCards) {
    const valid = this.getValidCards(holeCards);
    if (valid.length < 2) return "Pilih 2 Kartu Tangan";

    const c1 = valid[0];
    const c2 = valid[1];
    const txt1 = this.formatCardText(c1);
    const txt2 = this.formatCardText(c2);

    const v1 = c1.rank ? c1.rank.value : c1.value;
    const v2 = c2.rank ? c2.rank.value : c2.value;

    if (v1 === v2) return `Pocket Pair (${txt1} ${txt2})`;

    const s1 = this.getCardSuitSymbol(c1);
    const s2 = this.getCardSuitSymbol(c2);
    const type = (s1 === s2) ? "Suited" : "Offsuit";

    return `${txt1} ${txt2} (${type})`;
  }

  // 2. DETEKSI DRAW
  static detectDraws(holeCards, communityCards) {
    const all = [...this.getValidCards(holeCards), ...this.getValidCards(communityCards)];
    if (all.length < 4) return [];

    const myBest = this.getBestHand(all);
    if (myBest && myBest.score >= 5) return [];

    const draws = [];
    const values = [...new Set(all.map(c => c.rank ? c.rank.value : c.value))].sort((a, b) => a - b);
    
    // Flush Draw
    const suitCounts = {};
    all.forEach(c => {
      const s = this.getCardSuitSymbol(c);
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    Object.keys(suitCounts).forEach(s => {
      if (suitCounts[s] === 4) {
        draws.push(`🌊 <b>Flush Draw!</b> Butuh 1 kartu kembang ${s} lagi.`);
      }
    });

    // Straight Draw
    if (values.includes(14)) values.unshift(1);
    for (let target = 2; target <= 14; target++) {
      if (!values.includes(target)) {
        const testSet = [...values, target].sort((a, b) => a - b);
        let consecutive = 1;
        for (let i = 0; i < testSet.length - 1; i++) {
          if (testSet[i + 1] === testSet[i] + 1) {
            consecutive++;
            if (consecutive >= 5) {
              const neededLabel = target === 14 ? 'A' : target === 13 ? 'K' : target === 12 ? 'Q' : target === 11 ? 'J' : target === 1 ? 'A' : target;
              draws.push(`🎯 <b>Straight Draw!</b> Butuh 1 kartu [${neededLabel}] lagi.`);
              break;
            }
          } else if (testSet[i + 1] !== testSet[i]) {
            consecutive = 1;
          }
        }
      }
    }

    return [...new Set(draws)];
  }

  // 3. ANALISIS ANCAMAN MEJA & STRUKTUR
  static analyzeBoardThreats(communityCards, holeCards = []) {
    const comm = this.getValidCards(communityCards);
    if (comm.length < 3) {
      return [{
        text: "Menunggu Flop (Minimal 3 Kartu Komunitas)",
        boardPotential: "Belum Ada Board",
        worstCase: "Belum Ada Board",
        indicator: "^",
        safe: true
      }];
    }

    const threats = [];
    const validHand = this.getValidCards(holeCards);
    const totalCards = [...validHand, ...comm];
    const myBest = this.getBestHand(totalCards);
    const myScore = myBest ? myBest.score : 0; 

    const commRanks = comm.map(c => c.rank ? c.rank.value : c.value).sort((a, b) => b - a);
    const maxRank = commRanks[0];
    const maxLabel = maxRank === 14 ? 'A' : maxRank === 13 ? 'K' : maxRank === 12 ? 'Q' : maxRank === 11 ? 'J' : maxRank;

    // Kembang Komunitas
    const suitCounts = {};
    comm.forEach(c => {
      const s = this.getCardSuitSymbol(c);
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === maxSuitCount);
    const boardHasFlush = maxSuitCount >= 3;

    // Pair / Three of a Kind Komunitas
    const rankCounts = {};
    commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const boardHasPair = Object.values(rankCounts).some(count => count >= 2);
    const boardHasThreeOfAKind = Object.values(rankCounts).some(count => count >= 3);

    let boardStructureText = "";
    let highestBoardComboName = "";
    let worstCaseMessage = "";
    let absoluteMaxPossibleScore = 1;

    if (boardHasThreeOfAKind) {
      boardStructureText = `Three of a Kind di Meja [Top Card ${maxLabel}]`;
      absoluteMaxPossibleScore = 8;
      highestBoardComboName = "Four of a Kind";
      worstCaseMessage = `🚨 <b>ANCAMAN FOUR OF A KIND:</b> Ada Three of a Kind di meja! Lawan yang memegang 1 kartu tersisa membentuk Four of a Kind.`;
    } else if (boardHasPair) {
      boardStructureText = `Pair di Meja [Top Card ${maxLabel}]`;
      absoluteMaxPossibleScore = 7;
      highestBoardComboName = "Full House / Three of a Kind";
      worstCaseMessage = `🏠 <b>MEJA BERPASANGAN:</b> Waspada lawan memegang Set/Pair untuk membentuk Full House.`;
    } else if (boardHasFlush) {
      boardStructureText = `Koneksi Flush (${maxSuitCount} Kembang ${flushSuit})`;
      absoluteMaxPossibleScore = 6;
      highestBoardComboName = `Flush (Kembang ${flushSuit})`;
      worstCaseMessage = `🌊 <b>POTENSI FLUSH:</b> Meja ada 3+ kembang ${flushSuit}. Lawan dengan kembang ${flushSuit} memegang Flush.`;
    } else {
      boardStructureText = `High Card Meja [${maxLabel}]`;
      absoluteMaxPossibleScore = 2;
      highestBoardComboName = `Top Pair / Two Pair [Top Card ${maxLabel}]`;
      worstCaseMessage = `👑 <b>ANCAMAN TOP PAIR:</b> Lawan yang memegang kartu [${maxLabel}] membentuk Top Pair.`;
    }

    const isSafe = myScore >= absoluteMaxPossibleScore;
    threats.push({
      text: `[${comm.length === 3 ? 'FLOP' : comm.length === 4 ? 'TURN' : 'RIVER'}] Struktur Meja: ${boardStructureText}`,
      boardPotential: `Potensi Terkuat Lawan: ${highestBoardComboName} | Anda: ${myBest.rankName}`,
      worstCase: isSafe ? `✅ <b>DOMINAN:</b> Kombinasi Anda (${myBest.rankName}) adalah yang tertinggi di meja saat ini.` : worstCaseMessage,
      indicator: isSafe ? "^" : "v",
      safe: isSafe
    });

    return threats;
  }

  // 4. PERHITUNGAN PROYEKSI KOMBINASI LAWAN & PERSENTASE (BLOCKER EFFECT)
  static calculateOpponentCombinations(holeCards, communityCards) {
    const validHand = this.getValidCards(holeCards);
    const validComm = this.getValidCards(communityCards);
    const knownCards = [...validHand, ...validComm];

    if (validHand.length < 2) return [];

    // Hitung sisa kartu Ace di dek
    const knownValues = knownCards.map(c => c.rank ? c.rank.value : c.value);
    const acesSeen = knownValues.filter(v => v === 14).length;
    const remainingAces = 4 - acesSeen;

    const totalCardsInDeck = 52 - knownCards.length;
    const totalOpponentCombos = (totalCardsInDeck * (totalCardsInDeck - 1)) / 2;

    const pairAceCombos = (remainingAces * (remainingAces - 1)) / 2;
    const singleAceCombos = remainingAces * (totalCardsInDeck - remainingAces);

    const pairAcePercent = Math.max(0, ((pairAceCombos / totalOpponentCombos) * 100).toFixed(1));
    const singleAcePercent = Math.max(0, ((singleAceCombos / totalOpponentCombos) * 100).toFixed(1));

    const combinations = [];

    combinations.push({
      name: `Lawan Memegang Pocket Pair Ace (A-A)`,
      percentage: `${pairAcePercent}%`,
      detail: `Sisa ${remainingAces} Ace di deck.`
    });

    combinations.push({
      name: `Lawan Memegang Minimal 1 Ace (High Card / Top Pair A)`,
      percentage: `${singleAcePercent}%`,
      detail: `Sisa ${remainingAces} Ace di deck.`
    });

    const myBest = this.getBestHand(knownCards);
    combinations.push({
      name: `Kombinasi Terbaik Tangan Anda saat ini`,
      percentage: `100%`,
      detail: myBest.rankName
    });

    return combinations;
  }

  // 5. PEMETAN RANGE KARTU LAWAN BERDASARKAN MEJA (HAND RANGE MATRIX)
  static getPossibleHandRanges(communityCards) {
    const comm = this.getValidCards(communityCards);
    if (comm.length < 3) return [];

    const ranges = [];
    const ranks = comm.map(c => c.rank ? c.rank.value : c.value).sort((a, b) => b - a);
    const suits = comm.map(c => this.getCardSuitSymbol(c));

    // A. Deteksi Koneksi Straight
    ranges.push({
      category: "🎯 Straight Made (Koneksi Urutan)",
      hands: ["Koneksi Atas", "Koneksi Bawah"],
      type: "Suited & Offsuit",
      danger: "HIGH"
    });

    // B. Deteksi Pair / Set di Meja
    const rankLabels = [...new Set(comm.map(c => c.rank ? c.rank.label : (c.label || c.value)))];
    const setHands = rankLabels.map(lbl => `${lbl}${lbl}`);
    ranges.push({
      category: "🏠 Set / Three of a Kind",
      hands: setHands, 
      type: "Pocket Pair",
      danger: "HIGH"
    });

    // C. Deteksi Flush Draw / Flush
    const suitCounts = {};
    suits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] >= 2);

    if (flushSuit) {
      ranges.push({
        category: `🌊 Flush Draw / Backdoor (${flushSuit})`,
        hands: [`A${flushSuit} X${flushSuit}`, `K${flushSuit} X${flushSuit}`, `Suited ${flushSuit}`],
        type: "Suited",
        danger: "MEDIUM"
      });
    }

    // D. Overpairs & Top Pair
    const maxRankLabel = comm.find(c => (c.rank ? c.rank.value : c.value) === ranks[0]);
    const topLabel = maxRankLabel ? (maxRankLabel.rank ? maxRankLabel.rank.label : maxRankLabel.value) : '';

    ranges.push({
      category: `👑 Overpair & Top Pair [${topLabel}]`,
      hands: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", `A${topLabel}o`, `A${topLabel}s`],
      type: "Suited & Offsuit",
      danger: "MEDIUM"
    });

    return ranges;
  }

  // 6. EVALUASI LENGKAP 5 KARTU TERBAIK
  static getBestHand(cards) {
    const valid = this.getValidCards(cards);
    if (valid.length === 0) return { score: 0, rankName: "-", cards: [] };

    const sorted = [...valid].sort((a, b) => {
      const va = a.rank ? a.rank.value : a.value;
      const vb = b.rank ? b.rank.value : b.value;
      return vb - va;
    });

    const values = [...new Set(sorted.map(c => c.rank ? c.rank.value : c.value))].sort((a, b) => b - a);

    const suitGroups = {};
    sorted.forEach(c => {
      const s = PokerEvaluator.getCardSuitSymbol(c);
      suitGroups[s] = suitGroups[s] || [];
      suitGroups[s].push(c);
    });

    let flushCards = null;
    Object.keys(suitGroups).forEach(s => {
      if (suitGroups[s].length >= 5) flushCards = suitGroups[s];
    });

    if (flushCards) {
      const fValues = [...new Set(flushCards.map(c => c.rank ? c.rank.value : c.value))].sort((a, b) => b - a);
      if (fValues.includes(14)) fValues.push(1);
      
      for (let i = 0; i <= fValues.length - 5; i++) {
        if (fValues[i] - fValues[i + 4] === 4) {
          if (fValues[i] === 14) {
            return { score: 10, rankName: "Royal Flush", cards: flushCards.slice(0, 5) };
          }
          return { score: 9, rankName: "Straight Flush", cards: flushCards.slice(0, 5) };
        }
      }
    }

    const counts = {};
    sorted.forEach(c => {
      const v = c.rank ? c.rank.value : c.value;
      counts[v] = counts[v] || [];
      counts[v].push(c);
    });

    const quadKeys = Object.keys(counts).filter(k => counts[k].length === 4).map(Number).sort((a, b) => b - a);
    const tripKeys = Object.keys(counts).filter(k => counts[k].length === 3).map(Number).sort((a, b) => b - a);
    const pairKeys = Object.keys(counts).filter(k => counts[k].length === 2).map(Number).sort((a, b) => b - a);

    if (quadKeys.length > 0) {
      const quadCards = counts[quadKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 8, rankName: `Four of a Kind (${quadCards})`, cards: sorted.slice(0, 5) };
    }

    if (tripKeys.length > 0 && (pairKeys.length > 0 || tripKeys.length > 1)) {
      const tripCards = counts[tripKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const pVal = tripKeys.length > 1 ? tripKeys[1] : pairKeys[0];
      const pairCards = counts[pVal].slice(0, 2).map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 7, rankName: `Full House (${tripCards} ${pairCards})`, cards: sorted.slice(0, 5) };
    }

    if (flushCards) {
      const topFlushCard = PokerEvaluator.formatCardText(flushCards[0]);
      return { score: 6, rankName: `Flush (${topFlushCard}-High)`, cards: flushCards.slice(0, 5) };
    }

    const straightVals = [...values];
    if (straightVals.includes(14)) straightVals.push(1);

    for (let i = 0; i <= straightVals.length - 5; i++) {
      if (straightVals[i] - straightVals[i + 4] === 4) {
        const topV = straightVals[i];
        const topLabel = topV === 14 ? 'A' : topV === 13 ? 'K' : topV === 12 ? 'Q' : topV === 11 ? 'J' : topV;
        
        const straightCards = [];
        for (let k = 0; k < 5; k++) {
          const targetV = topV - k === 1 ? 14 : topV - k;
          const matchCard = sorted.find(c => (c.rank ? c.rank.value : c.value) === targetV);
          if (matchCard) straightCards.push(matchCard);
        }

        return { score: 5, rankName: `Straight (High ${topLabel})`, cards: straightCards };
      }
    }

    if (tripKeys.length === 1) {
      const tripCards = counts[tripKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 4, rankName: `Three of a Kind (${tripCards})`, cards: sorted.slice(0, 5) };
    }

    if (pairKeys.length >= 2) {
      const p1 = counts[pairKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const p2 = counts[pairKeys[1]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 3, rankName: `Two Pair (${p1} & ${p2})`, cards: sorted.slice(0, 5) };
    }

    if (pairKeys.length === 1) {
      const pairVal = pairKeys[0];
      const pairCards = counts[pairVal].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const kickers = sorted.filter(c => (c.rank ? c.rank.value : c.value) !== pairVal);
      const topKicker = kickers.length > 0 ? PokerEvaluator.formatCardText(kickers[0]) : '';

      return { 
        score: 2, 
        rankName: `One Pair (${pairCards}) - Kicker [${topKicker}]`, 
        cards: sorted.slice(0, 5) 
      };
    }

    const topCard = this.formatCardText(sorted[0]);
    return { score: 1, rankName: `High Card (${topCard})`, cards: sorted.slice(0, 5) };
  }
}
