import { Card, RANKS, SUITS } from './card.js';
import { PokerEvaluator } from './evaluator.js';
import { PokerStrategy } from './strategy.js';

let currentHand = [null, null]; // Slot 2 Kartu Tangan
let currentCommunity = [null, null, null, null, null]; // Slot 5 Kartu Komunitas
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
  document.getElementById('hole-only-hand').innerText = 
    PokerEvaluator.evaluateHoleCardsOnly(activeHandCards);

  // 2. Evaluasi Tangan + Meja / Kartu Komunitas Murni
  const myBest = PokerEvaluator.getBestHand(totalCards);
  document.getElementById('my-best-hand').innerText = myBest.rankName;

  const percentage = PokerEvaluator.calculateStrength(activeHandCards, activeCommunityCards);
  document.getElementById('strength-bar').style.width = `${percentage}%`;
  document.getElementById('strength-percent').innerText = `${percentage}%`;

  // 3. Analisis Potensi Ancaman & Counter Kartu Terkuat (The Nuts)
  const threatContainer = document.getElementById('board-threats');
  threatContainer.innerHTML = '';
  const threats = PokerEvaluator.analyzeBoardThreats(activeCommunityCards);
  
  threats.forEach(t => {
    const div = document.createElement('div');
    div.className = `potential-item ${t.safe ? 'safe' : ''}`;
    div.innerHTML = `
      <div>${t.text}</div>
      ${t.nutText ? `<span class="nut-card">${t.nutText}</span>` : ''}
    `;
    threatContainer.appendChild(div);
  });

  // 4. Kombinasi Terbaik Saat Ini
  const resultNameEl = document.getElementById('result-name');
  const bestGroup = document.getElementById('best-cards');
  bestGroup.innerHTML = '';

  if (totalCards.length > 0) {
    resultNameEl.innerText = myBest.rankName;
    if (myBest.cards && myBest.cards.length > 0) {
      myBest.cards.forEach(c => bestGroup.appendChild(createFilledCardUI(c, () => {})));
    }
  } else {
    resultNameEl.innerText = "Masukkan Kartu Tangan / Komunitas";
  }

  // 5. Pembaharuan Saran Betting Strategi (Blind 300 / 600)
  const strat = PokerStrategy.getRecommendation(currentHand, currentCommunity, null, 600, 600);
  
  const actionEl = document.getElementById('strat-action');
  actionEl.innerText = strat.action;
  
  // Penyesuaian Warna Border
  if (strat.color === 'danger' || strat.action.includes('RAISE') || strat.action.includes('ALL-IN')) {
    actionEl.style.borderColor = '#00ff66';
  } else if (strat.color === 'warning' || strat.action.includes('WARNING')) {
    actionEl.style.borderColor = '#ffbe0b';
  } else if (strat.action.includes('CALL') || strat.action.includes('BET')) {
    actionEl.style.borderColor = '#00b4d8';
  } else {
    actionEl.style.borderColor = '#ff0055';
  }
  
  actionEl.style.color = actionEl.style.borderColor;

  // Output Nominal Taruhan & Teks Alasan Strategi
  document.getElementById('strat-amount').innerText = strat.size || '0 Chips';
  document.getElementById('strat-reason').innerText = strat.text || 'Masukkan kartu untuk mendapatkan saran strategi.';
}

function renderBoard() {
  const handContainer = document.getElementById('hand-cards');
  const commContainer = document.getElementById('community-cards');

  handContainer.innerHTML = '';
  commContainer.innerHTML = '';

  // Render Slot Kartu Tangan (2 Slot)
  currentHand.forEach((card, index) => {
    if (card) {
      handContainer.appendChild(createFilledCardUI(card, () => {
        currentHand[index] = null;
        renderBoard();
      }));
    } else {
      handContainer.appendChild(createPlaceholderUI(() => openPicker('hand', index)));
    }
  });

  // Render Slot Kartu Komunitas (5 Slot)
  currentCommunity.forEach((card, index) => {
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
document.getElementById('btn-clear-hand').addEventListener('click', () => {
  currentHand = [null, null];
  renderBoard();
});

document.getElementById('btn-clear-comm').addEventListener('click', () => {
  currentCommunity = [null, null, null, null, null];
  renderBoard();
});

// Modal Picker (4 Baris)
const modal = document.getElementById('card-picker-modal');
const fullCardGrid = document.getElementById('full-card-grid');

function openPicker(type, index) {
  activeTarget = { type, index };
  document.getElementById('target-label').innerText = 
    type === 'hand' ? `Tangan Slot #${index + 1}` : `Komunitas Slot #${index + 1}`;

  renderFullCardGrid();
  modal.classList.remove('hidden');
}

function renderFullCardGrid() {
  fullCardGrid.innerHTML = '';

  const chosenCards = [...currentHand, ...currentCommunity].filter(c => c !== null);

  Object.keys(SUITS).forEach(suitKey => {
    const suit = SUITS[suitKey];
    const row = document.createElement('div');
    row.className = 'suit-row';

    const label = document.createElement('div');
    label.className = `suit-label ${suit.color}`;
    label.innerText = suit.symbol;
    row.appendChild(label);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'rank-buttons';

    [...RANKS].reverse().forEach(rank => {
      const btn = document.createElement('button');
      btn.className = `btn-card-select ${suit.color}`;
      btn.innerText = rank.label;

      const isUsed = chosenCards.some(c => c.rank.value === rank.value && c.suit.symbol === suit.symbol);
      if (isUsed) {
        btn.classList.add('disabled');
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => selectCard(rank, suit));
      }

      btnContainer.appendChild(btn);
    });

    row.appendChild(btnContainer);
    fullCardGrid.appendChild(row);
  });
}

function selectCard(rank, suit) {
  const newCard = new Card(rank, suit);

  if (activeTarget.type === 'hand') {
    currentHand[activeTarget.index] = newCard;
  } else {
    currentCommunity[activeTarget.index] = newCard;
  }

  modal.classList.add('hidden');
  renderBoard();
}

document.getElementById('close-modal').addEventListener('click', () => modal.classList.add('hidden'));

// Inisialisasi Tampilan Awal
renderBoard();
