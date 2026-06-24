// ═══════════════════════════════════════════════════════════════
// MAIN SITE SCRIPT — fetches content from /api/* and renders it.
// No API keys here. No localStorage for data that must be shared.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const announce = (msg) => { const el = document.getElementById('sr-announcer'); if (el) el.textContent = msg; };

  let SETTINGS = {};
  let PROJECTS = [];
  let currentFilter = 'all';

  // ───────────────────────── FETCH HELPERS ─────────────────────────
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Request failed: ' + url);
    return res.json();
  }

  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ───────────────────────── LOAD SETTINGS ─────────────────────────
  async function loadSettings() {
    try {
      SETTINGS = await getJSON('/api/settings');
    } catch (e) {
      console.warn('Could not load settings, using defaults', e);
      SETTINGS = {};
    }
    applySettings();
  }

  function applySettings() {
    const wa = SETTINGS.whatsapp || '9779843122166';
    const waUrl = 'https://wa.me/' + wa.replace(/\D/g, '');
    const email = SETTINGS.email || 'business.tetsuo@gmail.com';

    document.querySelectorAll('#nav-whatsapp, #mnav-whatsapp, #about-whatsapp').forEach(el => el.href = waUrl);
    const cw = document.getElementById('contact-whatsapp');
    if (cw) { cw.href = waUrl; cw.textContent = '+' + wa; }
    const ce = document.getElementById('contact-email');
    if (ce) { ce.href = 'mailto:' + email; ce.textContent = email; }

    if (SETTINGS.hero_desc) {
      const hd = document.getElementById('hero-desc');
      if (hd) hd.textContent = SETTINGS.hero_desc;
    }
    if (SETTINGS.stat_earned) {
      document.querySelectorAll('#stat-earned, #num-earned').forEach(el => el.textContent = SETTINGS.stat_earned);
    }
    if (SETTINGS.about_text) {
      const at = document.getElementById('about-text');
      if (at) at.innerHTML = SETTINGS.about_text.split('\n\n').map(p => `<p>${esc(p)}</p>`).join('');
    }
    if (SETTINGS.stat_projects) {
      document.querySelectorAll('[data-count="48"]').forEach(el => el.dataset.count = SETTINGS.stat_projects);
    }
    if (SETTINGS.stat_clients) {
      document.querySelectorAll('[data-count="24"]').forEach(el => el.dataset.count = SETTINGS.stat_clients);
    }

    // socials
    const socials = document.getElementById('socials-list');
    if (socials) {
      const links = [
        ['📷 Instagram', SETTINGS.instagram],
        ['Facebook', SETTINGS.facebook],
        ['⌥ GitHub', SETTINGS.github],
        ['✈ Telegram', SETTINGS.telegram],
      ].filter(([, url]) => url);
      socials.innerHTML = links.map(([label, url]) =>
        `<a href="${esc(url)}" target="_blank" rel="noopener" class="soc-btn">${label}</a>`
      ).join('');
    }
  }

  // ───────────────────────── MARQUEE ─────────────────────────
  function renderMarquee() {
    const items = ['Logo Design', 'Web Development', 'YouTube Thumbnails', 'UI/UX Design', 'Poster Design', 'Motion Graphics', 'Brand Identity', 'Social Media Graphics'];
    const html = items.map(t => `<div class="m-item"><span class="m-dot"></span>${esc(t)}</div>`).join('');
    const marquee = document.getElementById('marquee');
    if (marquee) marquee.innerHTML = html + html; // duplicate for seamless loop
  }

  // ───────────────────────── SERVICES ─────────────────────────
  async function loadServices() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    try {
      const services = await getJSON('/api/services');
      if (!services.length) { grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;">No services added yet.</p>'; return; }
      grid.innerHTML = services.map((s, i) => {
        const tags = (s.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        return `
          <div class="srv-card">
            <div class="srv-icon">${esc(s.icon || '✦')}</div>
            <h3 class="srv-title">${esc(s.title)}</h3>
            <p class="srv-desc">${esc(s.description || '')}</p>
            <div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          </div>`;
      }).join('');
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;">Could not load services right now.</p>';
    }
  }

  // ───────────────────────── PROJECTS / WORK ─────────────────────────
  async function loadProjects() {
    const grid = document.getElementById('work-grid');
    if (!grid) return;
    try {
      PROJECTS = await getJSON('/api/projects');
      renderProjects();
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p class="empty-state">Could not load the portfolio right now. Please refresh.</p>';
    }
  }

  function renderProjects() {
    const grid = document.getElementById('work-grid');
    if (!grid) return;
    if (!PROJECTS.length) {
      grid.innerHTML = '<p class="empty-state">No projects added yet — check back soon, or browse the rest of the site.</p>';
      return;
    }
    const filtered = currentFilter === 'all' ? PROJECTS : PROJECTS.filter(p => p.category === currentFilter);
    if (!filtered.length) {
      grid.innerHTML = '<p class="empty-state">Nothing in this category yet.</p>';
      return;
    }
    grid.innerHTML = filtered.map((p, i) => {
      const img = p.image ? `/uploads/${p.image}` : null;
      return `
        <div class="w-card" data-id="${p.id}" data-idx="${i}" tabindex="0" role="button" aria-label="View ${esc(p.title)}">
          <div class="w-thumb">
            ${img
              ? `<img src="${img}" alt="${esc(p.title)}" loading="lazy">`
              : `<div class="w-thumb-fallback">🖼️</div>`}
            <div class="w-view-overlay"><span>View Project</span></div>
          </div>
          <div class="w-info">
            <div class="w-cat">${esc(p.category)}</div>
            <div class="w-title">${esc(p.title)}</div>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.w-card').forEach(card => {
      const open = () => openLightbox(parseInt(card.dataset.idx, 10), filtered);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function setupWorkFilters() {
    const wrap = document.getElementById('work-filters');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.wf-btn');
      if (!btn) return;
      wrap.querySelectorAll('.wf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.cat;
      renderProjects();
    });
  }

  // ───────────────────────── LIGHTBOX ─────────────────────────
  let lbList = [];
  let lbIdx = 0;

  function openLightbox(idx, list) {
    lbList = list;
    lbIdx = idx;
    showLbImage();
    document.getElementById('lb').classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function showLbImage() {
    const p = lbList[lbIdx];
    if (!p) return;
    const img = document.getElementById('lb-img');
    img.src = p.image ? `/uploads/${p.image}` : '';
    img.alt = p.title;
    document.getElementById('lb-caption').textContent = p.title;
  }

  window.closeLb = function () {
    document.getElementById('lb').classList.remove('open');
    document.body.classList.remove('no-scroll');
  };
  window.lbNav = function (dir) {
    if (!lbList.length) return;
    lbIdx = (lbIdx + dir + lbList.length) % lbList.length;
    showLbImage();
  };

  document.getElementById('lb')?.addEventListener('click', function (e) {
    if (e.target === this) window.closeLb();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeLb();
      closeModal('brief-modal');
      closeModal('review-modal');
    }
    if (document.getElementById('lb')?.classList.contains('open')) {
      if (e.key === 'ArrowLeft') window.lbNav(-1);
      if (e.key === 'ArrowRight') window.lbNav(1);
    }
  });

  // ───────────────────────── PRICING ─────────────────────────
  async function loadPricing() {
    const grid = document.getElementById('pricing-grid');
    if (!grid) return;
    try {
      const plans = await getJSON('/api/pricing');
      if (!plans.length) { grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;">No pricing plans set up yet.</p>'; return; }
      grid.innerHTML = plans.map(p => {
        const features = (p.features || '').split('\n').filter(Boolean);
        return `
          <div class="p-card ${p.featured ? 'featured' : ''}">
            ${p.featured ? '<div class="p-badge">★ Most Popular</div>' : ''}
            <div class="p-name">${esc(p.name)}</div>
            <div class="p-price">${esc(p.price)}</div>
            <div class="p-tag">${esc(p.tagline || '')}</div>
            <div class="p-div"></div>
            <ul class="p-feat">${features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
            <a href="#contact" class="p-btn ${p.featured ? 'p-btn-fill' : 'p-btn-outline'}">Get Started →</a>
          </div>`;
      }).join('');
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p class="empty-state" style="grid-column:1/-1;">Could not load pricing right now.</p>';
    }
  }

  // ───────────────────────── REVIEWS ─────────────────────────
  function initials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  async function loadReviews() {
    const grid = document.getElementById('reviews-grid');
    if (!grid) return;
    try {
      const reviews = await getJSON('/api/reviews');
      if (!reviews.length) {
        grid.innerHTML = '<p class="no-reviews">No reviews yet — be the first to share your experience!</p>';
        return;
      }
      grid.innerHTML = reviews.map(r => `
        <div class="r-card">
          <div class="r-stars">${stars(r.stars)}</div>
          <p class="r-text">"${esc(r.text)}"</p>
          <div class="r-author">
            <div class="r-ava">${esc(initials(r.name))}</div>
            <div><div class="r-name">${esc(r.name)}</div><div class="r-role">${esc(r.role || 'Client')}</div></div>
          </div>
        </div>`).join('');
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p class="no-reviews">Could not load reviews right now.</p>';
    }
  }

  // ───────────────────────── REVIEW SUBMISSION ─────────────────────────
  let selectedStars = 5;
  function setupReviewModal() {
    const picker = document.getElementById('star-picker');
    if (!picker) return;
    function setStars(n) {
      selectedStars = n;
      picker.querySelectorAll('span').forEach((s, i) => {
        const on = i < n;
        s.classList.toggle('on', on);
        s.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
    picker.querySelectorAll('span').forEach(s => {
      s.addEventListener('click', () => setStars(parseInt(s.dataset.star, 10)));
      s.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStars(parseInt(s.dataset.star, 10)); }
      });
    });
    setStars(5);

    document.getElementById('review-submit-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('rv-name').value.trim();
      const role = document.getElementById('rv-role').value.trim();
      const text = document.getElementById('rv-text').value.trim();
      const errEl = document.getElementById('review-error');
      errEl.classList.remove('show');

      if (!name || !text) {
        errEl.textContent = 'Please fill in your name and review.';
        errEl.classList.add('show');
        return;
      }
      const btn = document.getElementById('review-submit-btn');
      btn.disabled = true; btn.textContent = 'Submitting...';
      try {
        await postJSON('/api/reviews', { name, role, text, stars: selectedStars });
        document.getElementById('review-form-wrap').style.display = 'none';
        document.getElementById('review-success').classList.add('show');
        setTimeout(() => {
          closeModal('review-modal');
          document.getElementById('rv-name').value = '';
          document.getElementById('rv-role').value = '';
          document.getElementById('rv-text').value = '';
          setStars(5);
          document.getElementById('review-form-wrap').style.display = 'block';
          document.getElementById('review-success').classList.remove('show');
        }, 2600);
      } catch (e) {
        errEl.textContent = e.message || 'Something went wrong. Please try again.';
        errEl.classList.add('show');
      }
      btn.disabled = false; btn.textContent = 'Submit Review →';
    });
  }

  // ───────────────────────── CONTACT FORM ─────────────────────────
  function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('form-submit-btn');
      const errEl = document.getElementById('form-error');
      errEl.classList.remove('show');
      btn.textContent = 'Sending...'; btn.disabled = true;
      try {
        await postJSON('/api/contact', {
          name: document.getElementById('fn').value.trim(),
          email: document.getElementById('fe').value.trim(),
          service: document.getElementById('fs').value.trim(),
          message: document.getElementById('fm').value.trim(),
        });
        form.style.display = 'none';
        document.getElementById('form-success').classList.add('show');
        announce('Message sent successfully');
      } catch (err) {
        errEl.textContent = err.message || 'Something went wrong. Please try again or WhatsApp directly.';
        errEl.classList.add('show');
      }
      btn.textContent = 'Send Message →'; btn.disabled = false;
    });
  }

  // ───────────────────────── BRIEF GENERATOR (calls server AI proxy) ─────────────────────────
  let briefText = '';
  function formatBriefHTML(text) {
    const icons = { 'PROJECT OVERVIEW': '📋', 'DELIVERABLES': '📦', 'TIMELINE & BUDGET': '⏱️', 'TIMELINE': '⏱️', 'STYLE NOTES': '🎨', 'NEXT STEPS': '🚀' };
    const lines = text.split('\n');
    let html = '', sec = '', cont = [];
    function flush() {
      if (sec) {
        const key = Object.keys(icons).find(k => sec.includes(k));
        html += `<div class="brief-section"><h4>${key ? icons[key] : ''} ${esc(sec)}</h4><p>${cont.filter(l => l.trim()).map(esc).join('<br>')}</p></div>`;
        cont = [];
      }
    }
    lines.forEach(line => {
      const t = line.trim();
      if (!t) return;
      const isHeading = (t === t.toUpperCase() && t.length > 3 && !/^\d+\./.test(t)) || /^\*\*[A-Z]/.test(t) || /^#+\s/.test(t);
      if (isHeading) { flush(); sec = t.replace(/\*\*/g, '').replace(/^#+\s/, '').replace(/:/, ''); }
      else cont.push(t.replace(/^\*+\s?/, '').replace(/\*\*/g, ''));
    });
    flush();
    return html || `<div class="brief-section"><h4>📋 Brief</h4><p>${esc(text).replace(/\n/g, '<br>')}</p></div>`;
  }

  function setupBriefGenerator() {
    document.getElementById('brief-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('b-name').value.trim();
      const email = document.getElementById('b-email').value.trim();
      const service = document.getElementById('b-service').value;
      const budget = document.getElementById('b-budget').value;
      const deadline = document.getElementById('b-deadline').value;
      const description = document.getElementById('b-desc').value.trim();
      const errEl = document.getElementById('brief-error');
      errEl.classList.remove('show');

      if (!name || !service || !description) {
        errEl.textContent = 'Please fill in name, service, and project description.';
        errEl.classList.add('show');
        return;
      }
      const btn = document.getElementById('brief-btn');
      btn.disabled = true; btn.textContent = '✨ Generating...';
      const result = document.getElementById('brief-result');
      result.classList.remove('show'); result.innerHTML = '';
      document.getElementById('brief-actions').classList.remove('show');

      try {
        const { reply } = await postJSON('/api/ai/brief', { name, email, service, budget, deadline, description });
        briefText = reply;
        result.innerHTML = formatBriefHTML(reply);
        result.classList.add('show');
        document.getElementById('brief-actions').classList.add('show');
      } catch (e) {
        errEl.textContent = e.message || 'Could not generate the brief. Please try again.';
        errEl.classList.add('show');
      }
      btn.disabled = false; btn.textContent = '✨ Generate Professional Brief';
    });

    document.getElementById('brief-copy-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(briefText).then(() => {
        const b = document.getElementById('brief-copy-btn');
        b.textContent = '✅ Copied!';
        setTimeout(() => b.textContent = '📋 Copy Brief', 2000);
      });
    });
    document.getElementById('brief-send-btn')?.addEventListener('click', () => {
      const wa = (SETTINGS.whatsapp || '9779843122166').replace(/\D/g, '');
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent('Hi Pradip! Here is my project brief:\n\n' + briefText + '\n\nLooking forward to working with you!')}`, '_blank');
    });
  }

  // ───────────────────────── MODALS ─────────────────────────
  function openModal(id) {
    document.getElementById(id)?.classList.add('open');
    document.body.classList.add('no-scroll');
  }
  function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }
  function setupModals() {
    document.getElementById('open-brief-modal')?.addEventListener('click', () => openModal('brief-modal'));
    document.getElementById('open-review-modal')?.addEventListener('click', () => openModal('review-modal'));
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'), document.body.classList.remove('no-scroll'); });
    });
  }

  // ───────────────────────── FAQ ─────────────────────────
  function setupFaq() {
    document.querySelectorAll('[data-faq-toggle]').forEach(q => {
      q.addEventListener('click', () => {
        const item = q.parentElement;
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  // ───────────────────────── NAV / SCROLL / MOBILE MENU ─────────────────────────
  function setupNav() {
    const nav = document.getElementById('nav');
    const btt = document.getElementById('btt');
    window.addEventListener('scroll', () => {
      const s = window.scrollY;
      nav.classList.toggle('scrolled', s > 60);
      btt.classList.toggle('on', s > 600);
      let current = '';
      document.querySelectorAll('section[id]').forEach(sec => {
        if (s >= sec.offsetTop - 150) current = sec.id;
      });
      document.querySelectorAll('.nav-links a').forEach(a =>
        a.classList.toggle('active', a.getAttribute('href') === '#' + current)
      );
    }, { passive: true });
    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function (e) {
        const targetSel = this.getAttribute('href');
        if (targetSel.length <= 1) return;
        const t = document.querySelector(targetSel);
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
      });
    });
  }

  function setupMobileMenu() {
    const mbtn = document.getElementById('mbtn');
    const mmenu = document.getElementById('mmenu');
    function close() {
      mmenu.classList.remove('on');
      mbtn.classList.remove('on');
      mbtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
    }
    mbtn.addEventListener('click', () => {
      const isOpen = mmenu.classList.contains('on');
      if (isOpen) { close(); }
      else {
        mmenu.classList.add('on'); mbtn.classList.add('on');
        mbtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('no-scroll');
      }
    });
    mmenu.querySelectorAll('[data-close-menu]').forEach(a => a.addEventListener('click', close));
  }

  // ───────────────────────── SCROLL REVEAL ─────────────────────────
  const RING_CIRCUMFERENCE = 238.76; // 2 * PI * r(38), matches the SVG circles in the HTML

  function animateRingMeters(root) {
    root.querySelectorAll('.sk-ring-fill').forEach(circle => {
      const pct = parseFloat(circle.dataset.pct) || 0;
      const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
      circle.style.strokeDashoffset = offset;
    });
  }

  function setupReveal() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          animateRingMeters(e.target);
        }
      });
    }, { threshold: .1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.rv').forEach(r => obs.observe(r));
    // fallback in case elements are already in view on load (observer may not fire)
    setTimeout(() => animateRingMeters(document), 1200);
  }

  // ───────────────────────── COUNTERS ─────────────────────────
  function setupCounters() {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.count, 10) || 0;
        const dur = 1600, start = performance.now();
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(target * ease) + '+';
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target + '+';
        }
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    }, { threshold: .5 });
    document.querySelectorAll('[data-count]').forEach(el => obs.observe(el));
  }

  // ───────────────────────── INIT ─────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    renderMarquee();
    setupNav();
    setupMobileMenu();
    setupWorkFilters();
    setupModals();
    setupFaq();
    setupReviewModal();
    setupContactForm();
    setupBriefGenerator();
    setupReveal();
    setupCounters();

    // Page-load entrance animation for the hero (kept separate from
    // scroll-reveal since it's above the fold and visible immediately).
    requestAnimationFrame(() => document.body.classList.add('page-loaded'));

    await loadSettings();
    await Promise.allSettled([
      loadServices(),
      loadProjects(),
      loadPricing(),
      loadReviews(),
    ]);
  });
})();