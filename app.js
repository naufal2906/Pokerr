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
    return PokerEvaluator.getCardLabel(card);
  }

  getCardSuitInfo(card) {
    const symbol = PokerEvaluator.getCardSuitSymbol(card);
    const color = (symbol === '♥' || symbol === '♦') ? 'red' : 'black';
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
    this.maxCallProb = document.getElementById('max-call-prob');
    this.stratReason = document.getElementById('strat-reason');

    this.boardThreats = document.getElementById('board-threats');
    this.resultName = document.getElementById('result-name');

    this.btnClearHand = document.getElementById('btn-clear-hand');
    this.btnClearComm = document.getElementById('btn-clear-comm');
    this.modal = document.getElementById('card-picker-modal');
    this.modalGrid = document.getElementById('full-card-grid');
    this.closeModalBtn = document.getElementById('close-modal');
    this.targetLabel = document.getElementById('target-label');

    this.toggleRangeBtn = document.getElementById('toggleRangeBtn');
    this.rangeContent = document.getElementById('rangeContent');
    this.rangeArrow = document.getElementById('rangeArrow');
    this.handRangeContainer = document.getElementById('handRangeContainer');

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
      const suitSym = suit.symbol || suit;
      const suitCol = (suitSym === '♥' || suitSym === '♦') ? 'red' : 'black';

      const label = document.createElement('div');
      label.className = `suit-label ${suitCol}`;
      label.textContent = suitSym;
      row.appendChild(label);

      const rankContainer = document.createElement('div');
      rankContainer.className = 'rank-buttons';

      RANKS.forEach(rank => {
        const rankLbl = rank.label || String(rank.value || rank);
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
    if (this.toggleRangeBtn) {
      this.toggleRangeBtn.addEventListener('click', () => {
        if (this.rangeContent) this.rangeContent.classList.toggle('hidden');
        if (this.rangeArrow) this.rangeArrow.classList.toggle('active');
      });
    }

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
    if (card && PokerEvaluator.getCardValue(card) > 0) {
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

  renderHandRange(communityCards, holeCards) {
    if (!this.handRangeContainer) return;
    const ranges = PokerEvaluator.getPossibleHandRanges(communityCards, holeCards);

    if (ranges.length === 0) {
      this.handRangeContainer.innerHTML = `<div style="color: #777; font-size: 0.8rem; text-align: center; padding: 6px;">Menunggu Flop (Minimal 3 Kartu Komunitas)...</div>`;
      return;
    }

    this.handRangeContainer.innerHTML = ranges.map(item => `
      <div class="range-item ${item.danger}">
        <div class="range-title">
          <span>${item.category}</span>
          <small style="color: ${item.danger === 'HIGH' ? '#ff2a5f' : '#ffca28'};">[${item.type}]</small>
        </div>
        <div class="range-details">
          Kombinasi: <b>${item.hands.join(', ')}</b>
        </div>
      </div>
    `).join('');
  }

  getBettingAdvice(equity, myBestScore, commCount, draws) {
    let action = "CHECK / FOLD";
    let reason = "Tangan lemah. Disarankan Check gratis, atau Fold jika di-raise lawan.";
    let betChips = "0 Chips";
    let maxCallChips = "0 Chips";

    if (commCount === 0) { 
      if (equity >= 75) {
        action = "RAISE / RE-RAISE";
        reason = "🔥 <b>MONSTER PRE-FLOP:</b> Tangan sangat kuat! Buka Raise/Re-Raise ke 2,400 - 3,600 Chips.";
        betChips = "Raise 2,400 - 3,600 Chips";
        maxCallChips = "Call All-In (6,000+ Chips)";
      } else if (equity >= 50) {
        action = "RAISE / CALL";
        reason = "♠️ <b>PRE-FLOP KUAT:</b> Buka Raise 1,200 - 1,800 Chips atau Call Raise lawan.";
        betChips = "Raise 1,200 - 1,800 Chips";
        maxCallChips = "Maksimal Call 2,400 Chips";
      } else {
        action = "CHECK / FOLD";
        reason = "⚠️ <b>PRE-FLOP RISIKAN:</b> Check jika gratis di BB, atau Fold jika lawan Raise melebihi Big Blind.";
        betChips = "Check / 0 Chips";
        maxCallChips = "Maksimal Call 600 Chips";
      }
      return { action, reason, betChips, maxCallChips };
    }

    if (myBestScore >= 7) { 
      action = "SLOWPLAY / VALUE BET";
      reason = "🏆 <b>NUT HAND:</b> Dorong taruhan Value Bet besar 3,600 - 6,000 Chips untuk menguras stack lawan.";
      betChips = "Bet 3,600 - 6,000 Chips";
      maxCallChips = "Call All-In";
    } else if (myBestScore >= 5 || equity >= 70) { 
      action = "VALUE BET";
      reason = "💎 <b>KOMBINASI KUAT:</b> Pasang Value Bet 2,400 - 3,600 Chips untuk memaksimalkan Pot.";
      betChips = "Bet 2,400 - 3,600 Chips";
      maxCallChips = "Maksimal Call 4,800 Chips";
    } else if (myBestScore >= 3 || equity >= 55) { 
      action = "RAISE / CALL BIG";
      reason = "⚡ <b>KOMBINASI BAGUS:</b> Taruhan agresif 1,800 - 2,400 Chips. Ikuti Raise lawan hingga batas menengah-tinggi.";
      betChips = "Bet 1,800 - 2,400 Chips";
      maxCallChips = "Maksimal Call 3,600 Chips";
    } else if (draws.length > 0) { 
      action = "SEMI-BLUFF / CALL ODD";
      reason = `🎯 <b>${draws[0].replace(/<\/?[^>]+(>|$)/g, "")}:</b> Lakukan Semi-Bluff 1,200 - 1,800 Chips, atau Call taruhan lawan jika harganya sesuai Pot Odds.`;
      betChips = "Bet 1,200 - 1,800 Chips";
      maxCallChips = "Maksimal Call 2,400 Chips";
    } else if (myBestScore >= 2 || equity >= 40) { 
      action = "BLOCK BET / CALL SMALL";
      reason = "🛡️ <b>PAIR MODERAT:</b> Pasang Block Bet 600 - 1,200 Chips untuk mengontrol ukuran pot.";
      betChips = "Bet 600 - 1,200 Chips";
      maxCallChips = "Maksimal Call 1,800 Chips";
    } else { 
      action = "CHECK / FOLD";
      reason = "🚨 <b>MISSED BOARD:</b> Tangan meleset. Lakukan Check gratis atau Fold jika lawan melakukan taruhan.";
      betChips = "Check / 0 Chips";
      maxCallChips = "Maksimal Call 600 Chips";
    }

    return { action, reason, betChips, maxCallChips };
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

    this.renderHandRange(this.communityCards, this.holeCards);

    if (validHole.length < 2) {
      if (this.myBestHand) this.myBestHand.textContent = "-";
      if (this.strengthBar) this.strengthBar.style.width = "0%";
      if (this.strengthPercent) this.strengthPercent.textContent = "0%";
      if (this.stratAction) this.stratAction.textContent = "WAIT";
      if (this.stratAmount) this.stratAmount.textContent = "0 Chips";
      if (this.maxCallProb) this.maxCallProb.textContent = "0 Chips";
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

    if (this.myBestHand) this.myBestHand.textContent = comboText;
    if (this.resultName) this.resultName.textContent = comboText;

    const draws = PokerEvaluator.detectDraws(this.holeCards, this.communityCards);
    const advice = this.getBettingAdvice(equity, myBest.score, validComm.length, draws);

    if (this.stratAction) this.stratAction.textContent = advice.action;
    if (this.stratAmount) this.stratAmount.textContent = advice.betChips;
    if (this.maxCallProb) this.maxCallProb.textContent = advice.maxCallChips;
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
