import { Card, SUITS, RANKS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.activeSlot = null; // { type: 'hole'|'community', index: number }

    this.initDOM();
    this.renderInitialSlots();
    this.bindEvents();
    this.render();
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

      const label = document.createElement('div');
      label.className = `suit-label ${suit.color}`;
      label.textContent = suit.symbol;
      row.appendChild(label);

      const rankContainer = document.createElement('div');
      rankContainer.className = 'rank-buttons';

      RANKS.forEach(rank => {
        const btn = document.createElement('button');
        btn.className = `btn-card-select ${suit.color}`;
        btn.textContent = rank.label;
        btn.dataset.suit = suit.symbol;
        btn.dataset.rank = rank.label;

        btn.addEventListener('click', () => {
          // PERBAIKAN URUTAN PARAMETER: (rank, suit) SESUAI CONSTRUCTOR card.js
          this.selectCard(new Card(rank, suit));
        });

        rankContainer.appendChild(btn);
      });

      row.appendChild(rankContainer);
      this.modalGrid.appendChild(row);
    });
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      const cardSlot = e.target.closest('.card');
      if (cardSlot && cardSlot.dataset.type) {
        const type = cardSlot.dataset.type;
        const index = parseInt(cardSlot.dataset.index, 10);
        this.openModal(type, index);
      }
    });

    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener('click', () => this.closeModal());
    }

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
      const isUsed = selectedCards.some(c => c && c.suit.symbol === s && c.rank.label === r);

      if (isUsed) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
    });
  }

  selectCard(card) {
    if (!this.activeSlot) return;

    if (this.activeSlot.type === 'hole') {
      this.holeCards[this.activeSlot.index] = card;
    } else {
      this.communityCards[this.activeSlot.index] = card;
    }

    this.closeModal();
    this.render();
  }

  renderCardSlot(element, card) {
    if (!element) return;
    if (card && card.rank && card.suit) {
      element.className = `card filled ${card.suit.color}`;
      element.innerHTML = `
        <span class="card-rank">${card.rank.label}</span>
        <span class="card-suit">${card.suit.symbol}</span>
      `;
    } else {
      element.className = 'card placeholder';
      element.innerHTML = '+';
    }
  }

  getBettingAdvice(equity, myBestScore, commCount, draws) {
    let action = "CHECK / FOLD";
    let reason = "Tangan masih lemah, mainkan dengan kontrol pot minimum.";
    let betChips = "0 Chips";

    if (commCount === 0) {
      if (equity >= 75) {
        action = "RAISE / ALL-IN";
        reason = "[PRE-FLOP] Memegang Monster Hand! Buka Raise 3x - 5x Big Blind untuk memancing pot.";
        betChips = "1.800 - 3.000 Chips";
      } else if (equity >= 50) {
        action = "RAISE / CALL";
        reason = "[PRE-FLOP] Kartu standar tinggi. Naikkan taruhan 2.5x BB atau Call jika ada raise kecil.";
        betChips = "1.500 Chips";
      } else {
        action = "CHECK / FOLD";
        reason = "[PRE-FLOP] Kartu relatif lemah. Buka Check jika gratis, atau Fold jika di-raise lawan.";
        betChips = "0 Chips (Fold jika di-raise)";
      }
    } else {
      if (myBestScore >= 7) {
        action = "RAISE / ALL-IN";
        reason = "Kombinasi Monster terbentuk! Lakukan Value Bet besar / All-in untuk memaksimalkan pot.";
        betChips = "3.000+ Chips / ALL-IN";
      } else if (myBestScore >= 5 || equity >= 75) {
        action = "RAISE / CALL";
        reason = "Kombinasi Kartu Jadi Sangat Kuat! Naikkan taruhan sekitar 60% - 75% ukuran Pot.";
        betChips = "1.800 - 2.400 Chips";
      } else if (draws.length > 0) {
        action = "CALL / BET";
        reason = `${draws[0]} Disarankan Bet / Call kecil (25% - 35% Pot) untuk mengejar kartu jadi.`;
        betChips = "800 - 1.200 Chips";
      } else if (myBestScore >= 2 && equity >= 40) {
        action = "CHECK / CALL";
        reason = "Memegang Pair / Made Hand moderat. Kontrol pot dengan Check atau Call taruhan standar.";
        betChips = "600 - 1.000 Chips";
      } else {
        action = "CHECK / FOLD";
        reason = "Belum membentuk kombinasi dan tidak ada Draw potensial. Fold jika lawan bertaruh besar.";
        betChips = "0 Chips";
      }
    }

    return { action, reason, betChips };
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

    if (this.holeOnlyHand) {
      this.holeOnlyHand.textContent = PokerEvaluator.evaluateHoleCardsOnly(this.holeCards);
    }

    if (validHole.length < 2) {
      if (this.myBestHand) this.myBestHand.textContent = "-";
      if (this.strengthBar) this.strengthBar.style.width = "0%";
      if (this.strengthPercent) this.strengthPercent.textContent = "0%";
      if (this.stratAction) this.stratAction.textContent = "WAIT";
      if (this.stratAmount) this.stratAmount.textContent = "0 Chips";
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
    if (validComm.length === 0 && comboText.includes('- Kicker []')) {
      comboText = comboText.replace(' - Kicker []', '');
    }

    if (this.myBestHand) this.myBestHand.textContent = comboText;
    if (this.resultName) this.resultName.textContent = comboText;

    // FITUR BADGE KOMBINASI HIJAU BARU
    let comboBadgeContainer = document.getElementById('combo-green-badge-element');
    if (!comboBadgeContainer && this.communityCardsContainer) {
      comboBadgeContainer = document.createElement('div');
      comboBadgeContainer.id = 'combo-green-badge-element';
      this.communityCardsContainer.after(comboBadgeContainer);
    }

    if (comboBadgeContainer) {
      if (myBest && myBest.score >= 2) {
        const locationText = validComm.length === 0 
          ? "Pre-Flop (Di Tangan)" 
          : (myBest.score >= 5 ? "Tangan + Meja (Terbentuk)" : "Di Komunitas / Tangan");
        
        comboBadgeContainer.innerHTML = `
          <div class="combo-green-badge">
            <span class="badge-icon">⚡</span>
            <span>Kombinasi Aktif: <b>${comboText.split('(')[0]}</b> [${locationText}]</span>
          </div>
        `;
      } else {
        comboBadgeContainer.innerHTML = '';
      }
    }

    const draws = PokerEvaluator.detectDraws(this.holeCards, this.communityCards);
    const advice = this.getBettingAdvice(equity, myBest.score, validComm.length, draws);

    if (this.stratAction) this.stratAction.textContent = advice.action;
    if (this.stratAmount) this.stratAmount.textContent = advice.betChips;
    if (this.stratReason) this.stratReason.textContent = advice.reason;

    const threats = PokerEvaluator.analyzeBoardThreats(this.communityCards, this.holeCards);
    if (this.boardThreats) {
      this.boardThreats.innerHTML = '';
      threats.forEach(t => {
        const item = document.createElement('div');
        item.className = `potential-item ${t.safe ? 'safe' : ''}`;
        item.innerHTML = `
          <div style="font-weight:bold; margin-bottom:4px;">${t.text}</div>
          <div style="margin:4px 0;">📊 <b>${t.boardPotential}</b></div>
          <div>${t.worstCase}</div>
        `;
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

document.addEventListener('DOMContentLoaded', () => {
  window.app = new PokerApp();
});
