import { Card, RANKS, SUITS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

let currentHand = [];
let currentCommunity = [];
let activeSlot = { type: null, index: null };

function createCardUI(card, onClick = null) {
  const cardDiv = document.createElement('div');
  cardDiv.className = `card ${card.suit.color}`;
  cardDiv.innerHTML = `
    <div>${card.rank.label}</div>
    <div style="text-align: center;">${card.suit.symbol}</div>
  `;
  if (onClick) cardDiv.addEventListener('click', onClick);
  return cardDiv;
}

function createEmptySlotUI(onClick) {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card empty-slot';
  cardDiv.innerHTML = '+';
  cardDiv.addEventListener('click', onClick);
  return cardDiv;
}

function updateEvaluation() {
  // 1. Evaluasi Murni Kartu Tangan
  document.getElementById('hand-only-result').innerText = 
    PokerEvaluator.evaluateHoleCards(currentHand);

  // 2. Evaluasi Murni Kartu Komunitas
  document.getElementById('community-only-result').innerText = 
    PokerEvaluator.evaluatePartialCards(currentCommunity);

  // 3. Evaluasi Kombinasi Tertinggi Meja (Gabungan)
  const totalCards = [...currentHand, ...currentCommunity];
  const bestResult = PokerEvaluator.getBestHand(totalCards);

  document.getElementById('result-name').innerText = bestResult.rankName;
  
  const bestGroup = document.getElementById('best-cards');
  bestGroup.innerHTML = '';
  if (bestResult.cards && bestResult.cards.length > 0) {
    bestResult.cards.forEach(c => bestGroup.appendChild(createCardUI(c)));
  }
}

function renderBoard() {
  const handContainer = document.getElementById('hand-cards');
  const commContainer = document.getElementById('community-cards');

  handContainer.innerHTML = '';
  commContainer.innerHTML = '';

  // Render Kartu Tangan
  currentHand.forEach((card, idx) => {
    handContainer.appendChild(createCardUI(card, () => openPicker('hand', idx)));
  });
  if (currentHand.length < 2) {
    handContainer.appendChild(createEmptySlotUI(() => openPicker('hand', currentHand.length)));
  }

  // Render Kartu Komunitas
  currentCommunity.forEach((card, idx) => {
    commContainer.appendChild(createCardUI(card, () => openPicker('community', idx)));
  });
  if (currentCommunity.length < 5) {
    commContainer.appendChild(createEmptySlotUI(() => openPicker('community', currentCommunity.length)));
  }

  updateEvaluation();
}

// Modal Picker System
const modal = document.getElementById('card-picker-modal');
const pickerGrid = document.getElementById('picker-grid');

function openPicker(type, index) {
  activeSlot = { type, index };
  pickerGrid.innerHTML = '';

  for (const suitKey in SUITS) {
    for (const rank of RANKS) {
      const card = new Card(rank, SUITS[suitKey]);
      const cardUI = createCardUI(card, () => selectCard(card));
      pickerGrid.appendChild(cardUI);
    }
  }
  modal.classList.remove('hidden');
}

function selectCard(selectedCard) {
  if (activeSlot.type === 'hand') {
    currentHand[activeSlot.index] = selectedCard;
  } else if (activeSlot.type === 'community') {
    currentCommunity[activeSlot.index] = selectedCard;
  }
  modal.classList.add('hidden');
  renderBoard();
}

// Tombol Tambah Kartu
document.getElementById('btn-add-hand').addEventListener('click', () => {
  if (currentHand.length < 2) openPicker('hand', currentHand.length);
});

document.getElementById('btn-add-community').addEventListener('click', () => {
  if (currentCommunity.length < 5) openPicker('community', currentCommunity.length);
});

document.getElementById('close-modal').addEventListener('click', () => {
  modal.classList.add('hidden');
});

// Inisialisasi Tampilan
renderBoard();
