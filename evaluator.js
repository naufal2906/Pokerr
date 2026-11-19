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

  // KALKULATOR HUD UNIVERSAL (52 KARTU / 4 KEMBANG: RINCIAN TARGET KITA + REALITA MEJA)
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

    // 2. Bangun sisa dek dinamis (52 kartu dikurangi kartu terlihat)
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

    const calcProb = (outs) => {
      if (outs <= 0 || cardsToCome === 0) return 0;
      if (cardsToCome === 2) {
        const miss1 = (unseen - outs) / unseen;
        const miss2 = (unseen - 1 - outs) / Math.max(1, unseen - 1);
        return Math.max(1, Math.round((1 - miss1 * miss2) * 100));
      }
      return Math.max(1, Math.round((outs / unseen) * 100));
    };

    // 3. Rincian Multi-Kemungkinan Kartu Kita (mengerucut setiap fase)
    let bestTargetText = '';
    let heroWinEst = 50;
    let isDominatedLowPair = false;
    const isPocketPair = validHole[0].value === validHole[1].value;

    if (validComm.length === 0) {
      if (isPocketPair) {
        const rLabel = validHole[0].label;
        heroWinEst = validHole[0].value >= 11 ? 82 : 68;
        bestTargetText = `Pocket ${rLabel}-${rLabel}: Set 12% • Full House 1% • Quads 0.2% (Win ~${heroWinEst}%)`;
      } else {
        const v1 = validHole[0].value;
        const v2 = validHole[1].value;
        const suited = validHole[0].suit === validHole[1].suit;
        heroWinEst = (v1 >= 12 && v2 >= 12) ? (suited ? 67 : 64) : (suited ? 54 : 48);
        bestTargetText = suited
          ? `Suited ${validHole[0].suit}: Pair 32% • Flush 6.5% • Straight 4% (Win ~${heroWinEst}%)`
          : `Offsuit: Pair 32% • Two Pair 2% • Straight 3.5% (Win ~${heroWinEst}%)`;
      }
    } else {
      const heroTargets = [];
      const suitCounts = {};
      allKnown.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
      const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === 4);
      const draws = this.detectDraws(holeCards, communityCards);
      const hasOESD = draws.some(d => d.includes('Open-Ended'));
      const hasGutshot = draws.some(d => d.includes('Gutshot'));
      const uniqueHoleOutCount = [...new Set(holeOutCards)].length;

      const maxCommVal = Math.max(...validComm.map(c => c.value));
      const maxHoleVal = Math.max(...validHole.map(c => c.value));

      if (currentBest.score >= 8) {
        heroWinEst = 98;
        heroTargets.push(`${currentBest.rankName} 100% (Terkunci)`);
      } else if (currentBest.score === 7) {
        heroWinEst = 88;
        heroTargets.push('Full House 100%');
        if (cardsToCome > 0) heroTargets.push(`Quads ${calcProb(1)}% (Kurang 1)`);
      } else if (currentBest.score === 6) {
        heroWinEst = 85;
        heroTargets.push('Flush 100% (Sudah Jadi)');
      } else if (currentBest.score === 5) {
        heroWinEst = 80;
        heroTargets.push('Straight 100%');
        if (flushSuit && cardsToCome > 0) heroTargets.push(`Flush ${calcProb(9)}% (Kurang 1 ${flushSuit})`);
      } else if (currentBest.score === 4) {
        heroWinEst = 84;
        heroTargets.push('Set/Trips 100%');
        if (cardsToCome > 0) {
          heroTargets.push(`Full House ${calcProb(6)}%`);
          heroTargets.push(`Quads ${calcProb(1)}% (Kurang 1)`);
        }
      } else if (currentBest.score === 3) {
        heroWinEst = 74;
        heroTargets.push('Two Pair 100%');
        if (cardsToCome > 0) {
          heroTargets.push(`Full House ${calcProb(4)}% (Kurang 1)`);
          if (flushSuit) heroTargets.push(`Flush ${calcProb(9)}% (Kurang 1 ${flushSuit})`);
        }
      } else if (currentBest.score === 2) {
        if (isPocketPair && maxHoleVal > maxCommVal) {
          heroWinEst = 76;
          heroTargets.push(`Overpair ${validHole[0].label}-${validHole[0].label}`);
          if (cardsToCome > 0) {
            heroTargets.push(`Set ${calcProb(2)}% (Kurang 1 ${validHole[0].label})`);
            heroTargets.push(`Quads ${cardsToCome === 2 ? '0.1%' : '0%'}`);
          }
        } else if (maxHoleVal < maxCommVal) {
          isDominatedLowPair = true;
          heroWinEst = cardsToCome > 0 ? Math.max(15, calcProb(uniqueHoleOutCount)) : 18;
          heroTargets.push('Pair Bawah ⚠️');
          if (cardsToCome > 0) {
            heroTargets.push(`Trips/2Pair ${calcProb(uniqueHoleOutCount)}% (Kurang 1)`);
          }
        } else {
          heroWinEst = 62;
          heroTargets.push('Top Pair');
          if (cardsToCome > 0) {
            heroTargets.push(`Trips/2Pair ${calcProb(uniqueHoleOutCount)}% (Kurang 1)`);
          }
        }
      } else {
        heroWinEst = cardsToCome > 0 ? calcProb(uniqueHoleOutCount) : 8;
        if (cardsToCome > 0) {
          heroTargets.push(`Top Pair ${calcProb(uniqueHoleOutCount)}% (Kurang 1)`);
        } else {
          heroTargets.push('High Card (Tidak Kena)');
        }
      }

      if (currentBest.score < 6 && flushSuit && cardsToCome > 0) {
        const fOuts = remainingDeck.filter(c => c.suit === flushSuit).length;
        const fProb = calcProb(fOuts);
        heroWinEst = Math.max(heroWinEst, currentBest.score >= 2 ? Math.min(72, fProb + 18) : fProb);
        heroTargets.unshift(`Flush ${fProb}% (Kurang 1 ${flushSuit})`);
      }
      if (currentBest.score < 5 && (hasOESD || hasGutshot) && cardsToCome > 0) {
        const sOuts = hasOESD ? 8 : 4;
        const sProb = calcProb(sOuts);
        heroWinEst = Math.max(heroWinEst, sProb);
        heroTargets.unshift(`Straight ${sProb}% (Kurang 1)`);
      }

      bestTargetText = heroTargets.join(' • ');
    }

    // 4. Analisis Kartu Komunitas (Kembang Dominan + Peluang Lawan Punya vs Kosong)
    let boardPctText = 'Belum Ada Kartu Meja';
    let dangerLevel = 0;

    if (validComm.length >= 3) {
      const commSuits = {};
      validComm.forEach(c => commSuits[c.suit] = (commSuits[c.suit] || 0) + 1);
      const maxSuit = Object.keys(commSuits).reduce((a, b) => commSuits[a] > commSuits[b] ? a : b);
      const maxSuitCount = commSuits[maxSuit];
      const remSuitCards = remainingDeck.filter(c => c.suit === maxSuit);

      const boardInfo = [];

      if (maxSuitCount >= 3) {
        const singleOppFlush = maxSuitCount === 3
          ? (remSuitCards.length / unseen) * ((remSuitCards.length - 1) / (unseen - 1))
          : 1 - (((unseen - remSuitCards.length) / unseen) * ((unseen - 1 - remSuitCards.length) / (unseen - 1)));

        const someoneHasFlushPct = Math.min(92, Math.max(18, Math.round((1 - Math.pow(1 - singleOppFlush, 4)) * 100)));
        const noOneHasFlushPct = 100 - someoneHasFlushPct;

        const nutCardCode = `A${maxSuit}`;
        const weHoldNut = validHole.some(c => this.formatCardText(c) === nutCardCode);
        const nutStillOut = remSuitCards.some(c => c.text === nutCardCode);

        let nutStatus = weHoldNut ? `Nut ${nutCardCode} di Kita` : nutStillOut ? `Waspada Nut ${nutCardCode}` : `Nut ${maxSuit} Aman`;
        dangerLevel = weHoldNut ? 0 : (maxSuitCount >= 4 ? 2 : 1);

        boardInfo.push(`Flush ${maxSuit}: Ada ${someoneHasFlushPct}% vs Kosong ${noOneHasFlushPct}% (${nutStatus})`);
      } else if (maxSuitCount === 2 && cardsToCome > 0) {
        boardInfo.push(`Potensi Flush ${maxSuit} (2 Kembang)`);
      }

      const commRanks = validComm.map(c => c.value);
      const rankCounts = {};
      commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
      const pairCount = Object.values(rankCounts).filter(v => v >= 2).length;
      if (pairCount >= 2) {
        boardInfo.push('Full House Meja: Ada ~65% vs Kosong ~35%');
        dangerLevel = 2;
      } else if (pairCount === 1) {
        boardInfo.push('Pair Meja (Trips/FH ~30% vs Kosong ~70%)');
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
        boardInfo.push('Straight Meja: Ada ~55% vs Kosong ~45%');
        dangerLevel = Math.max(dangerLevel, 2);
      } else if (maxWindow === 3) {
        boardInfo.push('Potensi Straight (~25% Ada vs ~75% Kosong)');
      }

      boardPctText = boardInfo.length > 0 ? boardInfo.join(' • ') : 'Board Aman / Kering (Dominan One/Two Pair)';
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
