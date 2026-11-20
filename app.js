class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.deadCards = [];
    this.activeSlot = { type: 'hole', index: 0 };
    this.selectedSuit = '♠';

    // Properti Kamera AR iOS
    this.cameraStream = null;
    this.scanInterval = null;
    this.ocrWorker = null;
    this.isProcessingFrame = false;

    this.loadSavedState();
    this.init();
  }

  init() {
    this.renderRankKeypad();
    this.bindSuitTabs();
    this.bindSlots();
    this.bindPotOddsEvents();
    this.bindCameraEvents();
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
      localStorage.setItem('pkv_ar_hud_state', JSON.stringify(state));
    } catch (e) {}
  }

  loadSavedState() {
    try {
      const raw = localStorage.getItem('pkv_ar_hud_state');
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
    document.querySelectorAll('.pkv-card-slot').forEach(slot => {
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
      localStorage.removeItem('pkv_ar_hud_state');
      this.render();
    });
  }

  // =========================================================
  // MODUL KAMERA AR REAL-TIME UNTUK SAFARI iOS (2 HP)
  // =========================================================
  bindCameraEvents() {
    const btnCam = document.getElementById('btn-cam-scan');
    const btnStop = document.getElementById('btn-stop-cam');
    const btnCalib = document.getElementById('btn-toggle-calib');
    const calibPanel = document.getElementById('calib-panel');
    const sliderCommY = document.getElementById('slider-comm-y');
    const sliderHoleY = document.getElementById('slider-hole-y');

    if (btnCam) btnCam.addEventListener('click', () => this.startArCamera());
    if (btnStop) btnStop.addEventListener('click', () => this.stopArCamera());
    if (btnCalib && calibPanel) {
      btnCalib.addEventListener('click', () => calibPanel.classList.toggle('hidden'));
    }

    // Geser posisi vertikal zona kartu komunitas & kartu kita secara visual agar pas dengan layar HP ke-2
    if (sliderCommY) {
      sliderCommY.addEventListener('input', (e) => {
        document.getElementById('lbl-comm-y').textContent = `${e.target.value}%`;
        const commZone = document.getElementById('comm-zone');
        if (commZone) commZone.style.marginTop = `${(Number(e.target.value) - 33) * 3}px`;
      });
    }
    if (sliderHoleY) {
      sliderHoleY.addEventListener('input', (e) => {
        document.getElementById('lbl-hole-y').textContent = `${e.target.value}%`;
        const holeZone = document.getElementById('hole-zone');
        if (holeZone) holeZone.style.marginBottom = `${(64 - Number(e.target.value)) * 3}px`;
      });
    }
  }

  async startArCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Pastikan situs dibuka lewat HTTPS di Safari iPhone agar kamera dapat diakses.');
      return;
    }

    try {
      const badge = document.getElementById('scan-badge');
      document.getElementById('cam-toolbar')?.classList.remove('hidden');
      if (badge) badge.textContent = '⏳ MEMUAT OCR...';

      if (!this.ocrWorker && window.Tesseract) {
        this.ocrWorker = await Tesseract.createWorker('eng');
        await this.ocrWorker.setParameters({
          tessedit_char_whitelist: 'AKQJT1098765432'
        });
      }

      // Aktifkan kamera belakang iPhone resolusi tajam
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const video = document.getElementById('ar-camera-video');
      video.srcObject = this.cameraStream;
      video.classList.remove('hidden');
      await video.play();

      document.getElementById('table-arena')?.classList.add('camera-on');
      if (badge) badge.textContent = '🔴 LIVE AR SCAN';

      this.scanInterval = setInterval(() => this.scanAlignedSlots(), 1200);
    } catch (err) {
      alert('Izin kamera ditolak atau tidak tersedia: ' + err.message);
      this.stopArCamera();
    }
  }

  stopArCamera() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    document.getElementById('ar-camera-video')?.classList.add('hidden');
    document.getElementById('cam-toolbar')?.classList.add('hidden');
    document.getElementById('calib-panel')?.classList.add('hidden');
    document.getElementById('table-arena')?.classList.remove('camera-on');
  }

  // Membaca gambar kamera PERSIS di balik setiap kotak slot kartu pada layar AR!
  async scanAlignedSlots() {
    if (this.isProcessingFrame || !this.cameraStream) return;
    const video = document.getElementById('ar-camera-video');
    const arena = document.getElementById('table-arena');
    const procCanvas = document.getElementById('ar-process-canvas');
    if (!video || !arena || !procCanvas || video.videoWidth === 0) return;

    this.isProcessingFrame = true;
    try {
      const arenaRect = arena.getBoundingClientRect();
      procCanvas.width = arenaRect.width;
      procCanvas.height = arenaRect.height;
      const ctx = procCanvas.getContext('2d');

      // Hitung rasio object-fit: cover agar koordinat slot 100% presisi dengan video kamera
      const vRatio = video.videoWidth / video.videoHeight;
      const aRatio = arenaRect.width / arenaRect.height;
      let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

      if (vRatio > aRatio) {
        sw = video.videoHeight * aRatio;
        sx = (video.videoWidth - sw) / 2;
      } else {
        sh = video.videoWidth / aRatio;
        sy = (video.videoHeight - sh) / 2;
      }

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, arenaRect.width, arenaRect.height);

      let updated = false;
      const slots = document.querySelectorAll('.pkv-card-slot');

      for (const slot of slots) {
        const type = slot.dataset.type;
        const idx = Number(slot.dataset.index);

        // Sticky Lock: Lewati slot yang sudah terisi agar histori tidak hilang saat bergerak
        if (type === 'hole' && this.holeCards[idx]) continue;
        if (type === 'comm' && this.communityCards[idx]) continue;

        const sRect = slot.getBoundingClientRect();
        const relX = sRect.left - arenaRect.left;
        const relY = sRect.top - arenaRect.top;

        const detected = await this.recognizeCardBox(procCanvas, {
          x: relX,
          y: relY,
          w: sRect.width,
          h: sRect.height
        });

        if (detected) {
          if (type === 'hole') this.holeCards[idx] = detected;
          else this.communityCards[idx] = detected;
          updated = true;
        }
      }

      if (updated) this.render();
    } finally {
      this.isProcessingFrame = false;
    }
  }

  async recognizeCardBox(sourceCanvas, rect) {
    const crop = document.createElement('canvas');
    crop.width = 64;
    crop.height = 80;
    const cctx = crop.getContext('2d');
    cctx.drawImage(sourceCanvas, rect.x, rect.y, rect.w, rect.h, 0, 0, 64, 80);

    const imgData = cctx.getImageData(0, 0, 64, 80).data;
    let brightPixels = 0;
    let redPixels = 0;
    let darkPixels = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
      // Toleransi kartu putih/abu terang di layar HP kedua
      if (r > 155 && g > 155 && b > 155) brightPixels++;
      else if (r > 135 && g < 85 && b < 85) redPixels++;
      else if (r < 90 && g < 90 && b < 90) darkPixels++;
    }

    if (brightPixels < (64 * 80 * 0.25)) return null;
    const suit = redPixels > darkPixels ? '♥' : '♠';
    if (!this.ocrWorker) return null;

    // Ambil sudut kiri-atas kartu tempat angka/huruf berada
    const rankCrop = document.createElement('canvas');
    rankCrop.width = 48;
    rankCrop.height = 48;
    rankCrop.getContext('2d').drawImage(crop, 2, 2, 34, 38, 0, 0, 48, 48);

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
    document.querySelectorAll('.pkv-card-slot').forEach(slot => {
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
      if (outsEl) outsEl.innerHTML = '<span class="muted">Arahkan kamera ke meja atau tap kartu</span>';
      if (boardPctEl) boardPctEl.textContent = 'Belum Ada Kartu Meja';
      if (heroTargetEl) heroTargetEl.textContent = 'Scan / Pilih 2 Kartu Tangan';
      if (handBadgeEl) handBadgeEl.textContent = '-';
      if (bannerEl) bannerEl.className = 'decision-bar verdict-call';
      if (verdictEl) verdictEl.textContent = 'MENUNGGU KARTU';
      if (detailEl) detailEl.textContent = 'Tekan 📷 Kamera untuk scan layar HP main';
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
      bannerEl.className = `decision-bar ${hud.decision.badgeClass}`;
      verdictEl.textContent = hud.decision.verdict;
      detailEl.textContent = hud.decision.detail;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.pokerApp = new PokerApp();
});
