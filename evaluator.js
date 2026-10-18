import { RANKS, SUITS } from './card.js';

export class PokerEvaluator {
  // HELPER UNIVERSAL MENGAMBIL VALUE & SUIT DARI KARTU APA PUN
  static getCardValue(card) {
    if (!card) return 0;
    if (typeof card.value === 'number') return card.value;
    if (card.rank && typeof card.rank.value === 'number') return card.rank.value;
    return 0;
  }

  static getCardLabel(card) {
    if (!card) return '';
    if (card.rank && card.rank.label) return card.rank.label;
    if (card.label) return card.label;
    const v = this.getCardValue(card);
    if (v > 0) {
      return v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v);
    }
    return '';
  }

  static getCardSuitSymbol(card) {
    if (!card) return '';
    if (card.suit && card.suit.symbol) return card.suit.symbol;
    if (typeof card.suit === 'string') return card.suit;
    if (card.symbol) return card.symbol;
    return '';
  }

  static getValidCards(cards) {
    return (cards || []).filter(c => c && (this.getCardValue(c) > 0));
  }

  static formatCardText(card) {
    if (!card) return '';
    return `${this.getCardLabel(card)}${this.getCardSuitSymbol(card)}`;
  }

  // 1. EVALUASI KARTU TANGAN MURNI (PRE-FLOP)
  static evaluateHoleCardsOnly(holeCards) {
    const valid = this.getValidCards(holeCards);
    if (valid.length < 2) return "Pilih 2 Kartu Tangan";

    const txt1 = this.formatCardText(valid[0]);
    const txt2 = this.formatCardText(valid[1]);
    const v1 = this.getCardValue(valid[0]);
    const v2 = this.getCardValue(valid[1]);

    if (v1 === v2) return `Pocket Pair (${txt1} ${txt2})`;

    const s1 = this.getCardSuitSymbol(valid[0]);
    const s2 = this.getCardSuitSymbol(valid[1]);
    const type = (s1 === s2) ? "Suited" : "Offsuit";

    return `${txt1} ${txt2} (${type})`;
  }

  // 2. DETEKSI DRAW UNIVERSAL (MENDETEKSI STRAIGHT & FLUSH DRAW APA PUN)
  static detectDraws(holeCards, communityCards) {
    const validHole = this.getValidCards(holeCards);
    const validComm = this.getValidCards(communityCards);
    const all = [...validHole, ...validComm];
    if (all.length < 4) return [];

    const myBest = this.getBestHand(all);
    if (myBest && myBest.score >= 5) return []; // Sudah Straight/Flush ke atas

    const draws = [];
    
    // Deteksi Flush Draw Dinamis (4 kartu kembang sama apa saja)
    const suitCounts = {};
    all.forEach(c => {
      const s = this.getCardSuitSymbol(c);
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    Object.keys(suitCounts).forEach(s => {
      if (suitCounts[s] === 4) {
        draws.push(`🌊 <b>Flush Draw (${s})!</b> Butuh 1 kartu kembang ${s} lagi.`);
      }
    });

    // Deteksi Straight Draw Dinamis
    const values = [...new Set(all.map(c => this.getCardValue(c)))].sort((a, b) => a - b);
    if (values.includes(14)) values.unshift(1); // Ace Low support (A-2-3-4-5)

    for (let target = 2; target <= 14; target++) {
      if (!values.includes(target)) {
        const testSet = [...values, target].sort((a, b) => a - b);
        let consecutive = 1;
        for (let i = 0; i < testSet.length - 1; i++) {
          if (testSet[i + 1] === testSet[i] + 1) {
            consecutive++;
            if (consecutive >= 5) {
              const neededLabel = target === 14 ? 'A' : target === 13 ? 'K' : target === 12 ? 'Q' : target === 11 ? 'J' : target === 1 ? 'A' : target;
              draws.push(`🎯 <b>Straight Draw!</b> Butuh kartu [${neededLabel}].`);
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

  // 3. KALKULASI PROYEKSI OUTS & ODDS KARTU TANGAN (UNIVERSAL 52 KARTU)
  static calculateHandImprovementOdds(holeCards, communityCards) {
    const validHole = this.getValidCards(holeCards);
    const validComm = this.getValidCards(communityCards);

    if (validHole.length < 2) return { text: "Pilih 2 Kartu Tangan", percent: 0 };
    if (validComm.length < 3) {
      const v1 = this.getCardValue(validHole[0]);
      const v2 = this.getCardValue(validHole[1]);
      if (v1 === v2) return { text: "Pocket Pair (Peluang Set di Flop ~12%)", percent: 12 };
      return { text: "Pre-Flop (Peluang Pair di Flop ~32%)", percent: 32 };
    }

    const allCards = [...validHole, ...validComm];
    const myBest = this.getBestHand(allCards);
    const remainingToOpen = 5 - validComm.length; // Flop = 2 kartu sisa, Turn = 1 kartu sisa

    if (remainingToOpen === 0) {
      return { text: `Kombinasi Final: ${myBest.rankName}`, percent: 100 };
    }

    const multiplier = remainingToOpen === 2 ? 4 : 2; // Aturan x4 di Flop, x2 di Turn

    // 1. Three of a Kind (Set) -> Mengincar Full House / Quads
    if (myBest.score === 4) {
      const outs = 7; // 3 kartu pair 1 + 3 kartu pair 2 + 1 kartu set tersisa
      return {
        text: `🔥 PROYEKSI: Full House / Quads Draw (${outs} Outs)`,
        percent: Math.min(100, outs * multiplier)
      };
    }

    // 2. Two Pair -> Mengincar Full House
    if (myBest.score === 3) {
      const outs = 4; // 2 kartu pair 1 + 2 kartu pair 2
      return {
        text: `🏠 PROYEKSI: Full House Draw (${outs} Outs)`,
        percent: outs * multiplier
      };
    }

    // 3. One Pair -> Mengincar Set / Two Pair
    if (myBest.score === 2) {
      const outs = 5;
      return {
        text: `⚡ PROYEKSI: Set / Two Pair Draw (${outs} Outs)`,
        percent: outs * multiplier
      };
    }

    // 4. Drawing Hands (Flush Draw / Straight Draw)
    const draws = this.detectDraws(validHole, validComm);
    if (draws.length > 0) {
      const isFlushDraw = draws.some(d => d.includes("Flush"));
      const outs = isFlushDraw ? 9 : 8;
      return {
        text: isFlushDraw ? "🌊 PROYEKSI: Flush Draw (9 Outs)" : "🎯 PROYEKSI: Straight Draw (8 Outs)",
        percent: outs * multiplier
      };
    }

    return { text: "High Card (Butuh Kartu Cocok di Board)", percent: 15 };
  }

  // 4. PEMETAN 7 RANGE LAWAN UNIVERSAL
  static getPossibleHandRanges(communityCards, holeCards = []) {
    const comm = this.getValidCards(communityCards);
    if (comm.length < 3) return [];

    const commRanks = comm.map(c => this.getCardValue(c)).sort((a, b) => b - a);
    const commSuits = comm.map(c => this.getCardSuitSymbol(c));

    // Analisis Kembang Murni (Dinamis)
    const suitCounts = {};
    commSuits.forEach(s => suitCounts[s] = (suitCounts[s] || 0) + 1);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const dominantSuit = Object.keys(suitCounts).find(s => suitCounts[s] === maxSuitCount) || '♦';

    // Analisis Angka & Pair di Board
    const rankCounts = {};
    commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const topRank = commRanks[0];
    const topLabel = this.getCardLabel(comm.find(c => this.getCardValue(c) === topRank));

    // Analisis Celah Straight Dinamis
    const uniqueRanks = [...new Set(commRanks)].sort((a, b) => a - b);
    if (uniqueRanks.includes(14)) uniqueRanks.unshift(1);
    
    const neededForStraight = [];
    for (let target = 2; target <= 14; target++) {
      const windowRanks = uniqueRanks.filter(r => r >= target - 4 && r <= target);
      if (windowRanks.length >= 2) {
        for (let check = target - 4; check <= target; check++) {
          if (check >= 1 && !uniqueRanks.includes(check)) {
            const lbl = check === 1 || check === 14 ? 'A' : check === 13 ? 'K' : check === 12 ? 'Q' : check === 11 ? 'J' : String(check);
            if (!neededForStraight.includes(lbl)) neededForStraight.push(lbl);
          }
        }
      }
    }

    const straightCardsText = neededForStraight.length > 0 ? neededForStraight.slice(0, 3).join(', ') : '9, 8';

    return [
      {
        category: "1. 👑 Straight / Royal Flush Potential",
        hands: maxSuitCount >= 3 
          ? [`Lawan pegang 2 kartu kembang ${dominantSuit} urutan (${straightCardsText}${dominantSuit})`]
          : maxSuitCount === 2
            ? [`Lawan pegang 2 kartu kembang ${dominantSuit} (Backdoor Draw)`]
            : [`Butuh 2 kartu kembang sama + urutan`],
        type: "Suited",
        danger: maxSuitCount >= 3 ? "HIGH" : "MEDIUM"
      },
      {
        category: "2. 🎯 Straight / Urutan Angka",
        hands: [`Lawan memegang kartu angka spesifik: [ ${straightCardsText} ]`],
        type: "Suited & Offsuit",
        danger: "HIGH"
      },
      {
        category: "3. ⚡ Three of a Kind / Two Pair",
        hands: [`Pocket Pair Set (${topLabel}${topLabel}) atau Hit 2 Pair [${topLabel} + Low]`],
        type: "Pocket Pair / Connectors",
        danger: "MEDIUM"
      },
      {
        category: "4. 🌊 Flush Status",
        hands: maxSuitCount >= 3 
          ? [`SUDAH FLUSH: Lawan pegang 2 kartu kembang ${dominantSuit}`]
          : maxSuitCount === 2 
            ? [`FLUSH DRAW: Lawan pegang 2 kartu kembang ${dominantSuit}`]
            : [`BACKDOOR FLUSH: Butuh 2 kartu ${dominantSuit} di Turn & River`],
        type: "Suited",
        danger: maxSuitCount >= 3 ? "HIGH" : "MEDIUM"
      },
      {
        category: "5. 🏠 Full House Potential",
        hands: Object.values(rankCounts).some(v => v >= 2)
          ? [`Set / Pair kombinasi board (${commRanks.slice(0, 2).map(r => this.getCardLabel({value:r})).join('')})`]
          : [`Set (${topLabel}${topLabel}) mengejar Full House`],
        type: "Suited & Offsuit",
        danger: Object.values(rankCounts).some(v => v >= 2) ? "HIGH" : "MEDIUM"
      },
      {
        category: "6. 🚨 Four of a Kind (Quads)",
        hands: Object.values(rankCounts).includes(3)
          ? [`1 kartu [${topLabel}] tersisa di tangan lawan`]
          : [`Pocket Pair matching board (${topLabel}${topLabel})`],
        type: "Pocket Pair / Single",
        danger: Object.values(rankCounts).some(v => v >= 2) ? "HIGH" : "MEDIUM"
      },
      {
        category: "7. 🛡️ Overpair / Top Pair & Kicker",
        hands: [`Overpair (AA-77) atau Top Pair [A${topLabel}, K${topLabel}]`],
        type: "Suited & Offsuit",
        danger: "MEDIUM"
      }
    ];
  }

  // 5. KALKULASI WIN EQUITY
  static calculateStrength(holeCards, communityCards) {
    const validHand = this.getValidCards(holeCards);
    if (validHand.length < 2) return 0;

    const validComm = this.getValidCards(communityCards);
    const best = this.getBestHand([...validHand, ...validComm]);

    if (validComm.length === 0) {
      const v1 = this.getCardValue(validHand[0]);
      const v2 = this.getCardValue(validHand[1]);
      if (v1 === v2) return Math.min(90, Math.round(55 + v1 * 2.5));
      return Math.min(70, Math.round(20 + Math.max(v1, v2) * 2.5));
    }

    const scoreMap = { 10: 100, 9: 99, 8: 98, 7: 92, 6: 88, 5: 80, 4: 65, 3: 55, 2: 40, 1: 20 };
    let equity = scoreMap[best.score] || 20;

    const draws = this.detectDraws(validHand, validComm);
    if (draws.length > 0) equity = Math.min(92, equity + 12);

    return Math.round(equity);
  }

  // 6. EVALUASI LENGKAP 5 KARTU TERBAIK
  static getBestHand(cards) {
    const valid = this.getValidCards(cards);
    if (valid.length === 0) return { score: 0, rankName: "-", cards: [] };

    const sorted = [...valid].sort((a, b) => this.getCardValue(b) - this.getCardValue(a));
    const values = [...new Set(sorted.map(c => this.getCardValue(c)))].sort((a, b) => b - a);

    const suitGroups = {};
    sorted.forEach(c => {
      const s = this.getCardSuitSymbol(c);
      suitGroups[s] = suitGroups[s] || [];
      suitGroups[s].push(c);
    });

    let flushCards = null;
    Object.keys(suitGroups).forEach(s => {
      if (suitGroups[s].length >= 5) flushCards = suitGroups[s];
    });

    if (flushCards) {
      const fValues = [...new Set(flushCards.map(c => this.getCardValue(c)))].sort((a, b) => b - a);
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
      const v = this.getCardValue(c);
      counts[v] = counts[v] || [];
      counts[v].push(c);
    });

    const quadKeys = Object.keys(counts).filter(k => counts[k].length === 4).map(Number).sort((a, b) => b - a);
    const tripKeys = Object.keys(counts).filter(k => counts[k].length === 3).map(Number).sort((a, b) => b - a);
    const pairKeys = Object.keys(counts).filter(k => counts[k].length === 2).map(Number).sort((a, b) => b - a);

    if (quadKeys.length > 0) {
      const quadCards = counts[quadKeys[0]].map(c => this.formatCardText(c)).join(' ');
      return { score: 8, rankName: `Four of a Kind (${quadCards})`, cards: sorted.slice(0, 5) };
    }

    if (tripKeys.length > 0 && (pairKeys.length > 0 || tripKeys.length > 1)) {
      const tripCards = counts[tripKeys[0]].map(c => this.formatCardText(c)).join(' ');
      const pVal = tripKeys.length > 1 ? tripKeys[1] : pairKeys[0];
      const pairCards = counts[pVal].slice(0, 2).map(c => this.formatCardText(c)).join(' ');
      return { score: 7, rankName: `Full House (${tripCards} ${pairCards})`, cards: sorted.slice(0, 5) };
    }

    if (flushCards) {
      const topFlushCard = this.formatCardText(flushCards[0]);
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
          const matchCard = sorted.find(c => this.getCardValue(c) === targetV);
          if (matchCard) straightCards.push(matchCard);
        }

        return { score: 5, rankName: `Straight (High ${topLabel})`, cards: straightCards };
      }
    }

    if (tripKeys.length === 1) {
      const tripCards = counts[tripKeys[0]].map(c => this.formatCardText(c)).join(' ');
      return { score: 4, rankName: `Three of a Kind (${tripCards})`, cards: sorted.slice(0, 5) };
    }

    if (pairKeys.length >= 2) {
      const p1 = counts[pairKeys[0]].map(c => this.formatCardText(c)).join(' ');
      const p2 = counts[pairKeys[1]].map(c => this.formatCardText(c)).join(' ');
      return { score: 3, rankName: `Two Pair (${p1} & ${p2})`, cards: sorted.slice(0, 5) };
    }

    if (pairKeys.length === 1) {
      const pairVal = pairKeys[0];
      const pairCards = counts[pairVal].map(c => this.formatCardText(c)).join(' ');
      const kickers = sorted.filter(c => this.getCardValue(c) !== pairVal);
      const topKicker = kickers.length > 0 ? this.formatCardText(kickers[0]) : '';

      return { 
        score: 2, 
        rankName: `One Pair (${pairCards}) - Kicker [${topKicker}]`, 
        cards: sorted.slice(0, 5) 
      };
    }

    const topCard = this.formatCardText(sorted[0]);
    return { score: 1, rankName: `High Card (${topCard})`, cards: sorted.slice(0, 5) };
  }

  // 7. ANALISIS ANCAMAN MEJA UNIVERSAL
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

    const commRanks = comm.map(c => this.getCardValue(c)).sort((a, b) => b - a);
    const maxRank = commRanks[0];
    const maxLabel = maxRank === 14 ? 'A' : maxRank === 13 ? 'K' : maxRank === 12 ? 'Q' : maxRank === 11 ? 'J' : maxRank;

    const suitCounts = {};
    comm.forEach(c => {
      const s = this.getCardSuitSymbol(c);
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === maxSuitCount);

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
    } else if (maxSuitCount >= 3) {
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
}
