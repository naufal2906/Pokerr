import { Card, RANKS, SUITS } from './card.js';
import { PokerEvaluator } from './evaluator.js';

let currentHand = [];
let currentCommunity = [];
let activeTarget = null;
let selectedSuit = null;

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
  const totalCards = [...currentHand, ...currentCommunity];

  // 1. Evaluasi Tangan Sendiri + Win Equity
  const myBest = PokerEvaluator.getBestHand(totalCards);
  document.getElementById('my-best-hand').innerText = myBest.rankName;

  const percentage = PokerEvaluator.calculateStrength(currentHand, currentCommunity);
  document.getElementById('strength-bar').style.width = `${percentage}%`;
  document.getElementById('strength-percent').innerText = `${percentage}%`;

  // 2. Evaluasi Murni Kartu Komunitas (Board Only)
  document.getElementById('board-only-hand').innerText = 
    PokerEvaluator.evaluateBoardOnly(currentCommunity);

  // 3. Analisis Potensi Ancaman Meja (Board Threat)
  const threatContainer = document.getElementById('board-threats');
  threatContainer.innerHTML = '';
  const threats = PokerEvaluator.analyzeBoardThreats(currentCommunity);
  threats.forEach(t => {
    const div = document.createElement('div');
    div.className = `potential-item ${t.safe ? 'safe' : ''}`;
    div.innerText = t.text;
    threatContainer.appendChild(div);
  });

  // 4. Tampilkan 5 Kartu Terbaik Anda
  document.getElementById('result-name').innerText = myBest.rankName;
  const bestGroup = document.getElementById('best-cards');
  bestGroup.innerHTML = '';
  if (myBest.cards && myBest.cards.length > 0) {
    myBest.cards.forEach(c => bestGroup.appendChild(createCardUI(c)));
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

// Modal System Picker
const modal = document.getElementById('card-picker-modal');
const rankStep = document.getElementById('rank-step');
const rankGrid = document.getElementById('rank-grid');

function openPicker(target) {
  activeTarget = target;
  selectedSuit = null;
  document.getElementById('target-label').innerText = target === 'hand' ? 'Tangan' : 'Komunitas';
  
  document.querySelectorAll('.btn-suit').forEach(btn => btn.classList.remove('selected'));
  rankStep.classList.add('hidden');
  modal.classList.remove('hidden');
}

document.querySelectorAll('.btn-suit').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-suit').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    selectedSuit = SUITS[btn.dataset.suit];
    renderRankGrid();
    rankStep.classList.remove('hidden');
  });
});

function renderRankGrid() {
  rankGrid.innerHTML = '';
  [...RANKS].reverse().forEach(rank => {
    const btn = document.createElement('button');
    btn.className = 'btn-rank';
    btn.innerText = rank.label;
    btn.addEventListener('click', () => addCard(rank, selectedSuit));
    rankGrid.appendChild(btn);
  });
}

function addCard(rank, suit) {
  const newCard = new Card(rank, suit);

  if (activeTarget === 'hand') {
    if (currentHand.length >= 2) currentHand.shift();
    currentHand.push(newCard);
  } else {
    if (currentCommunity.length >= 5) currentCommunity.shift();
    currentCommunity.push(newCard);
  }

  modal.classList.add('hidden');
  renderBoard();
}

document.getElementById('btn-open-hand').addEventListener('click', () => openPicker('hand'));
document.getElementById('btn-open-comm').addEventListener('click', () => openPicker('community'));
document.getElementById('close-modal').addEventListener('click', () => modal.classList.add('hidden'));

renderBoard();
