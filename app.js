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

  // 5. Pembaharuan Saran Betting Strategi (Blind 600 / 1200)
  const strat = PokerStrategy.getBettingRecommendation(currentHand, currentCommunity, 1200);
  
  const actionEl = document.getElementById('strat-action');
  actionEl.innerText = strat.action;
  actionEl.style.borderColor = strat.action.includes('RAISE') || strat.action.includes('BET') ? '#00ff66' : 
                               strat.action.includes('CALL') ? '#ffbe0b' : '#ff0055';
  actionEl.style.color = actionEl.style.borderColor;

  document.getElementById('strat-amount').innerText = strat.amount > 0 ? `${strat.amount.toLocaleString('id-ID')} Chips` : '0 Chips / Free';
  document.getElementById('strat-reason').innerText = strat.reason;
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
