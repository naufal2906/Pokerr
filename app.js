class PokerApp {
  constructor() {
    this.holeCards = [null, null];
    this.communityCards = [null, null, null, null, null];
    this.deadCards = [];
    this.activeSlot = { type: 'hole', index: 0 };
    this.selectedSuit = '♠';

    // Properti Kamera AR iOS + Buffer Validasi 2x Frame
    this.cameraStream = null;
    this.scanInterval = null;
    this.ocrWorker = null;
    this.isProcessingFrame = false;
    this.pendingDetections = {}; // Menyimpan hasil baca sementara untuk konfirmasi 2x

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

  // Daftar seluruh kode kartu yang sudah terpakai di tangan maupun meja (Anti-Duplikat)
  getUsedCardCodes() {
    const set = new Set();
    this.holeCards.forEach(c => { if (c) set.add(`${c.label}${c.suit}`); });
    this.communityCards.forEach(c => { if (c) set.add(`${c.label}${c.suit}`); });
    return set;
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
    const usedSet = this.getUsedCardCodes();

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
          delete this.pendingDetections[`${type}-${index}`];
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
      this.pendingDetections = {};
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
  // MODUL KAMERA AR REAL-TIME (ANTI-DUPLIKAT + VALIDASI 2X)
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
          tessedit_char_whitelist: 'AKQJT1098765432',
          tessedit_pageseg_mode: '10' // Single character / token mode agar tidak salah baca garis acak
        });
      }

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

      this.scanInterval = setInterval(() => this.scanAlignedSlots(), 1000);
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
    this.pendingDetections = {};
    document.getElementById('ar-camera-video')?.classList.add('hidden');
    document.getElementById('cam-toolbar')?.classList.add('hidden');
    document.getElementById('calib-panel')?.classList.add('hidden');
    document.getElementById('table-arena')?.classList.remove('camera-on');
  }

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
      const usedSet = this.getUsedCardCodes();
      const slots = document.querySelectorAll('.pkv-card-slot');

      for (const slot of slots) {
        const type = slot.dataset.type;
        const idx = Number(slot.dataset.index);
        const slotKey = `${type}-${idx}`;

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

        if (!detected) {
          delete this.pendingDetections[slotKey];
          continue;
        }

        const cardCode = `${detected.label}${detected.suit}`;

        // 1. BLOKIR JIKA KARTU SUDAH ADA DI SLOT LAIN (ANTI-DUPLIKAT 4 KARTU SAMA!)
        if (usedSet.has(cardCode)) {
          continue;
        }

        // 2. WAJIB TERBACA SAMA 2x BERTURUT-TURUT SEBELUM DIKUNCI
        const prev = this.pendingDetections[slotKey];
        if (prev && prev.code === cardCode) {
          if (type === 'hole') this.holeCards[idx] = detected;
          else this.communityCards[idx] = detected;
          usedSet.add(cardCode); // Langsung tandai terpakai agar slot sebelahnya tidak ikut terisi
          delete this.pendingDetections[slotKey];
          updated = true;
        } else {
          this.pendingDetections[slotKey] = { code: cardCode, card: detected };
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
    let whiteCardPixels = 0;
    let redInkPixels = 0;
    let darkInkPixels = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
      // Kartu layar HP harus putih terang bersih (tidak abu-abu gorden/dinding)
      if (r > 195 && g > 195 && b > 195) {
        whiteCardPixels++;
      } else if (r > 150 && g < 75 && b < 75) {
        redInkPixels++;
      } else if (r < 75 && g < 75 && b < 75) {
        darkInkPixels++;
      }
    }

    const totalPx = 64 * 80;
    // Wajib ada minimal 45% latar kartu putih bersih AND minimal 4% tinta angka/simbol kontras
    if (whiteCardPixels < totalPx * 0.45) return null;
    if ((redInkPixels + darkInkPixels) < totalPx * 0.04) return null;

    const suit = redInkPixels > darkInkPixels ? '♥' : '♠';
    if (!this.ocrWorker) return null;

    // Binarisasi (hitam-putih kontras tinggi) khusus area sudut kiri-atas angka kartu
    const rankCrop = document.createElement('canvas');
    rankCrop.width = 48;
    rankCrop.height = 48;
    const rctx = rankCrop.getContext('2d');
    rctx.drawImage(crop, 2, 2, 32, 36, 0, 0, 48, 48);

    const rData = rctx.getImageData(0, 0, 48, 48);
    for (let i = 0; i < rData.data.length; i += 4) {
      const avg = (rData.data[i] + rData.data[i + 1] + rData.data[i + 2]) / 3;
      const bw = avg < 145 ? 0 : 255;
      rData.data[i] = bw;
      rData.data[i + 1] = bw;
      rData.data[i + 2] = bw;
    }
    rctx.putImageData(rData, 0, 0);

    const { data: { text, confidence } } = await this.ocrWorker.recognize(rankCrop);
    // Tolak hasil bacaan jika tingkat keyakinan OCR di bawah 65%
    if (confidence < 65) return null;

    const clean = text.trim().toUpperCase().replace(/[^AKQJT0-9]/g, '');
    if (!clean) return null;

    let label = null;
    if (clean.includes('10') || clean.includes('0')) label = '10';
    else if (clean === 'A') label = 'A';
    else if (clean === 'K') label = 'K';
    else if (clean === 'Q') label = 'Q';
    else if (clean === 'J') label = 'J';
    else if (/^[2-9]$/.test(clean)) label = clean;

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
