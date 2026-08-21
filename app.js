import { Deck } from './deck.js';
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

function updateEvaluation() {
  // 1. Evaluasi Kartu Tangan Saja
  const handResultText = PokerEvaluator.evaluateHoleCards(currentHand);
  document.getElementById('hand-only-result').innerText = handResultText;

  // 2. Evaluasi Total (Tangan + Komunitas)
  const totalCards = [...currentHand, ...currentCommunity];
  const bestResult = PokerEvaluator.getBestHand(totalCards);

  document.getElementById('result-name').innerText = bestResult.rankName;
  
  const bestGroup = document.getElementById('best-cards');
  bestGroup.innerHTML = '';
  if (bestResult.cards) {
    bestResult.cards.forEach(c => bestGroup.appendChild(createCardUI(c)));
  }
}

function renderBoard() {
  const handContainer = document.getElementById('hand-cards');
  const commContainer = document.getElementById('community-cards');

  handContainer.innerHTML = '';
  commContainer.innerHTML = '';

  currentHand.forEach((card, idx) => {
    handContainer.appendChild(createCardUI(card, () => openPicker('hand', idx)));
  });

  currentCommunity.forEach((card, idx) => {
    commContainer.appendChild(createCardUI(card, () => openPicker('community', idx)));
  });

  updateEvaluation();
}

function dealRandom() {
  const deck = new Deck();
  deck.shuffle();
  currentHand = deck.deal(2);
  currentCommunity = deck.deal(5);
  renderBoard();
}

// System Modal Picker Kartu Manual
const modal = document.getElementById('card-picker-modal');
const pickerGrid = document.getElementById('picker-grid');

function openPicker(type, index) {
  activeSlot = { type, index };
  pickerGrid.innerHTML = '';

  // Tampilkan seluruh 52 kartu untuk dipilih
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

document.getElementById('close-modal').addEventListener('click', () => {
  modal.classList.add('hidden');
});

document.getElementById('btn-deal').addEventListener('click', dealRandom);

// Inisialisasi awal
dealRandom();
