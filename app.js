import { Deck } from './deck.js';
import { PokerEvaluator } from './evaluator.js';

const deck = new Deck();

function createCardUI(card) {
  const cardDiv = document.createElement('div');
  cardDiv.className = `card ${card.suit.color}`;
  cardDiv.innerHTML = `<div>${card.rank.label}</div><div>${card.suit.symbol}</div>`;
  return cardDiv;
}

function renderCards(containerId, cards) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  cards.forEach(card => container.appendChild(createCardUI(card)));
}

function playHand() {
  deck.reset();
  deck.shuffle();

  const hand = deck.deal(2);
  const community = deck.deal(5);
  const totalCards = [...hand, ...community];

  renderCards('hand-cards', hand);
  renderCards('community-cards', community);

  const bestResult = PokerEvaluator.getBestHand(totalCards);

  document.getElementById('result-name').innerText = bestResult.rankName;
  renderCards('best-cards', bestResult.cards);
}

document.getElementById('btn-deal').addEventListener('click', playHand);
playHand();
