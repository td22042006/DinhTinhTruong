var i18n = {
  current: 'vi',
  init() {
    const saved = localStorage.getItem('dinh-tinh-truong') || 'vi';
    this.set(saved);
    document.getElementById('lang-toggle').addEventListener('click', () => {
      this.toggle();
    });
  },
  toggle() {
    this.set(this.current === 'vi' ? 'en' : 'vi');
  },
  set(lang) {
    this.current = lang;
    localStorage.setItem('dinh-tinh-truong', lang);
    document.documentElement.lang = lang;
    const btn = document.getElementById('lang-toggle');
    if (btn) {
      btn.textContent = lang === 'vi' ? 'EN' : 'VI';
      btn.setAttribute('aria-label', lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt');
    }
    this.updateAll();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  },
  t(path) {
    const keys = path.split('.');
    let obj = TRANSLATIONS[this.current];
    for (const k of keys) {
      if (obj == null) return path;
      obj = obj[k];
    }
    return obj || path;
  },
  updateAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      el.innerHTML = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
    });
  }
};
