import { Card, RANKS, SUITS } from './card.js';
import { PokerEvaluator } from './evaluator.js';
import { PokerStrategy } from './strategy.js';

let currentHand = [null, null];
let currentCommunity = [null, null, null, null, null];
let activeTarget = { type: 'hand', index: 0 };

function createFilledCardUI(card, onClickRemove) {
  const cardDiv = document.createElement('div');
  cardDiv.className = `card filled ${card.suit.color}`;
  cardDiv.innerHTML = `
    <div>${card.rank.label}</div>
    <div style="text-align: center;">${card.suit.symbol}</div>
  `;
  cardDiv.title = "Klik untuk menghapus kartu";
  cardDiv.addEventListener('click', onClickRemove);
  return cardDiv;
}

function createPlaceholderUI(onClickOpen) {
  const cardDiv = document.createElement('div');
  cardDiv.className = "card placeholder";
  cardDiv.innerText = "+";
  cardDiv.title = "Klik untuk menambahkan kartu";
  cardDiv.addEventListener('click', onClickOpen);
  return cardDiv;
}

function updateEvaluation() {
  const activeHandCards = currentHand.filter(c => c !== null);
  const activeCommunityCards = currentCommunity.filter(c => c !== null);
  const totalCards = [...activeHandCards, ...activeCommunityCards];

  // 1. Evaluasi Kartu Tangan Murni
  const holeOnlyEl = document.getElementById('hole-only-hand');
  if (holeOnlyEl) {
    holeOnlyEl.innerText = PokerEvaluator.evaluateHoleCardsOnly(activeHandCards);
  }

  // 2. Evaluasi Tangan + Meja
  const myBest = PokerEvaluator.getBestHand(totalCards);
  const myBestEl = document.getElementById('my-best-hand');
  if (myBestEl) {
    myBestEl.innerText = myBest ? myBest.rankName : '-';
  }

  const percentage = PokerEvaluator.calculateStrength(activeHandCards, activeCommunityCards);
  const strengthBar = document.getElementById('strength-bar');
  const strengthPercent = document.getElementById('strength-percent');
  if (strengthBar) strengthBar.style.width = `${percentage}%`;
  if (strengthPercent) strengthPercent.innerText = `${percentage}%`;

  // 3. Render Notifikasi Potensi Draw (Straight/Flush Draw)
  const draws = PokerEvaluator.detectDraws(activeHandCards, activeCommunityCards);
  let drawNoticeEl = document.getElementById('draw-notice-container');
  if (!drawNoticeEl) {
    drawNoticeEl = document.createElement('div');
    drawNoticeEl.id = 'draw-notice-container';
    drawNoticeEl.style.cssText = 'margin: 8px 0; font-size: 0.85rem; color: #00f2fe;';
    const stratBox = document.getElementById('strat-reason')?.parentNode;
    if (stratBox) stratBox.insertBefore(drawNoticeEl, document.getElementById('strat-reason'));
  }
  if (drawNoticeEl) {
    drawNoticeEl.innerHTML = draws.length > 0 ? draws.join('<br>') : '';
  }

  // 4. Analisis Potensi Ancaman & Counter Kartu Terkuat (The Nuts)
  const threatContainer = document.getElementById('board-threats');
  if (threatContainer) {
    threatContainer.innerHTML = '';
    const threats = PokerEvaluator.analyzeBoardThreats(activeCommunityCards);
    
    threats.forEach(t => {
      const div = document.createElement('div');
      div.className = `potential-item ${t.safe ? 'safe' : ''}`;
      div.innerHTML = `
        <div style="font-weight:bold; font-size:0.95rem; margin-bottom:4px; color:#fff;">${t.text}</div>
        <div style="font-size:0.85rem; color:#00f2fe; margin-bottom:4px;">📊 <b>Potensi Meja:</b> ${t.boardPotential}</div>
        <div style="font-size:0.85rem; color:#ff4d4d;">${t.worstCase}</div>
      `;
      threatContainer.appendChild(div);
    });
  }

  // 5. Kombinasi Terbaik Saat Ini
  const resultNameEl = document.getElementById('result-name');
  const bestGroup = document.getElementById('best-cards');
  if (bestGroup) bestGroup.innerHTML = '';

  if (totalCards.length > 0) {
    if (resultNameEl) resultNameEl.innerText = myBest.rankName;
    if (myBest.cards && myBest.cards.length > 0 && bestGroup) {
      myBest.cards.forEach(c => bestGroup.appendChild(createFilledCardUI(c, () => {})));
    }
  } else {
    if (resultNameEl) resultNameEl.innerText = "Masukkan Kartu Tangan / Komunitas";
  }

  // 6. Pembaharuan Saran Betting Strategi
  const strat = PokerStrategy.getStrategy(activeHandCards, activeCommunityCards, myBest);
  
  const actionEl = document.getElementById('strat-action');
  if (actionEl) {
    actionEl.innerText = strat.action;
    
    if (strat.action.includes('RAISE') || strat.action.includes('ALL-IN')) {
      actionEl.style.borderColor = '#00ff87';
      actionEl.style.color = '#00ff87';
    } else if (strat.action.includes('CALL') || strat.action.includes('BET')) {
      actionEl.style.borderColor = '#00f2fe';
      actionEl.style.color = '#00f2fe';
    } else {
      actionEl.style.borderColor = '#ff4d4d';
      actionEl.style.color = '#ff4d4d';
    }
  }

  const stratAmountEl = document.getElementById('strat-amount');
  const stratReasonEl = document.getElementById('strat-reason');
  if (stratAmountEl) stratAmountEl.innerText = strat.amount || '0 Chips';
  if (stratReasonEl) stratReasonEl.innerText = strat.reason || 'Masukkan kartu untuk mendapatkan saran strategi.';
}

