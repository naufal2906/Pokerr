class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.deadCards = [];
    this.activeSlot = { type: 'hole', index: 0 };
    this.selectedSuit = '♠';
    this.init();
  }

  init() {
    this.renderRankKeypad();
    this.bindSuitTabs();
    this.bindSlots();
    this.bindPotOddsEvents();
    this.bindPipMode();
    this.bindReset();
    this.render();
  }

  renderRankKeypad() {
    const grid = document.getElementById('rank-grid');
    if (!grid) return;
    const isRed = this.selectedSuit === '♥' || this.selectedSuit === '♦';
    const usedSet = new Set([
      ...this.holeCards.filter(Boolean).map(c => `${c.label}${c.suit}`),
      ...this.communityCards.filter(Boolean).map(c => `${c.label}${c.suit}`)
    ]);

    grid.innerHTML = PokerEvaluator.RANKS.map(r => {
      const code = `${r.label}${this.selectedSuit}`;
      const isUsed = usedSet.has(code);
      return `<button type="button" class="rank-btn ${isRed ? 'red' : ''} ${isUsed ? 'used' : ''}" data-val="${r.value}" data-label="${r.label}">${r.label}</button>`;
    }).join('');

    grid.querySelectorAll('.rank-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = {
          value: Number(btn.dataset.val),
          label: btn.dataset.label,
          suit: this.selectedSuit
        };
        this.assignCardToActiveSlot(card);
      });
    });
  }

  bindSuitTabs() {
    document.querySelectorAll('.suit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.suit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedSuit = btn.dataset.suit;
        this.renderRankKeypad();
      });
    });
  }

  bindSlots() {
    document.querySelectorAll('.card-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const type = slot.dataset.type;
        const index = Number(slot.dataset.index);

        // Jika slot sudah terisi dan diklik ulang, hapus isinya
        if (this.activeSlot.type === type && this.activeSlot.index === index) {
          if (type === 'hole' && this.holeCards[index]) {
            this.holeCards[index] = null;
          } else if (type === 'comm' && this.communityCards[index]) {
            this.communityCards[index] = null;
          }
        }
        this.activeSlot = { type, index };
        this.render();
      });
    });
  }

  assignCardToActiveSlot(card) {
    const { type, index } = this.activeSlot;
    if (type === 'hole') {
      this.holeCards[index] = card;
      if (index === 0 && !this.holeCards[1]) {
        this.activeSlot = { type: 'hole', index: 1 };
      } else if (index === 1 && !this.communityCards[0]) {
        this.activeSlot = { type: 'comm', index: 0 };
      }
    } else {
      this.communityCards[index] = card;
      if (index < 4) {
        this.activeSlot = { type: 'comm', index: index + 1 };
      }
    }
    this.render();
  }

  bindPotOddsEvents() {
    const potInput = document.getElementById('input-pot');
    const betInput = document.getElementById('input-bet');
    if (potInput) potInput.addEventListener('input', () => this.render());
    if (betInput) betInput.addEventListener('input', () => this.render());

    document.querySelectorAll('.qbet').forEach(btn => {
      btn.addEventListener('click', () => {
        if (betInput) {
          betInput.value = btn.dataset.bet;
          this.render();
        }
      });
    });
  }

  bindReset() {
    const resetBtn = document.getElementById('btn-reset');
    if (!resetBtn) return;
    resetBtn.addEventListener('click', () => {
      this.holeCards = [null, null];
      this.communityCards = [null, null, null, null, null];
      this.deadCards = [];
      this.activeSlot = { type: 'hole', index: 0 };
      const betInput = document.getElementById('input-bet');
      if (betInput) betInput.value = '600';
      this.render();
    });
  }

  bindPipMode() {
    const pipBtn = document.getElementById('btn-pip-mode');
    const hudContainer = document.getElementById('hud-pip-container');
    const header = document.querySelector('.app-header');
    if (!pipBtn || !hudContainer) return;

    pipBtn.addEventListener('click', async () => {
      if ('documentPictureInPicture' in window) {
        try {
          const pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 350,
            height: 440
          });

          [...document.styleSheets].forEach(sheet => {
            try {
              const rules = [...sheet.cssRules].map(r => r.cssText).join('');
              const style = document.createElement('style');
              style.textContent = rules;
              pipWindow.document.head.appendChild(style);
            } catch (e) {
              if (sheet.href) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = sheet.href;
                pipWindow.document.head.appendChild(link);
              }
            }
          });

          pipWindow.document.body.style.background = '#070b14';
          pipWindow.document.body.style.margin = '6px';
          pipWindow.document.body.append(hudContainer);

          pipWindow.addEventListener('pagehide', () => {
            header.insertAdjacentElement('afterend', hudContainer);
          });
          return;
        } catch (err) {
          console.warn('PiP gagal dibuka:', err);
        }
      }

      alert(
        'Mode Layar Mengambang di HP:\n' +
        '• Android: Buka Recent Apps -> tahan ikon browser -> pilih "Split Screen" atau "Pop-up View".\n' +
        '• iPhone / iPad: Gunakan fitur Slide Over / Split View atau buka tab berdampingan.'
      );
    });
  }

  render() {
    // 1. Update Slot Kartu Tangan & Komunitas
    const defaultCommLabels = ['F1', 'F2', 'F3', 'T', 'R'];
    document.querySelectorAll('.card-slot').forEach(slot => {
      const type = slot.dataset.type;
      const idx = Number(slot.dataset.index);
      const card = type === 'hole' ? this.holeCards[idx] : this.communityCards[idx];

      slot.classList.remove('active-slot', 'filled', 'red');
      if (this.activeSlot.type === type && this.activeSlot.index === idx) {
        slot.classList.add('active-slot');
      }

      if (card) {
        slot.textContent = `${card.label}${card.suit}`;
        slot.classList.add('filled');
        if (card.suit === '♥' || card.suit === '♦') slot.classList.add('red');
      } else {
        slot.textContent = type === 'hole' ? '?' : defaultCommLabels[idx];
      }
    });

    // 2. Update Status Fase Meja
    const commCount = this.communityCards.filter(Boolean).length;
    const stageEl = document.getElementById('stage-badge');
    if (stageEl) {
      stageEl.textContent = commCount === 0 ? 'PRE-FLOP' : commCount === 3 ? 'FLOP' : commCount === 4 ? 'TURN' : commCount === 5 ? 'RIVER' : 'SETUP';
    }

    // 3. Render Keypad
    this.renderRankKeypad();

    // 4. Hitung & Render HUD Atas + Bawah + Pot Odds
    const potVal = parseFloat(document.getElementById('input-pot')?.value) || 0;
    const betVal = parseFloat(document.getElementById('input-bet')?.value) || 0;
    const hud = PokerEvaluator.getHudSummary(this.holeCards, this.communityCards, this.deadCards, potVal, betVal);

    const outsEl = document.getElementById('hud-outs-chips');
    const boardPctEl = document.getElementById('hud-board-pct');
    const heroTargetEl = document.getElementById('hud-hero-target');
    const handBadgeEl = document.getElementById('current-hand-badge');
    const bannerEl = document.getElementById('decision-banner');
    const verdictEl = document.getElementById('decision-verdict');
    const detailEl = document.getElementById('decision-detail');

    if (!hud) {
      if (outsEl) outsEl.innerHTML = '<span class="muted-text">Pilih 2 kartu tangan dulu</span>';
      if (boardPctEl) boardPctEl.textContent = 'Belum Ada Kartu Meja';
      if (heroTargetEl) heroTargetEl.textContent = 'Pilih 2 Kartu Tangan';
      if (handBadgeEl) handBadgeEl.textContent = '-';
      if (bannerEl) bannerEl.className = 'decision-banner verdict-call';
      if (verdictEl) verdictEl.textContent = 'MENUNGGU KARTU';
      if (detailEl) detailEl.textContent = 'Pilih 2 kartu tangan untuk mulai menghitung.';
      return;
    }

    if (handBadgeEl) handBadgeEl.textContent = hud.currentBestName;

    if (outsEl) {
      outsEl.innerHTML = hud.holeOutCards.map(code => {
        const isRed = code.includes('♥') || code.includes('♦');
        const isDead = this.deadCards.includes(code);
        return `<span class="out-pill ${isRed ? 'red' : 'black'} ${isDead ? 'dead' : ''}" data-card="${code}">${code}</span>`;
      }).join('');

      outsEl.querySelectorAll('.out-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const c = pill.dataset.card;
          this.deadCards = this.deadCards.includes(c)
            ? this.deadCards.filter(x => x !== c)
            : [...this.deadCards, c];
          this.render();
        });
      });
    }

    if (boardPctEl) boardPctEl.textContent = hud.boardPctText;
    if (heroTargetEl) heroTargetEl.textContent = hud.bestTargetText;

    if (bannerEl && verdictEl && detailEl) {
      bannerEl.className = `decision-banner ${hud.decision.badgeClass}`;
      verdictEl.textContent = hud.decision.verdict;
      detailEl.textContent = hud.decision.detail;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.pokerApp = new PokerApp();
});
