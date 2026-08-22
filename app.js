import { Card, SUITS, RANKS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.activeSlot = null; // { type: 'hole'|'community', index: number }
    this.currentPot = 1000;  // Default awal pot
    this.opponentBet = 0;    // Default awal bet/raise lawan

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
    this.stratReason = document.getElementById('strat-reason');
    
    // INPUT DOM POT ODDS
    this.potInput = document.getElementById('pot-size-input');
    this.opponentBetInput = document.getElementById('opponent-bet-input');

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
      // FITUR HAPUS SATUAN (×)
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

    if (this.potInput) {
      this.potInput.addEventListener('input', (e) => {
        this.currentPot = parseInt(e.target.value) || 0;
        this.render();
      });
    }

    if (this.opponentBetInput) {
      this.opponentBetInput.addEventListener('input', (e) => {
        this.opponentBet = parseInt(e.target.value) || 0;
        this.render();
      });
    }

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

      if (v1 === v2) return ["Set (Trips)", "Full House", "Four of a Kind (Quads)", "Two Pair"];
      const res = [];
      if (s1 === s2) res.push("Flush");
      if (Math.abs(v1 - v2) <= 4 || (v1 === 14 && v2 <= 5) || (v2 === 14 && v1 <= 5)) res.push("Straight");
      res.push("Top Pair / Two Pair", "Three of a Kind");
      return res;
    }

    if (commCount === 5) return [`🏆 Kombinasi Final: ${myBest.rankName.split('(')[0].trim()}`];

    const proj = [];
    const suitCounts = {};
    allCards.forEach(c => {
      const s = this.getCardSuitInfo(c).symbol;
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    });
    const maxSuit = Math.max(...Object.values(suitCounts));

    if (myBest.score === 6 || myBest.score === 9 || myBest.score === 10) proj.push(`✅ ${myBest.rankName.split('(')[0].trim()}`);
    else if (maxSuit === 4) proj.push("🌊 Flush Draw (Butuh 1 Kembang)");

    const draws = PokerEvaluator.detectDraws(holeCards, communityCards);
    const hasStraightDraw = draws.some(d => d.includes("Straight Draw"));

    if (myBest.score === 5) proj.push(`✅ ${myBest.rankName.split('(')[0].trim()}`);
    else if (hasStraightDraw) proj.push("🎯 Straight Draw");

    if (myBest.score >= 7) proj.push(`✅ ${myBest.rankName.split('(')[0].trim()}`);
    else if (myBest.score === 4) proj.push("Three of a Kind (Trips)", "Potensi Full House");
    else if (myBest.score === 3) proj.push("Two Pair", "Potensi Full House");
    else if (myBest.score === 2) proj.push("One Pair / Top Pair", "Potensi Two Pair / Trips");
    else if (myBest.score === 1) proj.push("High Card");

    return [...new Set(proj)];
  }

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
    const rankCounts = {};
    commRanks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);

    const hasPair = Object.values(rankCounts).some(cnt => cnt >= 2);
    const hasTrips = Object.values(rankCounts).some(cnt => cnt >= 3);
    const hasQuads = Object.values(rankCounts).some(cnt => cnt >= 4);

    const boardBest = PokerEvaluator.getBestHand(validComm);
    const currentBoardCombo = boardBest.rankName.split('(')[0].trim();
    const possibilities = [];

    if (hasQuads) possibilities.push("Four of a Kind (Terbuka di Meja)");
    else if (hasTrips) possibilities.push("Four of a Kind (Quads)", "Full House");
    else if (hasPair) {
      possibilities.push("Full House", "Three of a Kind (Trips)");
      if (commCount < 5) possibilities.push("Two Pair");
    }

    if (maxSuitCount >= 5) possibilities.push("Flush (Terbentuk Murni di Meja)");
    else if (maxSuitCount === 4) possibilities.push("Flush (Lawan Memegang 1 Kembang)");
    else if (maxSuitCount === 3) {
      if (commCount < 5) possibilities.push("Flush Draw (Lawan Memegang 2 Kembang)");
      else possibilities.push("Flush (Lawan Memegang 2 Kembang)");
    }

    const uniqueRanks = [...new Set(commRanks)].sort((a, b) => a - b);
    if (uniqueRanks.includes(14)) uniqueRanks.unshift(1);
    let straightPossible = false;
    for (let target = 2; target <= 14; target++) {
      const windowCards = uniqueRanks.filter(r => r >= target - 4 && r <= target);
      if (commCount === 5 && windowCards.length >= 3) {
        const minW = Math.min(...windowCards);
        const maxW = Math.max(...windowCards);
        if (maxW - minW <= 4) { straightPossible = true; break; }
      } else if (windowCards.length >= 3) {
        straightPossible = true; break;
      }
    }
    if (straightPossible) possibilities.push("Straight");
    if (possibilities.length === 0) possibilities.push("Top Pair", "Two Pair");

    const stageLabel = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";
    return `[${stageLabel}] Struktur Meja: <b>${currentBoardCombo}</b> | Potensi Terkuat Lawan: <b>${possibilities.join(' / ')}</b>`;
  }

  // LOGIKA MATEMATIKA POT ODDS VS EQUITY DINAMIS
  getBettingAdvice(equity, myBestScore, commCount, draws, pot, oppBet) {
    let action = "CHECK / FOLD";
    let reason = "Tangan masih lemah, mainkan dengan kontrol pot minimum.";
    let betChips = "0 Chips";

    // 1. PRE-FLOP
    if (commCount === 0) {
      if (oppBet > 0) {
        const reqOdds = Math.round((oppBet / (pot + oppBet * 2)) * 100);
        if (equity >= reqOdds) {
          action = "CALL (PRE-FLOP)";
          reason = `✅ <b>CALL ACCEPTED:</b> Equity pre-flop (${equity}%) sepadan dengan risiko taruhan lawan (${reqOdds}% Risk).`;
          betChips = `Call ${oppBet} Chips`;
        } else {
          action = "FOLD (PRE-FLOP)";
          reason = `🚨 <b>OVERPAY PRE-FLOP:</b> Taruhan raise lawan ${oppBet} Chips terlalu besar dibandingkan kekuatan tangan Anda.`;
          betChips = "Fold";
        }
      } else {
        if (equity >= 75) {
          action = "RAISE (3x - 5x)";
          reason = "[PRE-FLOP] Memegang Monster Hand! Buka raise untuk isolasi lawan.";
          betChips = `Bet ${Math.round(pot * 0.5)} Chips`;
        } else if (equity >= 50) {
          action = "RAISE / CALL";
          reason = "[PRE-FLOP] Tangan standar tinggi. Buka taruhan standar 2.5x BB.";
          betChips = `Bet ${Math.round(pot * 0.3)} Chips`;
        } else {
          action = "CHECK / FOLD";
          reason = "[PRE-FLOP] Kartu berisiko. Lakukan Check jika gratis, atau Fold jika di-raise.";
          betChips = "0 Chips (Check)";
        }
      }
      return { action, reason, betChips };
    }

    // 2. POST-FLOP (FLOP / TURN / RIVER) SAAT LAWAN BET / RAISE > 0
    if (oppBet > 0) {
      const totalPotAfterBet = pot + oppBet;
      const requiredEquity = Math.round((oppBet / (totalPotAfterBet + oppBet)) * 100);
      const stageName = commCount === 3 ? "FLOP" : commCount === 4 ? "TURN" : "RIVER";

      if (equity >= requiredEquity) {
        action = "CALL (WORTH IT)";
        reason = `✅ <b>POT ODDS MASUK [${stageName}]:</b> Win Equity Anda (${equity}%) LEBIH BESAR dibanding Pot Odds yang diminta lawan (${requiredEquity}% Risk). Keputusan Call sangat menguntungkan (+EV).`;
        betChips = `Call ${oppBet} Chips`;
      } else {
        action = "FOLD (OVERPAY)";
        reason = `🚨 <b>TERLALU MAHAL [${stageName}]:</b> Lawan bet/raise ${oppBet} Chips (${requiredEquity}% Risk). Equity kartu Anda hanya ${equity}%. Mengejar kombinasi di sini rugi (-EV)!`;
        betChips = `Fold (Kalah Odds)`;
      }
      return { action, reason, betChips };
    }

    // 3. POST-FLOP SAAT LAWAN CHECK (OPPONENT BET = 0)
    if (myBestScore >= 7) {
      action = "ALL-IN / VALUE BET";
      reason = "Kombinasi Monster terbentuk! Lakukan Value Bet besar untuk memancing pot.";
      betChips = `Bet ${Math.round(pot * 0.8)} - ALL IN`;
    } else if (myBestScore >= 5 || equity >= 75) {
      action = "VALUE BET (75% Pot)";
      reason = "Kombinasi Anda sangat kuat. Lakukan Value Bet 3/4 Pot untuk memaksimalkan kemenangan.";
      betChips = `Bet ${Math.round(pot * 0.75)} Chips`;
    } else if (draws.length > 0) {
      const stageLabel = commCount === 3 ? "FLOP" : "TURN";
      action = "SEMI-BLUFF / CHECK";
      reason = `🎯 <b>[${stageLabel}] ${draws[0].replace(/<\/?[^>]+(>|$)/g, "")}</b> Lakukan Bet 1/3 Pot untuk Semi-Bluff atau Check gratis untuk membuka kartu berikutnya.`;
      betChips = `Bet ${Math.round(pot * 0.33)} Chips`;
    } else if (myBestScore >= 2 && equity >= 40) {
      action = "BLOCK BET / CHECK";
      reason = "Memegang Pair moderat. Lakukan taruhan kecil untuk mencegah lawan mengejar Draw murah.";
      betChips = `Bet ${Math.round(pot * 0.25)} Chips`;
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

    // KALKULASI POT ODDS & AKSI
    const draws = PokerEvaluator.detectDraws(this.holeCards, this.communityCards);
    const advice = this.getBettingAdvice(equity, myBest.score, validComm.length, draws, this.currentPot, this.opponentBet);

    if (this.stratAction) this.stratAction.textContent = advice.action;
    if (this.stratAmount) this.stratAmount.textContent = advice.betChips;
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
