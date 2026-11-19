class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.deadCards = [];
    this.activeSlot = { type: 'hole', index: 0 };
    this.selectedSuit = '♠';

    this.mediaStream = null;
    this.scanTimer = null;
    this.ocrWorker = null;
    this.isScanningFrame = false;
    this.commYPercent = 0.315;
    this.holeYPercent = 0.625;

    this.loadSavedState();
    this.init();
  }

  init() {
    this.renderRankKeypad();
    this.bindSuitTabs();
    this.bindSlots();
    this.bindPotOddsEvents();
    this.bindAutoScanEvents();
    this.bindGlassMode();
    this.bindReset();
    this.render();
  }

  saveState() {
    try {
      const state = {
        holeCards: this.holeCards,
        communityCards: this.communityCards,
        deadCards: this.deadCards,
        pot: document.getElementById('input-pot')?.value || '1800',
        bet: document.getElementById('input-bet')?.value || '600'
      };
      localStorage.setItem('poker_hud_sticky_state', JSON.stringify(state));
    } catch (e) {}
  }

  loadSavedState() {
    try {
      const raw = localStorage.getItem('poker_hud_sticky_state');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.holeCards) this.holeCards = state.holeCards;
      if (state.communityCards) this.communityCards = state.communityCards;
      if (state.deadCards) this.deadCards = state.deadCards;
      setTimeout(() => {
        const potEl = document.getElementById('input-pot');
        const betEl = document.getElementById('input-bet');
        if (potEl && state.pot) potEl.value = state.pot;
        if (betEl && state.bet) betEl.value = state.bet;
        this.render();
      }, 50);
    } catch (e) {}
  }

  bindGlassMode() {
    const glassBtn = document.getElementById('btn-glass-mode');
    if (!glassBtn) return;
    glassBtn.addEventListener('click', () => {
      document.body.classList.toggle('glass-mode');
      glassBtn.classList.toggle('active');
    });
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

        if (this.activeSlot.type === type && this.activeSlot.index === index) {
          if (type === 'hole' && this.holeCards[index]) this.holeCards[index] = null;
          else if (type === 'comm' && this.communityCards[index]) this.communityCards[index] = null;
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
      if (index === 0 && !this.holeCards[1]) this.activeSlot = { type: 'hole', index: 1 };
      else if (index === 1 && !this.communityCards[0]) this.activeSlot = { type: 'comm', index: 0 };
    } else {
      this.communityCards[index] = card;
      if (index < 4) this.activeSlot = { type: 'comm', index: index + 1 };
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
          const addBet = Number(btn.dataset.bet);
          betInput.value = addBet;
          if (potInput && addBet > 0) {
            const curPot = Number(potInput.value) || 0;
            potInput.value = curPot + addBet;
          }
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
      const potInput = document.getElementById('input-pot');
      const betInput = document.getElementById('input-bet');
      if (potInput) potInput.value = '1800';
      if (betInput) betInput.value = '600';
      localStorage.removeItem('poker_hud_sticky_state');
      this.render();
    });
  }

  bindAutoScanEvents() {
    const btnStart = document.getElementById('btn-auto-scan');
    const btnStop = document.getElementById('btn-stop-scan');
    const btnCalib = document.getElementById('btn-calibrate');
    const calibBox = document.getElementById('calib-controls');
    const rangeCommY = document.getElementById('range-comm-y');
    const rangeHoleY = document.getElementById('range-hole-y');

    if (btnStart) btnStart.addEventListener('click', () => this.startScreenScan());
    if (btnStop) btnStop.addEventListener('click', () => this.stopScreenScan());
    if (btnCalib && calibBox) {
      btnCalib.addEventListener('click', () => calibBox.classList.toggle('hidden'));
    }
    if (rangeCommY) {
      rangeCommY.addEventListener('input', (e) => {
        this.commYPercent = Number(e.target.value) / 100;
        document.getElementById('val-comm-y').textContent = `${e.target.value}%`;
      });
    }
    if (rangeHoleY) {
      rangeHoleY.addEventListener('input', (e) => {
        this.holeYPercent = Number(e.target.value) / 100;
        document.getElementById('val-hole-y').textContent = `${e.target.value}%`;
      });
    }
  }

  async startScreenScan() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('Gunakan Google Chrome di Android untuk fitur Auto-Scan layar!');
      return;
    }

    try {
      const badge = document.getElementById('scan-status-badge');
      if (badge) badge.textContent = 'Memuat OCR...';

      if (!this.ocrWorker && window.Tesseract) {
        this.ocrWorker = await Tesseract.createWorker('eng');
        await this.ocrWorker.setParameters({
          tessedit_char_whitelist: 'AKQJT1098765432'
        });
      }

      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
        audio: false
      });

      const video = document.getElementById('screen-video');
      video.srcObject = this.mediaStream;
      await video.play();

      document.getElementById('scanner-box')?.classList.remove('hidden');
      if (badge) {
        badge.textContent = 'LIVE SCAN';
        badge.classList.add('live');
      }

      this.mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        this.stopScreenScan();
      });

      this.scanTimer = setInterval(() => this.processScreenFrame(), 1300);
    } catch (err) {
      alert('Auto-Scan dibatalkan: ' + err.message);
      this.stopScreenScan();
    }
  }

  stopScreenScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    document.getElementById('scanner-box')?.classList.add('hidden');
    const badge = document.getElementById('scan-status-badge');
    if (badge) {
      badge.textContent = 'Manual';
      badge.classList.remove('live');
    }
  }

  getCardRegions(w, h) {
    const cw = w * 0.092;
    const ch = h * 0.068;

    const commY1 = h * this.commYPercent;
    const commY2 = commY1 + ch + (h * 0.011);
    const holeY = h * this.holeYPercent;

    return {
      hole: [
        { x: w * 0.408, y: holeY, w: cw, h: ch },
        { x: w * 0.508, y: holeY, w: cw, h: ch }
      ],
      comm: [
        { x: w * 0.345, y: commY1, w: cw, h: ch },
        { x: w * 0.450, y: commY1, w: cw, h: ch },
        { x: w * 0.555, y: commY1, w: cw, h: ch },
        { x: w * 0.398, y: commY2, w: cw, h: ch },
        { x: w * 0.503, y: commY2, w: cw, h: ch }
      ]
    };
  }

  async processScreenFrame() {
    if (this.isScanningFrame || !this.mediaStream) return;
    const video = document.getElementById('screen-video');
    const preview = document.getElementById('scan-preview-canvas');
    if (!video || !preview || video.videoWidth === 0) return;

    this.isScanningFrame = true;
    try {
      const ctx = preview.getContext('2d');
      const pw = preview.width;
      const ph = preview.height;

      ctx.drawImage(video, 0, 0, pw, ph);
      const regions = this.getCardRegions(pw, ph);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#00f0ff';
      regions.hole.forEach(r => ctx.strokeRect(r.x, r.y, r.w, r.h));
      ctx.strokeStyle = '#fbbf24';
      regions.comm.forEach(r => ctx.strokeRect(r.x, r.y, r.w, r.h));

      let updated = false;

      for (let i = 0; i < 2; i++) {
        if (!this.holeCards[i]) {
          const detected = await this.detectCardFromRegion(preview, regions.hole[i]);
          if (detected) {
            this.holeCards[i] = detected;
            updated = true;
          }
        }
      }

      for (let i = 0; i < 5; i++) {
        if (!this.communityCards[i]) {
          const detected = await this.detectCardFromRegion(preview, regions.comm[i]);
          if (detected) {
            this.communityCards[i] = detected;
            updated = true;
          }
        }
      }

      if (updated) this.render();
    } finally {
      this.isScanningFrame = false;
    }
  }

  async detectCardFromRegion(sourceCanvas, rect) {
    const crop = document.createElement('canvas');
    crop.width = 64;
    crop.height = 64;
    const cctx = crop.getContext('2d');
    cctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, 64, 64);

    const imgData = cctx.getImageData(0, 0, 64, 64).data;
    let whitePixels = 0;
    let redPixels = 0;
    let blackPixels = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
      if (r > 185 && g > 185 && b > 185) whitePixels++;
      else if (r > 140 && g < 85 && b < 85) redPixels++;
      else if (r < 85 && g < 85 && b < 85) blackPixels++;
    }

    if (whitePixels < (64 * 64 * 0.25)) return null;
    const suit = redPixels > blackPixels ? '♥' : '♠';
    if (!this.ocrWorker) return null;

    const rankCrop = document.createElement('canvas');
    rankCrop.width = 40;
    rankCrop.height = 40;
    rankCrop.getContext('2d').drawImage(crop, 0, 0, 34, 34, 0, 0, 40, 40);

    const { data: { text } } = await this.ocrWorker.recognize(rankCrop);
    const clean = text.trim().toUpperCase().replace(/[^AKQJT0-9]/g, '');

    let label = null;
    if (clean.includes('10') || clean.includes('0')) label = '10';
    else if (clean.includes('A')) label = 'A';
    else if (clean.includes('K')) label = 'K';
    else if (clean.includes('Q')) label = 'Q';
    else if (clean.includes('J')) label = 'J';
    else {
      const match = clean.match(/[2-9]/);
      if (match) label = match[0];
    }

    const rankObj = PokerEvaluator.RANKS.find(r => r.label === label);
    if (!rankObj) return null;

    return { value: rankObj.value, label: rankObj.label, suit };
  }

  render() {
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

    const commCount = this.communityCards.filter(Boolean).length;
    const stageEl = document.getElementById('stage-badge');
    if (stageEl) {
      stageEl.textContent = commCount === 0 ? 'PRE-FLOP' : commCount === 3 ? 'FLOP' : commCount === 4 ? 'TURN' : commCount === 5 ? 'RIVER' : 'SETUP';
    }

    this.renderRankKeypad();

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

    this.saveState();

    if (!hud) {
      if (outsEl) outsEl.innerHTML = '<span class="muted-text">Pilih / Scan 2 kartu tangan dulu</span>';
      if (boardPctEl) boardPctEl.textContent = 'Belum Ada Kartu Meja';
      if (heroTargetEl) heroTargetEl.textContent = 'Pilih / Scan 2 Kartu Tangan';
      if (handBadgeEl) handBadgeEl.textContent = '-';
      if (bannerEl) bannerEl.className = 'decision-banner verdict-call';
      if (verdictEl) verdictEl.textContent = 'MENUNGGU KARTU';
      if (detailEl) detailEl.textContent = 'Aktifkan Scan layar atau tap kartu manual.';
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
