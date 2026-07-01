// ===== Hotspot Modal =====
const HotspotModal = {
  currentArea: null,
  modalEl: null,
  audioEl: null,
  isPlaying: false,

  init() {
    this.modalEl = document.getElementById('hotspot-modal');
    this.audioEl = document.getElementById('hotspot-audio');
    if (!this.modalEl) return;

    // Close handlers
    document.getElementById('hotspot-modal-close')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('.hotspot-modal-overlay')?.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });

    // Audio play
    document.getElementById('hotspot-audio-play')?.addEventListener('click', () => {
      this.toggleAudio();
    });

    // Detail expand button handler
    document.getElementById('hotspot-detail-btn')?.addEventListener('click', () => {
      this.toggleDetail();
    });

    // Listen to global language changes
    document.addEventListener('langchange', () => {
      if (this.currentArea && this.modalEl.classList.contains('open')) {
        this.updateContent();
      }
    });

    // Expose globally for Three.js module
    window.openHotspotModal = (area) => this.open(area);
  },

  updateContent() {
    if (!this.currentArea) return;
    const lang = i18n.current;
    const data = this.currentArea[lang];
    if (!data) return;

    // Set content
    document.getElementById('hotspot-modal-title').textContent = data.name;
    document.getElementById('hotspot-modal-desc').textContent = data.desc;
    document.getElementById('hotspot-audio-name').textContent = 'Audio Guide: ' + data.name;
    document.getElementById('hotspot-audio-dur').textContent = lang === 'vi' ? 'Thời lượng: 02:18' : 'Duration: 02:18';

    // Set architectural detail content
    const detailBox = document.getElementById('hotspot-modal-detail-box');
    if (detailBox) {
      detailBox.textContent = data.details || (lang === 'vi' ? 'Chưa có chi tiết kiến trúc bổ sung.' : 'No additional architectural details available.');
    }

    // Set audio source
    if (this.audioEl) {
      this.audioEl.src = data.audio || '';
    }
  },

  toggleDetail() {
    const detailBox = document.getElementById('hotspot-modal-detail-box');
    if (detailBox) {
      detailBox.classList.toggle('hidden');
    }
  },

  open(area) {
    if (!this.modalEl || !area) return;
    this.currentArea = area;

    // Hide detail box by default when opening
    const detailBox = document.getElementById('hotspot-modal-detail-box');
    if (detailBox) detailBox.classList.add('hidden');

    this.updateContent();

    // Show modal
    this.modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    document.body.style.overflow = '';

    // Stop audio
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    this.isPlaying = false;
    const playBtn = document.getElementById('hotspot-audio-play');
    if (playBtn) playBtn.textContent = '▶';
  },

  toggleAudio() {
    if (!this.audioEl) return;
    const playBtn = document.getElementById('hotspot-audio-play');

    if (this.isPlaying) {
      this.audioEl.pause();
      this.isPlaying = false;
      if (playBtn) playBtn.textContent = '▶';
    } else {
      this.audioEl.play().catch(() => {
        // No audio file — simulate
        this.simulateAudio();
      });
      this.isPlaying = true;
      if (playBtn) playBtn.textContent = '⏸';
    }
  },

  simulateAudio() {
    let t = 0;
    const dur = 45;
    const playBtn = document.getElementById('hotspot-audio-play');
    const interval = setInterval(() => {
      t++;
      if (t >= dur || !this.isPlaying || !this.modalEl.classList.contains('open')) {
        clearInterval(interval);
        this.isPlaying = false;
        if (playBtn) playBtn.textContent = '▶';
        return;
      }
    }, 1000);
  }
};

// ===== Timeline =====
const Timeline = {
  init() {
    this.render();
    document.addEventListener('langchange', () => this.render());
  },
  render() {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    const lang = i18n.current;
    container.innerHTML = MAP_DATA.timeline.map((item, i) => `
      <div class="timeline-item" style="animation-delay:${i*0.1}s">
        <div class="timeline-year">${item.year}</div>
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <p>${item[lang]}</p>
        </div>
      </div>
    `).join('');
    const items = container.querySelectorAll('.timeline-item');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.2 });
    items.forEach(el => obs.observe(el));
  }
};

// ===== Main Audio Guide =====
const AudioGuide = {
  isPlaying: false,
  init() {
    const playBtn = document.getElementById('audio-play-main');
    if (!playBtn) return;
    playBtn.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
      if (this.isPlaying) {
        this.simulateProgress();
      }
    });
  },
  simulateProgress() {
    let progress = 0;
    const bar = document.getElementById('main-audio-progress');
    const interval = setInterval(() => {
      if (!this.isPlaying) { clearInterval(interval); return; }
      progress += 0.5;
      if (bar) bar.style.width = progress + '%';
      if (progress >= 100) {
        clearInterval(interval);
        this.isPlaying = false;
        const playBtn = document.getElementById('audio-play-main');
        if (playBtn) playBtn.textContent = '▶';
      }
    }, 150);
  }
};

// ===== Main App =====
const App = {
  init() {
    i18n.init();
    HotspotModal.init();
    Timeline.init();
    AudioGuide.init();
    this.initNav();
    this.initScrollReveal();
  },

  initNav() {
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Header scroll effect
    window.addEventListener('scroll', () => {
      const header = document.getElementById('header');
      if (header) header.classList.toggle('scrolled', window.scrollY > 20);
    });
  },

  initScrollReveal() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
