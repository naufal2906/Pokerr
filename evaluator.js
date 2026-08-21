import { RANKS, SUITS } from './card.js';

export class PokerEvaluator {
  static getValidCards(cards) {
    return (cards || []).filter(c => c && (c.rank || c.value));
  }

  // Helper Format Kartu ke Teks Simbol (Contoh: "10♣")
  static formatCardText(card) {
    if (!card) return '';
    const label = card.rank ? card.rank.label : (card.label || card.value);
    const symbol = card.suit ? (card.suit.symbol || card.suit) : '';
    return `${label}${symbol}`;
  }

  // 1. EVALUASI KARTU TANGAN MURNI (HOLE CARDS)
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

    const s1 = c1.suit ? (c1.suit.symbol || c1.suit) : c1.suit;
    const s2 = c2.suit ? (c2.suit.symbol || c2.suit) : c2.suit;
    const type = (s1 === s2) ? "Suited" : "Offsuit";

    return `${txt1} ${txt2} (${type})`;
  }

  // 2. DETEKSI DRAW (STRAIGHT & FLUSH DRAW DENGAN FILTER KARTU JADI)
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
      const s = c.suit ? (c.suit.symbol || c.suit) : c.suit;
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

  // 3. MATRIKS ANALISIS ANCAMAN MEJA & WORST-CASE DENGAN BLOCKER EFFECT
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
    const uniqueCommRanks = [...new Set(commRanks)].sort((a, b) => a - b);

    // Hitung Kembang Komunitas
    const suitCounts = {};
    comm.forEach(c => {
      const s = c.suit ? (c.suit.symbol || c.suit) : c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === maxSuitCount);
    const boardHasFlush = maxSuitCount >= 3;

    // Hitung Pair / Trips di Meja Komunitas
    const rankCounts = {};
    commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const boardHasPair = Object.values(rankCounts).some(count => count >= 2);
    const boardHasTrips = Object.values(rankCounts).some(count => count >= 3);

    // Hitung Potential Straight di Meja Komunitas
    let boardHasStraight = false;
    let straightNeeds = [];
    const checkRanks = [...uniqueCommRanks];
    if (checkRanks.includes(14)) checkRanks.unshift(1);

    for (let target = 2; target <= 14; target++) {
      const windowCards = checkRanks.filter(r => r >= target - 4 && r <= target);
      if (windowCards.length >= 3) {
        const minW = Math.min(...windowCards);
        const maxW = Math.max(...windowCards);
        if (maxW - minW <= 4) {
          boardHasStraight = true;
          for (let fill = target - 4; fill <= target; fill++) {
            if (fill >= 1 && !checkRanks.includes(fill)) {
              const label = fill === 1 || fill === 14 ? 'A' : fill === 13 ? 'K' : fill === 12 ? 'Q' : fill === 11 ? 'J' : fill;
              straightNeeds.push(label);
            }
          }
        }
      }
    }
    straightNeeds = [...new Set(straightNeeds)];

    // ANCAMAN REALISTIS DAN PENENTUAN SKOR MEJA (MAX BOARD SCORE)
    let maxBoardScore = 1;
    let highestBoardComboName = "";
    let worstCaseMessage = "";

    // A. POTENSI TRIPS / PAIR MEJA (Quads / Full House)
    if (boardHasTrips || boardHasPair) {
      maxBoardScore = boardHasTrips ? 8 : 7;
      highestBoardComboName = boardHasTrips ? "Four of a Kind (Quads)" : "Full House / Trips";
      
      const tripOrPairRanks = Object.keys(rankCounts)
        .filter(r => rankCounts[r] >= 2)
        .map(r => r == 14 ? 'A' : r == 13 ? 'K' : r == 12 ? 'Q' : r == 11 ? 'J' : r);

      if (boardHasTrips) {
        worstCaseMessage = `🚨 <b>POTENSI QUADS / FULL HOUSE:</b> Di meja ada Trips [${tripOrPairRanks.join(', ')}]. Waspada lawan memegang Four of a Kind atau Full House lebih tinggi.`;
      } else {
        worstCaseMessage = `🏠 <b>MEJA BERPASANGAN [${tripOrPairRanks.join(', ')}]:</b> Waspada Two Pair / Pair di meja berkembang menjadi Full House jika lawan memegang Set / Pair pendamping.`;
      }
    } 
    // B. POTENSI FLUSH MEJA
    else if (boardHasFlush) {
      maxBoardScore = 6;
      highestBoardComboName = `Flush (Kembang ${flushSuit})`;
      worstCaseMessage = `🌊 <b>POTENSI FLUSH:</b> Meja ada 3+ kembang ${flushSuit}! Lawan yang membawa kembang ${flushSuit} jadi Flush (Score 6).`;
    } 
    // C. POTENSI STRAIGHT MEJA
    else if (boardHasStraight) {
      maxBoardScore = 5;
      highestBoardComboName = "Straight (Urutan 5 Kartu)";
      const needsTxt = straightNeeds.length > 0 ? straightNeeds.join(' atau ') : 'Pelengkap';
      worstCaseMessage = `🎯 <b>POTENSI STRAIGHT:</b> Meja punya urutan terhubung! Lawan yang membawa kartu [${needsTxt}] otomatis jadi Straight (Score 5).`;
    } 
    // D. PAPAN KERING (DRY BOARD)
    else {
      maxBoardScore = 2;
      const maxRank = Math.max(...commRanks);
      const maxLabel = maxRank === 14 ? 'A' : maxRank === 13 ? 'K' : maxRank === 12 ? 'Q' : maxRank === 11 ? 'J' : maxRank;
      highestBoardComboName = `Top Pair / One Pair (${maxLabel})`;
      worstCaseMessage = `⚡ <b>PAPAN KERING:</b> Tidak ada potensi Straight/Flush/Full House di meja ini.`;
    }

    // PENENTUAN INDIKATOR KOMPARASI HIERARKI (^ / = / v) + BLOCKER EFFECT
    const isOverpair = validHand.length === 2 && 
                       validHand[0].rank.value === validHand[1].rank.value && 
                       validHand[0].rank.value > Math.max(...commRanks);

    if (myScore > maxBoardScore || (myScore === 2 && isOverpair && maxBoardScore <= 2)) {
      threats.push({
        text: `KARTU TANGAN DI ATAS POTENSI MEJA (^)`,
        boardPotential: `Potensi Meja: ${highestBoardComboName} | Milik Anda: ${myBest.rankName}`,
        worstCase: `✅ KARTU AMAN! Kombinasi kartu Anda (${myBest.rankName}) melampaui potensi maksimal meja saat ini.`,
        indicator: "^",
        safe: true
      });
    } else if (myScore === maxBoardScore) {
      threats.push({
        text: `KOMBINASI SETARA DENGAN POTENSI MEJA (=)`,
        boardPotential: `Potensi Meja: ${highestBoardComboName} | Milik Anda: ${myBest.rankName}`,
        worstCase: `⚠️ KARTU SETARA (=)! Kombinasi Anda setara dengan potensi meja, adu Kicker jika lawan punya kartu sama.`,
        indicator: "=",
        safe: true
      });
    } else {
      threats.push({
        text: `POTENSI MEJA DI ATAS KARTU TANGAN (v)`,
        boardPotential: `Potensi Meja: ${highestBoardComboName} | Milik Anda: ${myBest.rankName}`,
        worstCase: worstCaseMessage,
        indicator: "v",
        safe: false
      });
    }

    return threats;
  }

  // 4. MENGHITUNG WIN EQUITY
  static calculateStrength(holeCards, communityCards) {
    const validHand = this.getValidCards(holeCards);
    if (validHand.length < 2) return 0;

    const validComm = this.getValidCards(communityCards);
    const best = this.getBestHand([...validHand, ...validComm]);

    if (validComm.length === 0) {
      const v1 = validHand[0].rank ? validHand[0].rank.value : validHand[0].value;
      const v2 = validHand[1].rank ? validHand[1].rank.value : validHand[1].value;
      if (v1 === v2) return Math.min(85, 50 + v1 * 2.5);
      return Math.min(65, 20 + Math.max(v1, v2) * 2.5);
    }

    const scoreMap = { 10: 100, 9: 99, 8: 98, 7: 92, 6: 88, 5: 80, 4: 65, 3: 55, 2: 40, 1: 20 };
    let equity = scoreMap[best.score] || 20;

    const draws = this.detectDraws(validHand, validComm);
    if (draws.length > 0) equity = Math.min(92, equity + 12);

    return Math.round(equity);
  }

  // 5. EVALUASI LENGKAP 5 KARTU TERBAIK (AKURAT DENGAN DETEKSI UPGRADE TWO PAIR & THREE OF A KIND)
  static getBestHand(cards) {
    const valid = this.getValidCards(cards);
    if (valid.length === 0) return { score: 0, rankName: "-", cards: [] };

    const sorted = [...valid].sort((a, b) => {
      const va = a.rank ? a.rank.value : a.value;
      const vb = b.rank ? b.rank.value : b.value;
      return vb - va;
    });

    const values = [...new Set(sorted.map(c => c.rank ? c.rank.value : c.value))].sort((a, b) => b - a);

    // A. Straight Flush / Royal Flush
    const suitGroups = {};
    sorted.forEach(c => {
      const s = c.suit ? (c.suit.symbol || c.suit) : c.suit;
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

    // B. Straight Biasa
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

    // C. Flush Biasa
    if (flushCards) {
      return { score: 6, rankName: `Flush`, cards: flushCards.slice(0, 5) };
    }

    // HITUNG FREKUENSI MUNCUL MINGGUAN NILAI KARTU
    const counts = {};
    sorted.forEach(c => {
      const v = c.rank ? c.rank.value : c.value;
      counts[v] = counts[v] || [];
      counts[v].push(c);
    });

    const quadKeys = Object.keys(counts).filter(k => counts[k].length === 4).map(Number).sort((a, b) => b - a);
    const tripKeys = Object.keys(counts).filter(k => counts[k].length === 3).map(Number).sort((a, b) => b - a);
    const pairKeys = Object.keys(counts).filter(k => counts[k].length === 2).map(Number).sort((a, b) => b - a);

    // D. Four of a Kind (Quads)
    if (quadKeys.length > 0) {
      const quadCards = counts[quadKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 8, rankName: `Four of a Kind (${quadCards})`, cards: sorted.slice(0, 5) };
    }

    // E. Full House (Bisa Berasal dari Upgrade Trips + Pair ATAU 2 Trips Sekaligus)
    if (tripKeys.length > 0 && (pairKeys.length > 0 || tripKeys.length > 1)) {
      const tripCards = counts[tripKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const pVal = tripKeys.length > 1 ? tripKeys[1] : pairKeys[0];
      const pairCards = counts[pVal].slice(0, 2).map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 7, rankName: `Full House (${tripCards} ${pairCards})`, cards: sorted.slice(0, 5) };
    }

    // F. Three of a Kind (Trips / Set Murni)
    if (tripKeys.length === 1) {
      const tripCards = counts[tripKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 4, rankName: `Three of a Kind (${tripCards})`, cards: sorted.slice(0, 5) };
    }

    // G. Two Pair
    if (pairKeys.length >= 2) {
      const p1 = counts[pairKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const p2 = counts[pairKeys[1]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 3, rankName: `Two Pair (${p1} & ${p2})`, cards: sorted.slice(0, 5) };
    }

    // H. One Pair + Kicker
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

    // I. High Card
    const topCard = this.formatCardText(sorted[0]);
    return { score: 1, rankName: `High Card (${topCard})`, cards: sorted.slice(0, 5) };
  }
}
