import { Card, SUITS, RANKS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.activeSlot = null; // { type: 'hole'|'community', index: number }

    this.initDOM();
    this.bindEvents();
    this.render();
  }

  initDOM() {
    this.holeSlots = document.querySelectorAll('#hole-cards .card');
    this.communitySlots = document.querySelectorAll('#community-cards .card');
    this.holeDesc = document.getElementById('hole-desc');
    this.handComboDesc = document.getElementById('hand-combo-desc');
    this.equityFill = document.getElementById('equity-fill');
    this.equityText = document.getElementById('equity-text');
    this.comboBadgeContainer = document.getElementById('combo-badge-container'); // Container Tombol Hijau Kombinasi
    
    this.actionBadge = document.getElementById('action-badge');
    this.strategyReason = document.getElementById('strategy-reason');
    this.betAdviceBox = document.getElementById('bet-advice-box'); // Container Saran Bet Size
    
    this.threatContainer = document.getElementById('threat-container');
    this.bestHandGlow = document.getElementById('best-hand-glow');

    this.modal = document.getElementById('card-modal');
    this.modalGrid = document.getElementById('modal-card-grid');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.btnResetHole = document.getElementById('btn-reset-hole');
    this.btnResetComm = document.getElementById('btn-reset-comm');

    this.generateModalCardGrid();
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
          this.selectCard(new Card(suit, rank));
        });

        rankContainer.appendChild(btn);
      });

      row.appendChild(rankContainer);
      this.modalGrid.appendChild(row);
    });
  }

  bindEvents() {
    this.holeSlots.forEach((slot, idx) => {
      slot.addEventListener('click', () => this.openModal('hole', idx));
    });

    this.communitySlots.forEach((slot, idx) => {
      slot.addEventListener('click', () => this.openModal('community', idx));
    });

    if (this.btnCloseModal) {
      this.btnCloseModal.addEventListener('click', () => this.closeModal());
    }

    if (this.btnResetHole) {
      this.btnResetHole.addEventListener('click', () => {
        this.holeCards = [null, null];
        this.render();
      });
    }

    if (this.btnResetComm) {
      this.btnResetComm.addEventListener('click', () => {
        this.communityCards = [null, null, null, null, null];
        this.render();
      });
    }
  }

  openModal(type, index) {
    this.activeSlot = { type, index };
    this.updateModalButtonsState();
    this.modal.classList.remove('hidden');
  }

  closeModal() {
    this.modal.classList.add('hidden');
    this.activeSlot = null;
  }

  updateModalButtonsState() {
    const selectedCards = [...this.holeCards, ...this.communityCards].filter(Boolean);
    const buttons = this.modalGrid.querySelectorAll('.btn-card-select');

    buttons.forEach(btn => {
      const s = btn.dataset.suit;
      const r = btn.dataset.rank;
      const isUsed = selectedCards.some(c => (c.suit.symbol === s || c.suit === s) && (c.rank.label === r || c.label === r));

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
    if (card) {
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

  // LOGIKA STRATEGI BETTING BERDASARKAN KEKUATAN & POT ODDS
  getBettingAdvice(equity, myBestScore, commCount, draws) {
    let action = "CHECK / FOLD";
    let reason = "Tangan masih lemah, mainkan dengan kontrol pot minimum.";
    let betChips = "0 Chips (Check)";

    if (commCount === 0) {
      // PRE-FLOP STRATEGY
      if (equity >= 75) {
        action = "RAISE / ALL-IN";
        reason = "[PRE-FLOP] Memegang Monster Hand! Buka Raise 3x - 5x Big Blind untuk memancing pot.";
        betChips = "1.800 - 3.000 Chips (3x-5x BB)";
      } else if (equity >= 50) {
        action = "RAISE / CALL";
        reason = "[PRE-FLOP] Kartu standar tinggi. Naikkan taruhan 2.5x BB atau Call jika ada raise kecil.";
        betChips = "1.500 Chips (2.5x BB)";
      } else {
        action = "CHECK / FOLD";
        reason = "[PRE-FLOP] Kartu relatif lemah. Buka Check jika gratis, atau Fold jika di-raise lawan.";
        betChips = "0 Chips (Fold jika di-raise)";
      }
    } else {
      // POST-FLOP STRATEGY (FLOP, TURN, RIVER)
      if (myBestScore >= 7) { // Full House, Quads, Straight Flush
        action = "RAISE / ALL-IN";
        reason = "Kombinasi Monster terbentuk! Lakukan Value Bet besar / All-in untuk memaksimalkan pot.";
        betChips = "3.000+ Chips / ALL-IN";
      } else if (myBestScore >= 5 || equity >= 75) { // Flush, Straight, Set Tinggi
        action = "RAISE / CALL BIG";
        reason = "Kombinasi Kartu Jadi Sangat Kuat! Naikkan taruhan sekitar 60% - 75% ukuran Pot.";
        betChips = "1.800 - 2.400 Chips";
      } else if (draws.length > 0) { // Flush / Straight Draw
        action = "CALL / BET KECIL";
        reason = `${draws[0]} Disarankan Bet / Call kecil (25% - 35% Pot) untuk mengejar kartu jadi.`;
        betChips = "800 - 1.200 Chips (Pengejar Draw)";
      } else if (myBestScore >= 2 && equity >= 40) { // Top Pair / Two Pair
        action = "CHECK / CALL";
        reason = "Memegang Pair / Made Hand moderat. Kontrol pot dengan Check atau Call taruhan standar.";
        betChips = "600 - 1.000 Chips";
      } else {
        action = "CHECK / FOLD";
        reason = "Belum membentuk kombinasi dan tidak ada Draw potensial. Fold jika lawan bertaruh besar.";
        betChips = "0 Chips (Check/Fold)";
      }
    }

    return { action, reason, betChips };
  }

  render() {
    // Render Kartu Tangan
    this.holeSlots.forEach((slot, i) => this.renderCardSlot(slot, this.holeCards[i]));
    
    // Render Kartu Komunitas
    this.communitySlots.forEach((slot, i) => this.renderCardSlot(slot, this.communityCards[i]));

    // Deskripsi Hole Cards
    this.holeDesc.textContent = PokerEvaluator.evaluateHoleCardsOnly(this.holeCards);

    const validHole = PokerEvaluator.getValidCards(this.holeCards);
    const validComm = PokerEvaluator.getValidCards(this.communityCards);

    if (validHole.length < 2) {
      this.handComboDesc.textContent = "Pilih 2 Kartu Tangan";
      this.equityFill.style.width = "0%";
      this.equityText.textContent = "0%";
      this.actionBadge.textContent = "WAITING";
      this.strategyReason.textContent = "Silakan masukkan 2 kartu tangan Anda terlebih dahulu.";
      if (this.betAdviceBox) this.betAdviceBox.innerHTML = '';
      if (this.comboBadgeContainer) this.comboBadgeContainer.innerHTML = '';
      this.threatContainer.innerHTML = '';
      this.bestHandGlow.textContent = "-";
      return;
    }

    // Hitung Win Equity & Best Hand
    const equity = PokerEvaluator.calculateStrength(this.holeCards, this.communityCards);
    this.equityFill.style.width = `${equity}%`;
    this.equityText.textContent = `${equity}%`;

    const myBest = PokerEvaluator.getBestHand([...validHole, ...validComm]);
    
    // FIX KICKER PRE-FLOP KOSONG
    if (validComm.length === 0 && myBest.rankName.includes('Kicker []')) {
      this.handComboDesc.textContent = myBest.rankName.replace(' - Kicker []', '');
    } else {
      this.handComboDesc.textContent = myBest.rankName;
    }

    this.bestHandGlow.textContent = myBest.rankName;

    // FITUR 1: BADGES INDIKATOR KOMBINASI HIJAU (LOKASI KOMBO)
    if (this.comboBadgeContainer) {
      if (myBest && myBest.score >= 2) {
        const locationText = validComm.length === 0 
          ? "Di Tangan (Pre-Flop)" 
          : (myBest.score >= 5 ? "Tangan + Meja (Terbentuk)" : "Di Komunitas / Tangan");
        
        this.comboBadgeContainer.innerHTML = `
          <div class="combo-green-badge">
            <span class="badge-icon">⚡</span>
            <span>Kombinasi Aktif: <b>${myBest.rankName.split('(')[0]}</b> [${locationText}]</span>
          </div>
        `;
      } else {
        this.comboBadgeContainer.innerHTML = '';
      }
    }

    // FITUR 2: SUGGESTION BET SIZE & STRATEGI
    const draws = PokerEvaluator.detectDraws(this.holeCards, this.communityCards);
    const advice = this.getBettingAdvice(equity, myBest.score, validComm.length, draws);

    this.actionBadge.textContent = advice.action;
    this.strategyReason.textContent = advice.reason;

    if (this.betAdviceBox) {
      this.betAdviceBox.innerHTML = `
        <div class="bet-chip-recommendation">
          <span class="bet-label">💰 Estimasi Ukuran Bet / Call Ideal:</span>
          <span class="bet-amount">${advice.betChips}</span>
        </div>
      `;
    }

    // FITUR 3: THREAT ANALYSIS & WORST-CASE
    const threats = PokerEvaluator.analyzeBoardThreats(this.communityCards, this.holeCards);
    this.threatContainer.innerHTML = '';

    threats.forEach(t => {
      const item = document.createElement('div');
      item.className = `potential-item ${t.safe ? 'safe' : ''}`;
      item.innerHTML = `
        <div class="threat-title">${t.text}</div>
        <div style="margin:4px 0;">📊 <b>${t.boardPotential}</b></div>
        <div>${t.worstCase}</div>
      `;
      this.threatContainer.appendChild(item);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new PokerApp();
});
