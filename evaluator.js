class PokerEvaluator {
  static RANKS = [
    { value: 14, label: 'A' }, { value: 13, label: 'K' }, { value: 12, label: 'Q' },
    { value: 11, label: 'J' }, { value: 10, label: '10' }, { value: 9, label: '9' },
    { value: 8, label: '8' }, { value: 7, label: '7' }, { value: 6, label: '6' },
    { value: 5, label: '5' }, { value: 4, label: '4' }, { value: 3, label: '3' },
    { value: 2, label: '2' }
  ];

  static SUITS = ['♠', '♥', '♣', '♦'];

  static getValidCards(cards) {
    return (cards || []).filter(c => c && c.label && c.suit);
  }

  static formatCardText(card) {
    return `${card.label}${card.suit}`;
  }

  static getCardSuitSymbol(card) {
    return card.suit;
  }

  // Evaluasi 5 kartu terbaik dari maksimal 7 kartu (Aturan Baku Best 5-Card Hand)
  static getBestHand(cards) {
    const valid = this.getValidCards(cards);
    if (valid.length < 5) {
      return this.evaluatePartial(valid);
    }

    const combos = this.getCombinations(valid, 5);
    let best = { score: 0, rankName: 'High Card', tieBreaker: [] };

    for (const combo of combos) {
      const res = this.evaluate5Cards(combo);
      if (this.compareHands(res, best) > 0) {
        best = res;
      }
    }
    return best;
  }

  static evaluatePartial(cards) {
    if (cards.length === 0) return { score: 0, rankName: '-', tieBreaker: [] };
    const counts = {};
    cards.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);
    const vals = Object.values(counts).sort((a, b) => b - a);
    if (vals[0] === 4) return { score: 8, rankName: 'Four of a Kind', tieBreaker: [] };
    if (vals[0] === 3 && vals[1] === 2) return { score: 7, rankName: 'Full House', tieBreaker: [] };
    if (vals[0] === 3) return { score: 4, rankName: 'Three of a Kind', tieBreaker: [] };
    if (vals[0] === 2 && vals[1] === 2) return { score: 3, rankName: 'Two Pair', tieBreaker: [] };
    if (vals[0] === 2) return { score: 2, rankName: 'One Pair', tieBreaker: [] };
    return { score: 1, rankName: 'High Card', tieBreaker: [] };
  }

  static evaluate5Cards(cards) {
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    const values = sorted.map(c => c.value);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = false;
    let straightHigh = 0;

    const uniqueVals = [...new Set(values)];
    if (uniqueVals.length === 5) {
      if (uniqueVals[0] - uniqueVals[4] === 4) {
        isStraight = true;
        straightHigh = uniqueVals[0];
      } else if (
        uniqueVals[0] === 14 && uniqueVals[1] === 5 &&
        uniqueVals[2] === 4 && uniqueVals[3] === 3 && uniqueVals[4] === 2
      ) {
        isStraight = true;
        straightHigh = 5;
      }
    }

    if (isFlush && isStraight) {
      if (straightHigh === 14) return { score: 10, rankName: 'Royal Flush', tieBreaker: [14] };
      return { score: 9, rankName: 'Straight Flush', tieBreaker: [straightHigh] };
    }

    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const groups = Object.entries(counts)
      .map(([val, count]) => ({ val: Number(val), count }))
      .sort((a, b) => b.count - a.count || b.val - a.val);

    if (groups[0].count === 4) {
      return { score: 8, rankName: 'Four of a Kind', tieBreaker: [groups[0].val, groups[1].val] };
    }
    if (groups[0].count === 3 && groups[1].count === 2) {
      return { score: 7, rankName: 'Full House', tieBreaker: [groups[0].val, groups[1].val] };
    }
    if (isFlush) {
      return { score: 6, rankName: 'Flush', tieBreaker: values };
    }
    if (isStraight) {
      return { score: 5, rankName: 'Straight', tieBreaker: [straightHigh] };
    }
    if (groups[0].count === 3) {
      return {
        score: 4,
        rankName: 'Three of a Kind',
        tieBreaker: [groups[0].val, groups[1].val, groups[2].val]
      };
    }
    if (groups[0].count === 2 && groups[1].count === 2) {
      return {
        score: 3,
        rankName: 'Two Pair',
        tieBreaker: [groups[0].val, groups[1].val, groups[2].val]
      };
    }
    if (groups[0].count === 2) {
      return {
        score: 2,
        rankName: 'One Pair',
        tieBreaker: [groups[0].val, groups[1].val, groups[2].val, groups[3].val]
      };
    }
    return { score: 1, rankName: 'High Card', tieBreaker: values };
  }

  static compareHands(a, b) {
    if (a.score !== b.score) return a.score - b.score;
    for (let i = 0; i < Math.max(a.tieBreaker.length, b.tieBreaker.length); i++) {
      const va = a.tieBreaker[i] || 0;
      const vb = b.tieBreaker[i] || 0;
      if (va !== vb) return va - vb;
    }
    return 0;
  }

  static getCombinations(arr, k) {
    const res = [];
    const helper = (start, combo) => {
      if (combo.length === k) {
        res.push(combo);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        helper(i + 1, [...combo, arr[i]]);
      }
    };
    helper(0, []);
    return res;
  }

  static detectDraws(holeCards, communityCards) {
    const all = [...this.getValidCards(holeCards), ...this.getValidCards(communityCards)];
    if (all.length < 4 || all.length >= 7) return [];

    const draws = [];
    const suitCounts = {};
    all.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
    if (Object.values(suitCounts).some(cnt => cnt === 4)) {
      draws.push('Flush Draw');
    }

    const vals = [...new Set(all.map(c => c.value))].sort((a, b) => a - b);
    if (vals.includes(14)) vals.unshift(1);

    let hasOESD = false;
    let hasGutshot = false;
    for (let target = 5; target <= 14; target++) {
      const windowVals = vals.filter(v => v >= target - 4 && v <= target);
      if (windowVals.length === 4) {
        const missing = [target - 4, target - 3, target - 2, target - 1, target].find(x => !windowVals.includes(x));
        if (missing === target || missing === target - 4) hasOESD = true;
        else hasGutshot = true;
      }
    }
    if (hasOESD) draws.push('Open-Ended Straight Draw');
    else if (hasGutshot) draws.push('Gutshot Straight Draw');

    return draws;
  }

  // KALKULATOR HUD RINGKAS (OUTS ATAS + ANCAMAN MEJA + TARGET KITA + KEPUTUSAN BET)
  static getHudSummary(holeCards, communityCards, deadCards = [], currentPot = 0, oppBet = 0) {
    const validHole = this.getValidCards(holeCards);
    const validComm = this.getValidCards(communityCards);
    if (validHole.length < 2) return null;

    const allKnown = [...validHole, ...validComm];
    const usedSet = new Set([
      ...allKnown.map(c => this.formatCardText(c)),
      ...deadCards
    ]);

    // 1. Sisa kartu pasangan dari Hole Cards kita di luar meja
    const holeOutCards = [];
    validHole.forEach(hc => {
      this.SUITS.forEach(s => {
        const cardCode = `${hc.label}${s}`;
        if (!usedSet.has(cardCode)) holeOutCards.push(cardCode);
      });
    });

    // 2. Bangun sisa dek
    const remainingDeck = [];
    this.RANKS.forEach(r => {
      this.SUITS.forEach(s => {
        const text = `${r.label}${s}`;
        if (!usedSet.has(text)) remainingDeck.push({ value: r.value, label: r.label, suit: s, text });
      });
    });

    const unseen = remainingDeck.length || 1;
    const cardsToCome = validComm.length === 3 ? 2 : validComm.length === 4 ? 1 : 0;
    const currentBest = this.getBestHand(allKnown);

    // 3. Target Terkuat Kartu Kita + Persentase Efektif
    let bestTargetText = 'Menunggu Flop';
    let heroWinEst = 50;
    let isDominatedLowPair = false;

    if (validComm.length === 0) {
      const v1 = validHole[0].value;
      const v2 = validHole[1].value;
      const suited = validHole[0].suit === validHole[1].suit;
      if (v1 === v2) heroWinEst = v1 >= 11 ? 82 : 68;
      else if (v1 >= 12 && v2 >= 12) heroWinEst = suited ? 67 : 64;
      else heroWinEst = suited ? 54 : 48;
      bestTargetText = `Pre-Flop Equity ~${heroWinEst}%`;
    } else if (validComm.length >= 3) {
      const suitCounts = {};
      allKnown.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
      const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === 4);
      const draws = this.detectDraws(holeCards, communityCards);
      const hasOESD = draws.some(d => d.includes('Open-Ended'));
      const hasGutshot = draws.some(d => d.includes('Gutshot'));

      const calcProb = (outs) => {
        if (cardsToCome === 2) {
          const miss1 = (unseen - outs) / unseen;
          const miss2 = (unseen - 1 - outs) / Math.max(1, unseen - 1);
          return Math.round((1 - miss1 * miss2) * 100);
        } else if (cardsToCome === 1) {
          return Math.round((outs / unseen) * 100);
        }
        return 0;
      };

      const maxCommVal = Math.max(...validComm.map(c => c.value));
      const maxHoleVal = Math.max(...validHole.map(c => c.value));
      const uniqueHoleOutCount = [...new Set(holeOutCards)].length;

      if (currentBest.score >= 5) {
        heroWinEst = currentBest.score >= 7 ? 96 : currentBest.score === 6 ? 86 : 80;
        bestTargetText = `${currentBest.rankName} 100% (Sudah Jadi)`;
      } else if (flushSuit && cardsToCome > 0) {
        const flushOuts = remainingDeck.filter(c => c.suit === flushSuit).length;
        const prob = calcProb(flushOuts);
        heroWinEst = currentBest.score >= 2 ? Math.min(72, prob + 18) : prob;
        bestTargetText = `Flush ${prob}% (Kurang 1 Kartu ${flushSuit})`;
      } else if (hasOESD && cardsToCome > 0) {
        const prob = calcProb(8);
        heroWinEst = currentBest.score >= 2 ? Math.min(68, prob + 16) : prob;
        bestTargetText = `Straight ${prob}% (Kurang 1 Kartu Ujung)`;
      } else if (hasGutshot && cardsToCome > 0) {
        const prob = calcProb(4);
        heroWinEst = currentBest.score >= 2 ? Math.min(55, prob + 15) : prob;
        bestTargetText = `Straight ${prob}% (Kurang 1 Kartu Tengah)`;
      } else if (currentBest.score === 4) {
        heroWinEst = 84;
        bestTargetText = cardsToCome > 0
          ? `Full House / Quads ${calcProb(7)}% (Kurang 1 Kartu Kembar)`
          : `Three of a Kind 100% (Sudah Jadi)`;
      } else if (currentBest.score === 3) {
        heroWinEst = 74;
        bestTargetText = cardsToCome > 0
          ? `Full House ${calcProb(4)}% (Kurang 1 Kartu Pair)`
          : `Two Pair 100% (Sudah Jadi)`;
      } else if (currentBest.score === 2) {
        const prob = calcProb(uniqueHoleOutCount);
        if (maxHoleVal < maxCommVal) {
          isDominatedLowPair = true;
          heroWinEst = cardsToCome > 0 ? Math.max(15, prob) : 18;
          bestTargetText = cardsToCome > 0
            ? `Trips / Two Pair ${prob}% (Kurang 1 Kartu ${validHole.map(c => c.label).join('/')}) • ⚠️ Pair Bawah`
            : `One Pair Bawah • ⚠️ Rawan Top Pair Lawan`;
        } else {
          heroWinEst = 62;
          bestTargetText = cardsToCome > 0
            ? `Top Pair (Upgrade Trips/2Pair ${prob}%)`
            : `Top Pair 100% (Sudah Jadi)`;
        }
      } else {
        const prob = calcProb(uniqueHoleOutCount);
        heroWinEst = cardsToCome > 0 ? prob : 8;
        bestTargetText = cardsToCome > 0
          ? `Top Pair ${prob}% (Kurang 1 Kartu ${validHole.map(c => c.label).join('/')})`
          : `High Card Saja (Tidak Kena)`;
      }
    }

    // 4. Persentase Ancaman Meja Realistis + Deteksi Straight Flush & Nut Blocker
    let boardPctText = 'Belum Ada Kartu Meja';
    let dangerLevel = 0;
    if (validComm.length >= 3) {
      const commSuits = {};
      validComm.forEach(c => commSuits[c.suit] = (commSuits[c.suit] || 0) + 1);
      const maxSuit = Object.keys(commSuits).reduce((a, b) => commSuits[a] > commSuits[b] ? a : b);
      const maxSuitCount = commSuits[maxSuit];
      const remSuitCards = remainingDeck.filter(c => c.suit === maxSuit);

      const threats = [];
      if (maxSuitCount >= 3) {
        dangerLevel = 2;
        const flushRealPct = maxSuitCount === 3 ? 75 : maxSuitCount === 4 ? 92 : 100;

        const suitedRanks = validComm
          .filter(c => c.suit === maxSuit)
          .map(c => c.value)
          .sort((a, b) => a - b);
        if (suitedRanks.includes(14)) suitedRanks.unshift(1);

        let sfConnected = false;
        for (let i = 0; i <= suitedRanks.length - 3; i++) {
          if (suitedRanks[i + 2] - suitedRanks[i] <= 4) {
            sfConnected = true;
            break;
          }
        }
        if (sfConnected) {
          threats.push(`Straight Flush ${maxSuitCount === 3 ? '25%' : '45%'}`);
        }

        const nutCardCode = `A${maxSuit}`;
        const secondNutCode = `K${maxSuit}`;
        const weHoldNut = validHole.some(c => this.formatCardText(c) === nutCardCode);
        const nutStillOut = remSuitCards.some(c => c.text === nutCardCode);
        const secondNutStillOut = remSuitCards.some(c => c.text === secondNutCode);

        let nutWarn = '';
        if (weHoldNut) {
          nutWarn = ` [Nut ${nutCardCode} Aman]`;
          dangerLevel = 0;
        } else if (nutStillOut) {
          nutWarn = ` [Waspada ${nutCardCode}]`;
        } else if (secondNutStillOut) {
          nutWarn = ` [Waspada ${secondNutCode}]`;
        }
        threats.push(`Flush ${flushRealPct}%${nutWarn}`);
      }

      const commRanks = validComm.map(c => c.value);
      const rankCounts = {};
      commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
      const pairCount = Object.values(rankCounts).filter(v => v >= 2).length;
      if (pairCount >= 2) {
        threats.push('Full House 85%');
        dangerLevel = 2;
      } else if (pairCount === 1) {
        threats.push('Full House 65%');
        dangerLevel = Math.max(dangerLevel, 1);
      }

      const uniqueR = [...new Set(commRanks)].sort((a, b) => a - b);
      if (uniqueR.includes(14)) uniqueR.unshift(1);
      let maxWindow = 0;
      for (let t = 5; t <= 14; t++) {
        const cnt = uniqueR.filter(r => r >= t - 4 && r <= t).length;
        if (cnt > maxWindow) maxWindow = cnt;
      }
      if (maxWindow >= 4) {
        threats.push('Straight 80%');
        dangerLevel = 2;
      } else if (maxWindow === 3) {
        threats.push('Straight 55%');
        dangerLevel = Math.max(dangerLevel, 1);
      }

      boardPctText = threats.length > 0 ? threats.join(' • ') : 'Board Kering (Top Pair / Two Pair)';
    }

    const decision = this.evaluatePotDecision(heroWinEst, currentPot, oppBet, isDominatedLowPair, dangerLevel);

    return {
      currentBestName: currentBest.rankName,
      holeOutCards: [...new Set(holeOutCards)],
      bestTargetText,
      boardPctText,
      heroWinEst,
      decision
    };
  }

  static evaluatePotDecision(winPct, pot, bet, isDominatedLowPair, dangerLevel) {
    const p = Number(pot) || 0;
    const b = Number(bet) || 0;

    if (b <= 0) {
      if (winPct >= 70 && dangerLevel < 2) {
        return {
          verdict: 'RAISE / VALUE BET',
          badgeClass: 'verdict-raise',
          detail: `Kartu kuat (${winPct}%). Pancing lawan bayar dengan Raise 2x–3x Blind.`
        };
      }
      return {
        verdict: 'CHECK / BET KECIL',
        badgeClass: 'verdict-call',
        detail: 'Belum ada bet lawan. Ambil kartu gratis (Check) atau pancing tipis.'
      };
    }

    const totalPotAfterCall = p + b;
    const reqEquity = Math.round((b / totalPotAfterCall) * 100);
    const evDiff = winPct - reqEquity;

    if (isDominatedLowPair && b >= p * 0.5) {
      return {
        verdict: 'FOLD (RUGI)',
        badgeClass: 'verdict-fold',
        detail: `Syarat Pot Odds ${reqEquity}%, peluang kita cuma ${winPct}% (Pair Bawah). Jangan kejar!`
      };
    }

    if (winPct >= 72 && dangerLevel < 2) {
      return {
        verdict: 'RAISE / ALL-IN (GAS!)',
        badgeClass: 'verdict-raise',
        detail: `Peluang ${winPct}% vs Syarat ${reqEquity}% (+${evDiff}% EV). Hajar balik!`
      };
    }

    if (winPct >= reqEquity) {
      return {
        verdict: 'CALL (WORTH IT)',
        badgeClass: 'verdict-call',
        detail: `Peluang ${winPct}% ≥ Syarat Pot Odds ${reqEquity}% (+${evDiff}% EV). Layak dikejar!`
      };
    }

    return {
      verdict: 'FOLD (MAHAL)',
      badgeClass: 'verdict-fold',
      detail: `Butuh ${reqEquity}% untuk impas, peluang kita cuma ${winPct}% (${evDiff}% EV). Lepas!`
    };
  }
}
