import { Card, RANKS, SUITS } from './card.js';

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suitKey in SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(rank, SUITS[suitKey]));
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count) {
    return this.cards.splice(0, count);
  }
}
