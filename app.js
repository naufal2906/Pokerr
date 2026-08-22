import { Card, SUITS, RANKS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.activeSlot = null;

    this.initDOM();
    this.renderInitialSlots();
    this.bindEvents();
    this.render();
  }

  getCardRankLabel(card) {
    if (!card) return '';
    if (card.rank) return card.rank.label || card.rank.name || card.rank.value || card.rank;
    return card.label || card.name || card.value || '';
  }

  getCardSuitInfo(card) {
    if (!card) return { symbol: '', color: 'black' };
    let symbol = '';
    let color = 'black';
    if (card.suit) {
      symbol = card.suit.symbol || card.suit.name || card.suit;
      color = card.suit.color || (symbol === '♥' || symbol === '♦' ? 'red' : 'black');
    }
    return { symbol, color };
  }

  initDOM() {
    this.handCardsContainer = document.getElementById('hand-cards');
    this.communityCardsContainer = document.getElementById('community-cards');
    this.bestCardsContainer = document.getElementById('best-cards');

    this.holeOnlyHand = document.getElementById('hole-only-hand');
    this.myBestHand = document.getElementById('my-best-hand');
    this.strengthBar = document.getElementById('strength-bar');
    this.strengthPercent = document.getElementById('strength-percent');

    this.stratAction = document.getElementById('strat-action');
    this.stratAmount = document.getElementById('strat-amount');
    this.maxCallProb = document.getElementById('max-call-prob'); // Selector Probabilitas Call
    this.stratReason = document.getElementById('strat-reason');

    this.boardThreats = document.getElementById('board-threats');
    this.resultName = document.getElementById('result-name');

    this.btnClearHand = document.getElementById('btn-clear-hand');
    this.btnClearComm = document.getElementById('btn-clear-comm');
    this.modal = document.getElementById('card-picker-modal');
    this.modalGrid = document.getElementById('full-card-grid');
    this.closeModalBtn = document.getElementById('close-modal');
    this.targetLabel = document.getElementById('target-label');

    this.generateModalCardGrid();
  }

  renderInitialSlots() {
    if (this.handCardsContainer) {
      this.handCardsContainer.innerHTML = `
        <div class="card placeholder" data-type="hole" data-index="0">+</div>
        <div class="card placeholder" data-type="hole" data-index="1">+</div>
      `;
    }
    if (this.communityCardsContainer) {
      this.communityCardsContainer.innerHTML = `
        <div class="card placeholder" data-type="community" data-index="0">+</div>
        <div class="card placeholder" data-type="community" data-index="1">+</div>
        <div class="card placeholder" data-type="community" data-index="2">+</div>
        <div class="card placeholder" data-type="community" data-index="3">+</div>
        <div class="card placeholder" data-type="community" data-index="4">+</div>
      `;
    }
  }

  generateModalCardGrid() {
    if (!this.modalGrid) return;
    this.modalGrid.innerHTML = '';
    const suits = [SUITS.SPADES, SUITS.HEARTS, SUITS.CLUBS, SUITS.DIAMONDS];
    suits.forEach(suit => {
      const row = document.createElement('div');
      row.className = 'suit-row';
      const suitSym = suit.symbol || suit.name || suit;
      const suitCol = suit.color || (suitSym === '♥' || suitSym === '♦' ? 'red' : 'black');

      const label = document.createElement('div');
      label.className = `suit-label ${suitCol}`;
      label.textContent = suitSym;
      row.appendChild(label);

      const rankContainer = document.createElement('div');
      rankContainer.className = 'rank-buttons';

      RANKS.forEach(rank => {
        const rankLbl = rank.label || rank.name || rank.value || rank;
        const btn = document.createElement('button');
        btn.className = `btn-card-select ${suitCol}`;
        btn.textContent = rankLbl;
        btn.dataset.suit = suitSym;
        btn.dataset.rank = rankLbl;
        btn.addEventListener('click', () => this.selectCard(new Card(rank, suit)));
        rankContainer.appendChild(btn);
      });
      row.appendChild(rankContainer);
      this.modalGrid.appendChild(row);
    });
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-card-btn')) {
        e.stopPropagation();
        const cardSlot = e.target.closest('.card');
        const type = cardSlot.dataset.type;
        const index = parseInt(cardSlot.dataset.index, 10);
        
        if (type === 'hole') this.holeCards[index] = null;
        if (type === 'community') this.communityCards[index] = null;
        
        this.render();
        return;
      }

      const cardSlot = e.target.closest('.card');
      if (cardSlot && cardSlot.dataset.type) {
        const type = cardSlot.dataset.type;
        const index = parseInt(cardSlot.dataset.index, 10);
        this.openModal(type, index);
      }
    });

    if (this.closeModalBtn) this.closeModalBtn.addEventListener('click', () => this.closeModal());

    if (this.btnClearHand) {
      this.btnClearHand.addEventListener('click', () => {
        this.holeCards = [null, null];
        this.render();
      });
    }

    if (this.btnClearComm) {
      this.btnClearComm.addEventListener('click', () => {
        this.communityCards = [null, null, null, null, null];
        this.render();
      });
    }
  }

  openModal(type, index) {
    this.activeSlot = { type, index };
    if (this.targetLabel) {
      this.targetLabel.textContent = type === 'hole' ? `Kartu Tangan #${index + 1}` : `Kartu Komunitas #${index + 1}`;
    }
    this.updateModalButtonsState();
    if (this.modal) this.modal.classList.remove('hidden');
  }

  closeModal() {
    if (this.modal) this.modal.classList.add('hidden');
    this.activeSlot = null;
  }

  updateModalButtonsState() {
    const selectedCards = [...this.holeCards, ...this.communityCards].filter(Boolean);
    if (!this.modalGrid) return;
    const buttons = this.modalGrid.querySelectorAll('.btn-card-select');

    buttons.forEach(btn => {
      const s = btn.dataset.suit;
      const r = btn.dataset.rank;
      const isUsed = selectedCards.some(c => {
        const cRank = this.getCardRankLabel(c);
        const cSuit = this.getCardSuitInfo(c).symbol;
        return cSuit === s && cRank === r;
      });
      if (isUsed) btn.classList.add('disabled');
      else btn.classList.remove('disabled');
    });
  }

  selectCard(card) {
    if (!this.activeSlot) return;
    if (this.activeSlot.type === 'hole') this.holeCards[this.activeSlot.index] = card;
    else this.communityCards[this.activeSlot.index] = card;
    this.closeModal();
    this.render();
  }

  renderCardSlot(element, card) {
    if (!element) return;
    if (card && card.rank && card.suit) {
      const rankLabel = this.getCardRankLabel(card);
      const suitInfo = this.getCardSuitInfo(card);

      element.className = `card filled ${suitInfo.color}`;
      element.innerHTML = `
        <span class="card-rank">${rankLabel}</span>
        <span class="card-suit">${suitInfo.symbol}</span>
        <div class="remove-card-btn" style="
          position: absolute; 
          top: -6px; right: -6px; 
          background: #ff2a5f; color: white; 
          width: 20px; height: 20px; 
          border-radius: 50%; display: flex; 
          align-items: center; justify-content: center; 
          font-size: 14px; font-weight: bold; 
          cursor: pointer; z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        ">×</div>
      `;
    } else {
      element.className = 'card placeholder';
      element.innerHTML = '+';
    }
  }

  // PROYEKSI KARTU TANGAN DENGAN ANGKA/KEMBANG DETIL
  getDynamicHoleProjections(holeCards, communityCards) {
    const validHole = PokerEvaluator.getValidCards(holeCards);
    const validComm = PokerEvaluator.getValidCards(communityCards);
    if (validHole.length < 2) return [];

    const allCards = [...validHole, ...validComm];
    const myBest = PokerEvaluator.getBestHand(allCards);
    const commCount = validComm.length;

    if (commCount === 0) {
      const v1 = validHole[0].rank ? validHole[0].rank.value : validHole[0].value;
      const v2 = validHole[1].rank ? validHole[1].rank.value : validHole[1].value;
      const s1 = this.getCardSuitInfo(validHole[0]).symbol;
      const s2 = this.getCardSuitInfo(validHole[1]).symbol;

      if (v1 === v2) return ["Set (Trips)", "Full House", "Quads", "Two Pair"];
      const res = [];
      if (s1 === s2) res.push(`Flush (${s1})`);
      if (Math.abs(v1 - v2) <= 4 || (v1 === 14 && v2 <= 5) || (v2 === 14 && v1 <= 5)) res.push("Straight");
      res.push("Top Pair / Two Pair");
      return res;
    }

    if (commCount === 5) return [`🏆 Kombinasi Final: ${myBest.rankName}`];

    const proj = [];
    const suitCounts = {};
    allCards.forEach(c => {
      const s = this.getCardSuitInfo(c).symbol;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });

    Object.keys(suitCounts).forEach(s => {
      const count = suitCounts[s];
      if (count === 4) proj.push(`🌊 Flush Draw (Butuh 1 Kartu ${s} Lagi)`);
      else if (count === 3 && commCount === 3) proj.push(`🌊 Backdoor Flush (Butuh 2 Kartu ${s} Lagi)`);
    });

    const draws = PokerEvaluator.detectDraws(holeCards, communityCards);
    draws.forEach(d => {
      if (d.includes("Straight Draw")) proj.push(d.replace(/<\/?[^>]+(>|$)/g, ""));
    });

    if (myBest.score >= 5) proj.push(`✅ ${myBest.rankName}`);
    else if (myBest.score === 4) proj.push(`Set/Trips (Potensi Full House / Quads)`);
    else if (myBest.score === 3) proj.push(`Two Pair (Potensi Full House)`);
    else if (myBest.score === 2) proj.push(`${myBest.rankName.split('-')[0].trim()} (Potensi Two Pair/Trips)`);
    else if (myBest.score === 1 && proj.length === 0) proj.push("High Card (Butuh Pair di Turn/River)");

    return [...new Set(proj)];
  }

  // ANALISIS STRUKTUR MEJA TERMASUK HIGH CARD & PAIR TERTIKGG
  getBoardOnlyAnalysis(communityCards) {
    const validComm = PokerEvaluator.getValidCards(communityCards);
    const commCount = validComm.length;
    if (commCount < 3) return "";

    const commRanks = validComm.map(c => c.rank ? c.rank.value : c.value).sort((a, b) => b - a);
    const commSuits = {};
    validComm.forEach(c => {
      const s = this.getCardSuitInfo(c).symbol;
      commSuits[s] = (commSuits[s] || 0) + 1;
    });

    const maxSuitCount = Math.max(...Object.values(commSuits));
    const flushSuit = Object.keys(commSuits).find(s => commSuits[s] === maxSuitCount);
    
    const rankCounts = {};
    commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);

    const pairedRanks = Object.keys(rankCounts)
      .filter(r => rankCounts[r] >= 2)
      .map(Number)
      .sort((a, b) => b - a);

    const maxRank = commRanks[0];
    const maxLabel = maxRank === 14 ? 'A' : maxRank === 13 ? 'K' : maxRank === 12 ? 'Q' : maxRank === 11 ? 'J' : maxRank;
    const maxSuitCard = validComm.find(c => (c.rank ? c.rank.value : c.value) === maxRank);
    const maxSuitSym = maxSuitCard ? this.getCardSuitInfo(maxSuitCard).symbol : '';

    let boardStructureLabel = "";
    if (pairedRanks.length > 0) {
      const topPairVal = pairedRanks[0];
      const topPairLabel = topPairVal === 14 ? 'A' : topPairVal === 13 ? 'K' : topPairVal === 12 ? 'Q' : topPairVal === 11 ? 'J' : topPairVal;
      boardStructureLabel = `Pair di Meja [${topPairLabel}${topPairLabel}]`;
    } else {
      boardStructureLabel = `High Card Meja [${maxLabel}${maxSuitSym}]`;
    }

    const possibilities = [];

    if (maxSuitCount >= 5) possibilities.push(`Flush Murni di Meja (${flushSuit})`);
    else if (maxSuitCount === 4) possibilities.push(`Flush (Lawan Cukup Pegang 1 ${flushSuit})`);
    else if (maxSuitCount === 3) possibilities.push(`Flush Draw di Meja (3 Kartu ${flushSuit})`);

    if (pairedRanks.length >= 2) possibilities.push("Full House / Two Pair di Meja");
    else if (pairedRanks.length === 1) possibilities.push("Trips / Full House");

    const uniqueRanks = [...new Set(commRanks)].sort((a, b) => a - b);
    if (uniqueRanks.includes(14)) uniqueRanks.unshift(1);

    let straightPossible = false;
    for (let target = 2; target <= 14; target++) {
      const windowCards = uniqueRanks.filter(r => r >= target - 4 && r <= target);
      if (windowCards.length >= 3) {
        straightPossible = true;
        break;
      }
    }

    if (straightPossible) possibilities.push("Koneksi Straight");
    if (possibilities.length === 0) possibilities.push(`Top Pair [${maxLabel}]`);

    const stageLabel = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";
    return `[${stageLabel}] Struktur Meja: <b>${boardStructureLabel}</b> | Potensi Terkuat Lawan: <b>${possibilities.join(' / ')}</b>`;
  }

  // KALKULASI STRATEGI & PROBABILITAS
  getBettingAdvice(equity, myBestScore, commCount, draws) {
    let action = "CHECK / FOLD";
    let reason = "Tangan lemah. Disarankan Check gratis, atau Fold jika ada taruhan dari lawan.";
    let betSizing = "0% Pot";
    let maxCallPct = `${equity}% Pot`;

    if (commCount === 0) {
      if (equity >= 75) {
        action = "RAISE / RE-RAISE";
        reason = "🔥 <b>MONSTER PRE-FLOP:</b> Ekuitas sangat tinggi (~80%+). Buka raise agresif 3x–5x Big Blind untuk membentuk pot besar.";
        betSizing = "50% - 75% Pot";
        maxCallPct = "100% Pot (All-In)";
      } else if (equity >= 50) {
        action = "RAISE / CALL";
        reason = "♠️ <b>PRE-FLOP KUAT:</b> Kartu berpotensi tinggi. Lakukan Raise standar 2.5x BB atau Call jika lawan melakukan open raise kecil.";
        betSizing = "33% - 50% Pot";
        maxCallPct = "50% Pot";
      } else {
        action = "CHECK / FOLD";
        reason = "⚠️ <b>PRE-FLOP RISIKAN:</b> Tangan lemah. Lakukan Check gratis di posisi Big Blind, atau Fold jika ada yang Raise.";
        betSizing = "0% Pot";
        maxCallPct = "15% Pot";
      }
      return { action, reason, betSizing, maxCallPct };
    }

    if (myBestScore >= 7) {
      action = "SLOWPLAY / VALUE BET BESAR";
      reason = "🏆 <b>NUT / MONSTER HAND:</b> Kombinasi Anda hampir tak tertandingi. Berikan Value Bet besar atau Check-Raise untuk menguras chip lawan.";
      betSizing = "75% - 100% Pot";
      maxCallPct = "100% Pot (All-In)";
    } else if (myBestScore >= 5 || equity >= 70) {
      action = "VALUE BET (75% POT)";
      reason = "💎 <b>KOMBINASI SANGAT KUAT:</b> Kartu Anda menang atas mayoritas jangkauan lawan. Lakukan Value Bet untuk memancing pembayaran dari Pair lawan.";
      betSizing = "66% - 75% Pot";
      maxCallPct = "80% Pot";
    } else if (draws.length > 0) {
      const maxB = Math.round((equity / (100 - equity)) * 100);
      action = "SEMI-BLUFF / CALL ODD";
      reason = `🎯 <b>${draws[0].replace(/<\/?[^>]+(>|$)/g, "")}</b> Lakukan Semi-Bluff kecil. Batas maksimal Call taruhan lawan yang masih menguntungkan (+EV) adalah <b>${maxB}% dari total Pot</b>.`;
      betSizing = "33% Pot";
      maxCallPct = `${maxB}% Pot`;
    } else if (myBestScore >= 2 && equity >= 40) {
      action = "BLOCK BET / CALL SMALL";
      reason = "🛡️ <b>PAIR SEDANG / TOP PAIR:</b> Pegang kontrol pot dengan taruhan kecil (Block Bet) untuk mencegah lawan mengambil kartu gratis.";
      betSizing = "25% - 33% Pot";
      maxCallPct = "33% Pot";
    } else {
      action = "CHECK / FOLD";
      reason = "🚨 <b>MISSED BOARD:</b> Tangan Anda tidak memiliki kombinasi atau Draw yang layak. Jangan bayar taruhan lawan yang melebihi 10% Pot.";
      betSizing = "0% Pot";
      maxCallPct = "10% Pot";
    }

    return { action, reason, betSizing, maxCallPct };
  }

  render() {
    if (this.handCardsContainer) {
      const slots = this.handCardsContainer.querySelectorAll('.card');
      slots.forEach((slot, i) => this.renderCardSlot(slot, this.holeCards[i]));
    }
    if (this.communityCardsContainer) {
      const slots = this.communityCardsContainer.querySelectorAll('.card');
      slots.forEach((slot, i) => this.renderCardSlot(slot, this.communityCards[i]));
    }

    const validHole = PokerEvaluator.getValidCards(this.holeCards);
    const validComm = PokerEvaluator.getValidCards(this.communityCards);

    if (this.holeOnlyHand) this.holeOnlyHand.textContent = PokerEvaluator.evaluateHoleCardsOnly(this.holeCards);

    let holeProjectionContainer = document.getElementById('hole-projection-badge-element');
    if (!holeProjectionContainer && this.handCardsContainer) {
      holeProjectionContainer = document.createElement('div');
      holeProjectionContainer.id = 'hole-projection-badge-element';
      this.handCardsContainer.after(holeProjectionContainer);
    }
    if (validHole.length === 2 && holeProjectionContainer) {
      const projections = this.getDynamicHoleProjections(this.holeCards, this.communityCards);
      holeProjectionContainer.innerHTML = `<div class="combo-green-badge" style="background: rgba(0, 240, 255, 0.08); border-color: rgba(0, 240, 255, 0.3); color: #00f0ff;"><span>🎯 Proyeksi Kombinasi Tangan: <b>${projections.join(' / ')}</b></span></div>`;
    } else if (holeProjectionContainer) holeProjectionContainer.innerHTML = '';

    if (validHole.length < 2) {
      if (this.myBestHand) this.myBestHand.textContent = "-";
      if (this.strengthBar) this.strengthBar.style.width = "0%";
      if (this.strengthPercent) this.strengthPercent.textContent = "0%";
      if (this.stratAction) this.stratAction.textContent = "WAIT";
      if (this.stratAmount) this.stratAmount.textContent = "0% Pot";
      if (this.maxCallProb) this.maxCallProb.textContent = "0% Pot";
      if (this.stratReason) this.stratReason.textContent = "Pilih 2 Kartu Tangan Terlebih Dahulu.";
      if (this.boardThreats) this.boardThreats.innerHTML = '';
      if (this.resultName) this.resultName.textContent = "-";
      if (this.bestCardsContainer) this.bestCardsContainer.innerHTML = '';
      return;
    }

    const equity = PokerEvaluator.calculateStrength(this.holeCards, this.communityCards);
    if (this.strengthBar) this.strengthBar.style.width = `${equity}%`;
    if (this.strengthPercent) this.strengthPercent.textContent = `${equity}%`;

    const myBest = PokerEvaluator.getBestHand([...validHole, ...validComm]);
    let comboText = myBest.rankName;
    if (validComm.length === 0 && comboText.includes('- Kicker []')) comboText = comboText.replace(' - Kicker []', '');

    if (this.myBestHand) this.myBestHand.textContent = comboText;
    if (this.resultName) this.resultName.textContent = comboText;

    let comboBadgeContainer = document.getElementById('combo-green-badge-element');
    if (!comboBadgeContainer && this.communityCardsContainer) {
      comboBadgeContainer = document.createElement('div');
      comboBadgeContainer.id = 'combo-green-badge-element';
      this.communityCardsContainer.after(comboBadgeContainer);
    }
    if (comboBadgeContainer) {
      if (validComm.length >= 3) {
        const boardAnalysis = this.getBoardOnlyAnalysis(this.communityCards);
        comboBadgeContainer.innerHTML = `<div class="combo-green-badge"><span class="badge-icon">⚡</span><span>${boardAnalysis}</span></div>`;
      } else comboBadgeContainer.innerHTML = '';
    }

    const draws = PokerEvaluator.detectDraws(this.holeCards, this.communityCards);
    const advice = this.getBettingAdvice(equity, myBest.score, validComm.length, draws);

    if (this.stratAction) this.stratAction.textContent = advice.action;
    if (this.stratAmount) this.stratAmount.textContent = advice.betSizing;
    if (this.maxCallProb) this.maxCallProb.textContent = advice.maxCallPct;
    if (this.stratReason) this.stratReason.innerHTML = advice.reason;

    const threats = PokerEvaluator.analyzeBoardThreats(this.communityCards, this.holeCards);
    if (this.boardThreats) {
      this.boardThreats.innerHTML = '';
      threats.forEach(t => {
        const item = document.createElement('div');
        item.className = `potential-item ${t.safe ? 'safe' : ''}`;
        item.innerHTML = `<div style="font-weight:bold; margin-bottom:4px;">${t.text}</div><div style="margin:4px 0;">📊 <b>${t.boardPotential}</b></div><div>${t.worstCase}</div>`;
        this.boardThreats.appendChild(item);
      });
    }

    if (this.bestCardsContainer && myBest.cards) {
      this.bestCardsContainer.innerHTML = '';
      myBest.cards.forEach(c => {
        const slot = document.createElement('div');
        this.renderCardSlot(slot, c);
        this.bestCardsContainer.appendChild(slot);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => window.app = new PokerApp());
