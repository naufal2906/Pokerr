import { Card, RANKS, SUITS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

let currentHand = [];
let currentCommunity = [];

function createCardUI(card) {
  const cardDiv = document.createElement('div');
  cardDiv.className = `card ${card.suit.color}`;
  cardDiv.innerHTML = `
    <div>${card.rank.label}</div>
    <div style="text-align: center;">${card.suit.symbol}</div>
  `;
  return cardDiv;
}

function updateEvaluation() {
  // 1. Evaluasi Tangan
  document.getElementById('hand-only-result').innerText = 
    PokerEvaluator.evaluateHoleCards(currentHand);

  // 2. Persentase Kekuatan Kartu
  const percentage = PokerEvaluator.calculateStrength(currentHand, currentCommunity);
  document.getElementById('strength-bar').style.width = `${percentage}%`;
  document.getElementById('strength-percent').innerText = `${percentage}%`;

  // 3. Kombinasi Tertinggi Meja
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

  currentHand.forEach(card => handContainer.appendChild(createCardUI(card)));
  currentCommunity.forEach(card => commContainer.appendChild(createCardUI(card)));

  updateEvaluation();
}

// Handler Tambah Kartu Tangan Inline
document.getElementById('btn-add-hand').addEventListener('click', () => {
  if (currentHand.length >= 2) return alert('Kartu tangan maksimal 2!');
  const rankVal = Number(document.getElementById('hand-rank-select').value);
  const suitKey = document.getElementById('hand-suit-select').value;

  if (!rankVal || !suitKey) return alert('Pilih Nilai dan Simbol terlebih dahulu!');

  const rank = RANKS.find(r => r.value === rankVal);
  const suit = SUITS[suitKey];
  currentHand.push(new Card(rank, suit));
  renderBoard();
});

// Handler Tambah Kartu Komunitas Inline
document.getElementById('btn-add-community').addEventListener('click', () => {
  if (currentCommunity.length >= 5) return alert('Kartu komunitas maksimal 5!');
  const rankVal = Number(document.getElementById('comm-rank-select').value);
  const suitKey = document.getElementById('comm-suit-select').value;

  if (!rankVal || !suitKey) return alert('Pilih Nilai dan Simbol terlebih dahulu!');

  const rank = RANKS.find(r => r.value === rankVal);
  const suit = SUITS[suitKey];
  currentCommunity.push(new Card(rank, suit));
  renderBoard();
});

// Inisialisasi awal
renderBoard();
