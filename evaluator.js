import { RANKS, SUITS } from './card.js';

export class PokerEvaluator {
  static getValidCards(cards) {
    return (cards || []).filter(c => c && (c.rank || c.value));
  }

  // Format Helper: Mengubah objek kartu menjadi string ber-simbol (misal: "10♣")
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
    
    // Cek Flush Draw (4 kartu sejenis)
    const suitCounts = {};
    all.forEach(c => {
      const s = c.suit ? (c.suit.symbol || c.suit) : c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    Object.keys(suitCounts).forEach(s => {
      if (suitCounts[s] === 4) {
        draws.push(`🌊 **Flush Draw!** Butuh 1 kartu kembang ${s} lagi.`);
      }
    });

    // Cek Straight Draw (4 kartu berurutan)
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
              draws.push(`🎯 **Straight Draw!** Butuh 1 kartu [${neededLabel}] lagi.`);
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

  // 3. ANALISIS ANCAMAN MEJA & THE NUTS
  static analyzeBoardThreats(communityCards) {
    const comm = this.getValidCards(communityCards);
    if (comm.length < 3) return [{ text: "Menunggu Flop (Minimal 3 Kartu)", safe: true }];

    const threats = [];
    const ranks = comm.map(c => c.rank ? c.rank.value : c.value).sort((a, b) => b - a);

    const suitCounts = {};
    comm.forEach(c => {
      const s = c.suit ? (c.suit.symbol || c.suit) : c.suit;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });

    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);

    const isFlushThreat = Object.values(suitCounts).some(count => count >= 3);
    const maxCommRank = Math.max(...ranks);
    const maxLabel = maxCommRank === 14 ? 'A' : maxCommRank === 13 ? 'K' : maxCommRank === 12 ? 'Q' : maxCommRank === 11 ? 'J' : maxCommRank;

    const pairs = Object.keys(rankCounts).filter(r => rankCounts[r] >= 2);
    if (pairs.length > 0) {
      threats.push({
        text: `⚠️ Meja Ada Pair! Waspada Full House / Trips lawan.`,
        nutText: `Kartu Lawan Terkuat: Set / Trips / Full House`,
        safe: false
      });
    }

    if (isFlushThreat) {
      threats.push({
        text: `🌊 Papan Ada 3+ Kartu Sejenis! Potensi Flush Tinggi.`,
        nutText: `Kartu Terkuat (The Nuts): Flush`,
        safe: false
      });
    }

    if (!isFlushThreat && pairs.length === 0) {
      threats.push({
        text: `⚡ Papan Relatif Basah (Kartu Tertinggi: ${maxLabel}).`,
        nutText: `Waspada Lawan Pegang Overpair (${maxLabel}+) atau Straight Connector.`,
        safe: true
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

    const scoreMap = { 9: 98, 8: 95, 7: 90, 6: 85, 5: 75, 4: 65, 3: 55, 2: 45, 1: 25 };
    let equity = scoreMap[best.score] || 20;

    const draws = this.detectDraws(validHand, validComm);
    if (draws.length > 0) equity = Math.min(92, equity + 15);

    return Math.round(equity);
  }

  // 5. EVALUASI 5 KARTU TERBAIK
  static getBestHand(cards) {
    const valid = this.getValidCards(cards);
    if (valid.length === 0) return { score: 0, rankName: "-", cards: [] };

    const values = valid.map(c => c.rank ? c.rank.value : c.value).sort((a, b) => b - a);
    const counts = {};
    valid.forEach(c => {
      const v = c.rank ? c.rank.value : c.value;
      counts[v] = counts[v] || [];
      counts[v].push(c);
    });

    const countLengths = Object.keys(counts).map(k => counts[k].length);

    // Four of a Kind
    if (countLengths.includes(4)) {
      const quadKey = Object.keys(counts).find(k => counts[k].length === 4);
      const quadCards = counts[quadKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 8, rankName: `Four of a Kind (${quadCards})`, cards: valid.slice(0, 5) };
    }

    // Full House
    if (countLengths.includes(3) && countLengths.includes(2)) {
      const tripKey = Object.keys(counts).find(k => counts[k].length === 3);
      const pairKey = Object.keys(counts).find(k => counts[k].length === 2);
      const tripCards = counts[tripKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const pairCards = counts[pairKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 7, rankName: `Full House (${tripCards} ${pairCards})`, cards: valid.slice(0, 5) };
    }

    // Three of a Kind
    if (countLengths.includes(3)) {
      const tripKey = Object.keys(counts).find(k => counts[k].length === 3);
      const tripCards = counts[tripKey].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 4, rankName: `Three of a Kind (${tripCards})`, cards: valid.slice(0, 5) };
    }

    // Two Pair
    const pairKeys = Object.keys(counts).filter(k => counts[k].length === 2);
    if (pairKeys.length >= 2) {
      const p1 = counts[pairKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      const p2 = counts[pairKeys[1]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 3, rankName: `Two Pair (${p1} & ${p2})`, cards: valid.slice(0, 5) };
    }

    // One Pair
    if (pairKeys.length === 1) {
      const pairCards = counts[pairKeys[0]].map(c => PokerEvaluator.formatCardText(c)).join(' ');
      return { score: 2, rankName: `One Pair (${pairCards})`, cards: valid.slice(0, 5) };
    }

    // High Card
    const topCard = this.formatCardText(valid[0]);
    return { score: 1, rankName: `High Card (${topCard})`, cards: valid.slice(0, 5) };
  }
}
