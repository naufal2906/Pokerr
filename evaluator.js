import { RANKS, SUITS } from './card.js';

export class PokerEvaluator {
  static getValidCards(cards) {
    return (cards || []).filter(c => c && (c.rank || c.value));
  }

  // Format Helper: Kartu ke Teks Simbol (Contoh: "10♣")
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

  // 2. DETEKSI DRAW (STRAIGHT & FLUSH DRAW)
  static detectDraws(holeCards, communityCards) {
    const all = [...this.getValidCards(holeCards), ...this.getValidCards(communityCards)];
    if (all.length < 4) return [];

    const draws = [];
    const values = [...new Set(all.map(c => c.rank ? c.rank.value : c.value))].sort((a, b) => a - b);
    
    // Cek Flush Draw
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

    // Cek Straight Draw
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

  // 3. ANALISIS ANCAMAN MEJA & WORST-CASE SCENARIO DARI 3 SAMPAI 5 KARTU MEJA
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

    const ranks = comm.map(c => c.rank ? c.rank.value : c.value).sort((a, b) => b - a);
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);

    // 1. Cek Potensi Flush (3+ Kembang Sama di Meja = Score 6)
    const suitCounts = {};
    comm.forEach(c => {
      const s = c.suit ? (c.suit.symbol || c.suit) : c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === maxSuitCount);
    const boardHasFlush = maxSuitCount >= 3;

    // 2. Cek Pair/Trips di Meja (Full House = Score 7, Quads = Score 8)
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const boardHasPair = Object.values(rankCounts).some(count => count >= 2);
    const boardHasTrips = Object.values(rankCounts).some(count => count >= 3);

    // 3. Cek Potensi Straight (3 atau 4 Kartu Terhubung / Celah Gap di Meja = Score 5)
    let boardHasStraight = false;
    let straightNeeds = [];
    const checkRanks = [...uniqueRanks];
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

    // SKOR MAKSIMAL KARTU MEJA (MAX BOARD SCORE)
    let maxBoardScore = 1;
    let highestBoardComboName = "";
    let worstCaseMessage = "";

    if (boardHasFlush && boardHasStraight) {
      maxBoardScore = 9;
      highestBoardComboName = "Straight Flush";
      worstCaseMessage = `🚨 KEMUNGKINAN TERBURUK: Potensi Straight Flush / Flush Tinggi Lawan!`;
    } else if (boardHasTrips || boardHasPair) {
      maxBoardScore = boardHasTrips ? 8 : 7;
      highestBoardComboName = boardHasTrips ? "Four of a Kind (Quads)" : "Full House / Trips";
      worstCaseMessage = `🚨 KEMUNGKINAN TERBURUK: Lawan Pegang Full House atau Three of a Kind Tinggi!`;
    } else if (boardHasFlush) {
      maxBoardScore = 6; // Flush > Three of a Kind
      highestBoardComboName = `Flush (Kembang ${flushSuit})`;
      worstCaseMessage = `🚨 KEMUNGKINAN TERBURUK: Meja ada 3+ kembang ${flushSuit}! Lawan pegang Flush (Score 6) mengalahkan kartu Anda!`;
    } else if (boardHasStraight) {
      maxBoardScore = 5; // Straight > Three of a Kind
      highestBoardComboName = "Straight (Urutan 5 Kartu)";
      const needsTxt = straightNeeds.length > 0 ? straightNeeds.join(' atau ') : 'Kartu Pelengkap';
      worstCaseMessage = `🚨 KEMUNGKINAN TERBURUK: Meja punya urutan terhubung! Lawan pegang kartu [${needsTxt}] jadi Straight (Score 5) mengalahkan kartu Anda!`;
    } else {
      maxBoardScore = 4; // Papan Kering
      const maxRank = Math.max(...ranks);
      const maxLabel = maxRank === 14 ? 'A' : maxRank === 13 ? 'K' : maxRank === 12 ? 'Q' : maxRank === 11 ? 'J' : maxRank;
      highestBoardComboName = `Three of a Kind / Set (${maxLabel}s)`;
      worstCaseMessage = `⚠️ KEMUNGKINAN TERBURUK: Lawan Pegang Set (${maxLabel}s) atau Overpair Kicker Tinggi.`;
    }

    // PERBANDINGAN HIERARKI: SKOR KARTU TANGAN (myScore) VS POTENSI MEJA (maxBoardScore)
    if (myScore > maxBoardScore) {
      threats.push({
        text: `KARTU TANGAN DI ATAS POTENSI MEJA (^)`,
        boardPotential: `Potensi Meja: ${highestBoardComboName} | Milik Anda: ${myBest.rankName}`,
        worstCase: `✅ KARTU AMAN! Kombinasi kartu Anda melampaui potensi maksimal meja saat ini.`,
        indicator: "^",
        safe: true
      });
    } else if (myScore === maxBoardScore) {
      threats.push({
        text: `KOMBINASI SETARA DENGAN POTENSI MEJA (=)`,
        boardPotential: `Potensi Meja: ${highestBoardComboName} | Milik Anda: ${myBest.rankName}`,
        worstCase: `⚠️ KARTU SETARA (=)! Kombinasi Anda setara dengan potensi meja, waspada lawan menang Kicker.`,
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

    const scoreMap = { 10: 100, 9: 99, 8: 98, 7: 90, 6: 85, 5: 75, 4: 65, 3: 55, 2: 45, 1: 25 };
    let equity = scoreMap[best.score] || 20;

    const draws = this.detectDraws(validHand, validComm);
    if (draws.length > 0) equity = Math.min(92, equity + 15);

    return Math.round(equity);
  }

  // 5. EVALUASI 5 KARTU TERBAIK (DETAIL KICKER)
  static getBestHand(cards) {
    const valid = this.getValidCards(cards);
    if (valid.length === 0) return { score: 0, rankName: "-", cards: [] };

    const sorted = [...valid].sort((a, b) => {
      const va = a.rank ? a.rank.value : a.value;
      const vb = b.rank ? b.rank.value : b.value;
      return vb - va;
    });

    const counts = {};
    sorted.forEach(c => {
      const v = c.rank ? c.rank.value : c.value;
      counts[v] = counts[v] || [];
      counts[v].push(c);
    });

    const pairKeys = Object.keys(counts).filter(k => counts[k].length === 2).map(Number).sort((a, b) => b - a);

    // Four of a Kind
    if (Object.values(counts).some(arr => arr.length === 4)) {
      const quadKey = Object.keys(counts).find(k => counts[k].length === 4);
      const quadCards = counts[quadKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 8, rankName: `Four of a Kind (${quadCards})`, cards: sorted.slice(0, 5) };
    }

    // Full House
    if (Object.values(counts).some(arr => arr.length === 3) && pairKeys.length > 0) {
      const tripKey = Object.keys(counts).find(k => counts[k].length === 3);
      const tripCards = counts[tripKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const pairCards = counts[pairKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 7, rankName: `Full House (${tripCards} ${pairCards})`, cards: sorted.slice(0, 5) };
    }

    // Three of a Kind
    if (Object.values(counts).some(arr => arr.length === 3)) {
      const tripKey = Object.keys(counts).find(k => counts[k].length === 3);
      const tripCards = counts[tripKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 4, rankName: `Three of a Kind (${tripCards})`, cards: sorted.slice(0, 5) };
    }

    // Two Pair
    if (pairKeys.length >= 2) {
      const p1 = counts[pairKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const p2 = counts[pairKeys[1]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 3, rankName: `Two Pair (${p1} & ${p2})`, cards: sorted.slice(0, 5) };
    }

    // One Pair + Kicker
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

    // High Card
    const topCard = this.formatCardText(sorted[0]);
    return { score: 1, rankName: `High Card (${topCard})`, cards: sorted.slice(0, 5) };
  }
}
