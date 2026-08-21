export const SUITS = {
  SPADES: { symbol: '♠', name: 'Spades', color: 'black' },
  HEARTS: { symbol: '♥', name: 'Hearts', color: 'red' },
  CLUBS: { symbol: '♣', name: 'Clubs', color: 'black' },
  DIAMONDS: { symbol: '♦', name: 'Diamonds', color: 'red' }
};

export const RANKS = [
  { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' },
  { value: 5, label: '5' }, { value: 6, label: '6' }, { value: 7, label: '7' },
  { value: 8, label: '8' }, { value: 9, label: '9' }, { value: 10, label: '10' },
  { value: 11, label: 'J' }, { value: 12, label: 'Q' }, { value: 13, label: 'K' },
  { value: 14, label: 'A' }
];

export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }

  toString() {
    return `${this.rank.label}${this.suit.symbol}`;
  }
}