function renderBoard() {
  const handContainer = document.getElementById('hand-cards');
  const commContainer = document.getElementById('community-cards');

  if (handContainer) handContainer.innerHTML = '';
  if (commContainer) commContainer.innerHTML = '';

  currentHand.forEach((card, index) => {
    if (!handContainer) return;
    if (card) {
      handContainer.appendChild(createFilledCardUI(card, () => {
        currentHand[index] = null;
        renderBoard();
      }));
    } else {
      handContainer.appendChild(createPlaceholderUI(() => openPicker('hand', index)));
    }
  });

  currentCommunity.forEach((card, index) => {
    if (!commContainer) return;
    if (card) {
      commContainer.appendChild(createFilledCardUI(card, () => {
        currentCommunity[index] = null;
        renderBoard();
      }));
    } else {
      commContainer.appendChild(createPlaceholderUI(() => openPicker('community', index)));
    }
  });

  updateEvaluation();
}

// Reset Hand & Community
document.getElementById('btn-clear-hand')?.addEventListener('click', () => {
  currentHand = [null, null];
  renderBoard();
});

document.getElementById('btn-clear-comm')?.addEventListener('click', () => {
  currentCommunity = [null, null, null, null, null];
  renderBoard();
});

// Modal Picker (8 Baris)
const modal = document.getElementById('card-picker-modal');
const fullCardGrid = document.getElementById('full-card-grid');

function openPicker(type, index) {
  activeTarget = { type, index };
  const targetLabel = document.getElementById('target-label');
  if (targetLabel) {
    targetLabel.innerText = type === 'hand' ? `Tangan Slot #${index + 1}` : `Komunitas Slot #${index + 1}`;
  }

  renderFullCardGrid();
  if (modal) modal.classList.remove('hidden');
}

function renderFullCardGrid() {
  if (!fullCardGrid) return;
  fullCardGrid.innerHTML = '';

  const chosenCards = [...currentHand, ...currentCommunity].filter(c => c !== null);
  const suits = [SUITS.SPADES, SUITS.HEARTS, SUITS.CLUBS, SUITS.DIAMONDS];
  
  const allRanks = [...RANKS].reverse(); 
  const ranksHigh = allRanks.slice(0, 7); // A - 8
  const ranksLow = allRanks.slice(7);     // 7 - 2

  suits.forEach(suit => {
    // Baris 1: High Cards
    const row1 = document.createElement('div');
    row1.className = 'suit-row';

    const label1 = document.createElement('div');
    label1.className = `suit-label ${suit.color}`;
    label1.innerText = suit.symbol;
    row1.appendChild(label1);

    ranksHigh.forEach(rank => {
      const btn = createPickerButton(rank, suit, chosenCards);
      row1.appendChild(btn);
    });
    fullCardGrid.appendChild(row1);

    // Baris 2: Low Cards
    const row2 = document.createElement('div');
    row2.className = 'suit-row';

    const label2 = document.createElement('div');
    label2.className = 'suit-label';
    label2.innerText = '';
    row2.appendChild(label2);

    ranksLow.forEach(rank => {
      const btn = createPickerButton(rank, suit, chosenCards);
      row2.appendChild(btn);
    });
    fullCardGrid.appendChild(row2);
  });
}

function createPickerButton(rank, suit, chosenCards) {
  const btn = document.createElement('button');
  btn.className = `btn-card-select ${suit.color}`;
  btn.innerText = rank.label;

  const isUsed = chosenCards.some(
    c => c.rank.value === rank.value && (c.suit.symbol || c.suit) === suit.symbol
  );

  if (isUsed) {
    btn.classList.add('disabled');
    btn.disabled = true;
  } else {
    btn.addEventListener('click', () => selectCard(rank, suit));
  }

  return btn;
}

function selectCard(rank, suit) {
  const newCard = new Card(rank, suit);

  if (activeTarget.type === 'hand') {
    currentHand[activeTarget.index] = newCard;
  } else {
    currentCommunity[activeTarget.index] = newCard;
  }

  if (modal) modal.classList.add('hidden');
  renderBoard();
}

document.getElementById('close-modal')?.addEventListener('click', () => {
  if (modal) modal.classList.add('hidden');
});

// Inisialisasi Tampilan Awal
renderBoard();
