// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL SCRIPT
// All requests go through cookie-based session auth (httpOnly JWT).
// Every admin API call automatically includes credentials.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 401) {
      showLogin();
      throw new Error('Session expired — please log in again');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard').hidden = true;
  }
  function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').hidden = false;
  }

  // ───────────────────────── AUTH ─────────────────────────
  async function checkAuth() {
    try {
      await api('/api/auth/me');
      showDashboard();
      initDashboard();
    } catch (e) {
      showLogin();
    }
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    errEl.classList.remove('show');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      showDashboard();
      initDashboard();
    } catch (err) {
      errEl.textContent = err.message || 'Login failed';
      errEl.classList.add('show');
    }
    btn.disabled = false; btn.textContent = 'Sign In →';
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    location.reload();
  });

  // ───────────────────────── NAV / PANELS ─────────────────────────
  let dashboardInitialized = false;
  function initDashboard() {
    setupSidebar();
    loadOverview();
    loadProjects();
    loadServices();
    loadPricing();
    loadReviews('pending');
    loadMessages();
    loadSettings();
    setupModals();
    if (!dashboardInitialized) {
      setupForms();
      setupNotificationPolling();
      dashboardInitialized = true;
    }
  }

  function setupSidebar() {
    document.querySelectorAll('.sb-link').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        link.classList.add('active');
        document.getElementById('panel-' + link.dataset.panel).classList.add('active');
        updateSidebarBadge();
      });
    });
  }

  // ───────────────────────── NOTIFICATIONS (new message/lead alert) ─────────────────────────
  let currentUnread = 0;
  let audioCtx = null;

  function playNotifySound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, audioCtx.currentTime);
      o.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
      g.gain.setValueAtTime(0.15, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.35);
    } catch (e) { /* audio not available, ignore */ }
  }

  function updateSidebarBadge() {
    const messagesLink = document.querySelector('.sb-link[data-panel="messages"]');
    if (!messagesLink) return;
    let badge = messagesLink.querySelector('.sb-badge');
    const unseen = Math.max(0, currentUnread);
    if (unseen > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sb-badge';
        badge.style.cssText = 'background:#FFB627;color:#13183B;font-size:10px;font-weight:800;padding:2px 7px;border-radius:100px;margin-left:8px;';
        messagesLink.appendChild(badge);
      }
      badge.textContent = unseen;
    } else if (badge) {
      badge.remove();
    }
  }

  async function checkForNewMessages() {
    try {
      const stats = await api('/api/admin/stats');
      const prevUnread = currentUnread;
      currentUnread = stats.unreadMessages;
      // Update overview numbers live too, in case that panel is open
      document.getElementById('stat-unread').textContent = stats.unreadMessages;
      document.getElementById('stat-pending-reviews').textContent = stats.pendingReviews;
      document.getElementById('stat-total-reviews').textContent = stats.totalReviews;
      document.getElementById('stat-projects').textContent = stats.projects;

      if (currentUnread > prevUnread) {
        playNotifySound();
        // Refresh the messages list in the background so it's ready when they click in
        loadMessages();
      }
      updateSidebarBadge();
    } catch (e) { /* polling failures are non-critical, just retry next interval */ }
  }

  function setupNotificationPolling() {
    checkForNewMessages();
    setInterval(checkForNewMessages, 20000); // poll every 20 seconds
  }

  // ───────────────────────── OVERVIEW ─────────────────────────
  async function loadOverview() {
    try {
      const stats = await api('/api/admin/stats');
      document.getElementById('stat-projects').textContent = stats.projects;
      document.getElementById('stat-pending-reviews').textContent = stats.pendingReviews;
      document.getElementById('stat-total-reviews').textContent = stats.totalReviews;
      document.getElementById('stat-unread').textContent = stats.unreadMessages;
      currentUnread = stats.unreadMessages;
      updateSidebarBadge();
    } catch (e) { console.error(e); }
  }

  // ───────────────────────── PROJECTS ─────────────────────────
  let projectsCache = [];
  async function loadProjects() {
    const tbody = document.querySelector('#projects-table tbody');
    try {
      projectsCache = await api('/api/admin/projects');
      if (!projectsCache.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No projects yet — click "Add Project" to create your first one.</td></tr>';
        return;
      }
      tbody.innerHTML = projectsCache.map(p => `
        <tr>
          <td>${p.image ? `<img src="/uploads/${p.image}" alt="">` : '—'}</td>
          <td>${esc(p.title)}</td>
          <td>${esc(p.category)}</td>
          <td>${p.sort_order}</td>
          <td class="table-actions">
            <button class="tbl-btn" data-edit-project="${p.id}">Edit</button>
            <button class="tbl-btn danger" data-delete-project="${p.id}">Delete</button>
          </td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Could not load projects: ${esc(e.message)}</td></tr>`;
    }
  }

  function openProjectModal(project) {
    const form = document.getElementById('project-form');
    form.reset();
    document.getElementById('project-error').classList.remove('show');
    document.getElementById('project-current-img').innerHTML = '';
    if (project) {
      document.getElementById('project-modal-title').textContent = 'Edit Project';
      document.getElementById('project-id').value = project.id;
      document.getElementById('project-title').value = project.title;
      document.getElementById('project-category').value = project.category;
      document.getElementById('project-description').value = project.description || '';
      document.getElementById('project-order').value = project.sort_order;
      if (project.image) {
        document.getElementById('project-current-img').innerHTML =
          `<label>Current image</label><img src="/uploads/${project.image}" alt="">`;
      }
    } else {
      document.getElementById('project-modal-title').textContent = 'Add Project';
      document.getElementById('project-id').value = '';
    }
    document.getElementById('project-modal').classList.add('open');
  }

  // ───────────────────────── SERVICES ─────────────────────────
  let servicesCache = [];
  async function loadServices() {
    const tbody = document.querySelector('#services-table tbody');
    try {
      servicesCache = await api('/api/admin/services');
      if (!servicesCache.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No services yet.</td></tr>';
        return;
      }
      tbody.innerHTML = servicesCache.map(s => `
        <tr>
          <td style="font-size:20px;">${esc(s.icon || '✦')}</td>
          <td>${esc(s.title)}</td>
          <td>${esc(s.tags || '')}</td>
          <td>${s.sort_order}</td>
          <td class="table-actions">
            <button class="tbl-btn" data-edit-service="${s.id}">Edit</button>
            <button class="tbl-btn danger" data-delete-service="${s.id}">Delete</button>
          </td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Could not load services: ${esc(e.message)}</td></tr>`;
    }
  }

  function openServiceModal(service) {
    const form = document.getElementById('service-form');
    form.reset();
    document.getElementById('service-error').classList.remove('show');
    if (service) {
      document.getElementById('service-modal-title').textContent = 'Edit Service';
      document.getElementById('service-id').value = service.id;
      document.getElementById('service-title').value = service.title;
      document.getElementById('service-icon').value = service.icon || '';
      document.getElementById('service-description').value = service.description || '';
      document.getElementById('service-tags').value = service.tags || '';
      document.getElementById('service-order').value = service.sort_order;
    } else {
      document.getElementById('service-modal-title').textContent = 'Add Service';
      document.getElementById('service-id').value = '';
    }
    document.getElementById('service-modal').classList.add('open');
  }

  // ───────────────────────── PRICING ─────────────────────────
  let pricingCache = [];
  async function loadPricing() {
    const tbody = document.querySelector('#pricing-table tbody');
    try {
      pricingCache = await api('/api/admin/pricing');
      if (!pricingCache.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No pricing plans yet.</td></tr>';
        return;
      }
      tbody.innerHTML = pricingCache.map(p => `
        <tr>
          <td>${esc(p.name)}</td>
          <td>${esc(p.price)}</td>
          <td>${p.featured ? '<span class="badge-featured">Featured</span>' : '—'}</td>
          <td>${p.sort_order}</td>
          <td class="table-actions">
            <button class="tbl-btn" data-edit-pricing="${p.id}">Edit</button>
            <button class="tbl-btn danger" data-delete-pricing="${p.id}">Delete</button>
          </td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Could not load pricing: ${esc(e.message)}</td></tr>`;
    }
  }

  function openPricingModal(plan) {
    const form = document.getElementById('pricing-form');
    form.reset();
    document.getElementById('pricing-error').classList.remove('show');
    if (plan) {
      document.getElementById('pricing-modal-title').textContent = 'Edit Pricing Plan';
      document.getElementById('pricing-id').value = plan.id;
      document.getElementById('pricing-name').value = plan.name;
      document.getElementById('pricing-price').value = plan.price;
      document.getElementById('pricing-tagline').value = plan.tagline || '';
      document.getElementById('pricing-features').value = plan.features || '';
      document.getElementById('pricing-featured').checked = !!plan.featured;
      document.getElementById('pricing-order').value = plan.sort_order;
    } else {
      document.getElementById('pricing-modal-title').textContent = 'Add Pricing Plan';
      document.getElementById('pricing-id').value = '';
    }
    document.getElementById('pricing-modal').classList.add('open');
  }

  // ───────────────────────── REVIEWS ─────────────────────────
  let reviewsCache = [];
  let currentReviewFilter = 'pending';
  async function loadReviews(filter) {
    if (filter) currentReviewFilter = filter;
    const list = document.getElementById('reviews-list');
    try {
      reviewsCache = await api('/api/admin/reviews');
      let filtered = reviewsCache;
      if (currentReviewFilter === 'pending') filtered = reviewsCache.filter(r => !r.approved);
      if (currentReviewFilter === 'approved') filtered = reviewsCache.filter(r => r.approved);

      if (!filtered.length) {
        list.innerHTML = `<div class="list-card"><div class="empty-row" style="width:100%;">No reviews here.</div></div>`;
        return;
      }
      list.innerHTML = filtered.map(r => `
        <div class="list-card">
          <div class="list-card-main">
            <div class="list-card-name">${esc(r.name)} <span style="color:var(--stone);font-weight:400;">— ${esc(r.role || 'Client')}</span></div>
            <div class="list-card-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
            <div class="list-card-text">"${esc(r.text)}"</div>
            <div class="list-card-meta">${esc(r.created_at)} ${r.approved ? '· Approved' : '· Pending approval'}</div>
          </div>
          <div class="list-card-actions">
            ${r.approved
              ? `<button class="tbl-btn" data-unapprove-review="${r.id}">Unpublish</button>`
              : `<button class="tbl-btn" data-approve-review="${r.id}">Approve</button>`}
            <button class="tbl-btn danger" data-delete-review="${r.id}">Delete</button>
          </div>
        </div>`).join('');
    } catch (e) {
      list.innerHTML = `<div class="list-card"><div class="empty-row" style="width:100%;">Could not load reviews: ${esc(e.message)}</div></div>`;
    }
  }

  document.querySelectorAll('.rv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rv-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadReviews(tab.dataset.status);
    });
  });

  // ───────────────────────── MESSAGES ─────────────────────────
  async function loadMessages() {
    const list = document.getElementById('messages-list');
    try {
      const messages = await api('/api/admin/messages');
      if (!messages.length) {
        list.innerHTML = `<div class="list-card"><div class="empty-row" style="width:100%;">No messages yet.</div></div>`;
        return;
      }
      list.innerHTML = messages.map(m => `
        <div class="list-card">
          <div class="list-card-main">
            <div class="list-card-name">${!m.read ? '<span class="unread-dot"></span>' : ''}${esc(m.name || 'Unknown')}</div>
            <div class="list-card-meta">${esc(m.email || '')} ${m.service ? '· ' + esc(m.service) : ''} · ${esc(m.source)} · ${esc(m.created_at)}</div>
            <div class="list-card-text">${esc(m.message || '')}</div>
          </div>
          <div class="list-card-actions">
            ${!m.read ? `<button class="tbl-btn" data-read-message="${m.id}">Mark Read</button>` : ''}
            <button class="tbl-btn danger" data-delete-message="${m.id}">Delete</button>
          </div>
        </div>`).join('');
    } catch (e) {
      list.innerHTML = `<div class="list-card"><div class="empty-row" style="width:100%;">Could not load messages: ${esc(e.message)}</div></div>`;
    }
  }

  // ───────────────────────── SETTINGS ─────────────────────────
  async function loadSettings() {
    try {
      const settings = await api('/api/admin/settings');
      const form = document.getElementById('settings-form');
      Object.entries(settings).forEach(([key, value]) => {
        const field = form.querySelector(`[name="${key}"]`);
        if (field) field.value = value;
      });
    } catch (e) { console.error(e); }
  }

  // ───────────────────────── EVENT DELEGATION (table/list actions) ─────────────────────────
  document.addEventListener('click', async (e) => {
    const t = e.target;

    // Projects
    if (t.dataset.editProject) {
      const p = projectsCache.find(x => x.id === parseInt(t.dataset.editProject, 10));
      if (p) openProjectModal(p);
    }
    if (t.dataset.deleteProject) {
      if (!confirm('Delete this project? This cannot be undone.')) return;
      await api(`/api/admin/projects/${t.dataset.deleteProject}`, { method: 'DELETE' });
      loadProjects(); loadOverview();
    }

    // Services
    if (t.dataset.editService) {
      const s = servicesCache.find(x => x.id === parseInt(t.dataset.editService, 10));
      if (s) openServiceModal(s);
    }
    if (t.dataset.deleteService) {
      if (!confirm('Delete this service?')) return;
      await api(`/api/admin/services/${t.dataset.deleteService}`, { method: 'DELETE' });
      loadServices();
    }

    // Pricing
    if (t.dataset.editPricing) {
      const p = pricingCache.find(x => x.id === parseInt(t.dataset.editPricing, 10));
      if (p) openPricingModal(p);
    }
    if (t.dataset.deletePricing) {
      if (!confirm('Delete this pricing plan?')) return;
      await api(`/api/admin/pricing/${t.dataset.deletePricing}`, { method: 'DELETE' });
      loadPricing();
    }

    // Reviews
    if (t.dataset.approveReview) {
      await api(`/api/admin/reviews/${t.dataset.approveReview}/approve`, { method: 'PUT' });
      loadReviews(); loadOverview();
    }
    if (t.dataset.unapproveReview) {
      await api(`/api/admin/reviews/${t.dataset.unapproveReview}/unapprove`, { method: 'PUT' });
      loadReviews(); loadOverview();
    }
    if (t.dataset.deleteReview) {
      if (!confirm('Delete this review permanently?')) return;
      await api(`/api/admin/reviews/${t.dataset.deleteReview}`, { method: 'DELETE' });
      loadReviews(); loadOverview();
    }

    // Messages
    if (t.dataset.readMessage) {
      await api(`/api/admin/messages/${t.dataset.readMessage}/read`, { method: 'PUT' });
      loadMessages(); loadOverview();
    }
    if (t.dataset.deleteMessage) {
      if (!confirm('Delete this message?')) return;
      await api(`/api/admin/messages/${t.dataset.deleteMessage}`, { method: 'DELETE' });
      loadMessages(); loadOverview();
    }
  });

  document.getElementById('add-project-btn').addEventListener('click', () => openProjectModal(null));
  document.getElementById('add-service-btn').addEventListener('click', () => openServiceModal(null));
  document.getElementById('add-pricing-btn').addEventListener('click', () => openPricingModal(null));

  // ───────────────────────── MODALS (open/close) ─────────────────────────
  function setupModals() {
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => document.getElementById(btn.dataset.close).classList.remove('open'));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
    });
  }

  // ───────────────────────── FORM SUBMISSIONS ─────────────────────────
  function setupForms() {
    // Project form
    document.getElementById('project-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('project-id').value;
      const errEl = document.getElementById('project-error');
      const btn = document.getElementById('project-save-btn');
      errEl.classList.remove('show');

      const fd = new FormData();
      fd.append('title', document.getElementById('project-title').value.trim());
      fd.append('category', document.getElementById('project-category').value);
      fd.append('description', document.getElementById('project-description').value.trim());
      fd.append('sort_order', document.getElementById('project-order').value || '0');
      const file = document.getElementById('project-image').files[0];
      if (file) fd.append('image', file);

      btn.disabled = true; btn.textContent = 'Saving...';
      try {
        await api(id ? `/api/admin/projects/${id}` : '/api/admin/projects', {
          method: id ? 'PUT' : 'POST',
          body: fd,
        });
        document.getElementById('project-modal').classList.remove('open');
        loadProjects(); loadOverview();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
      }
      btn.disabled = false; btn.textContent = 'Save Project';
    });

    // Service form
    document.getElementById('service-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('service-id').value;
      const errEl = document.getElementById('service-error');
      const btn = document.getElementById('service-save-btn');
      errEl.classList.remove('show');

      const fd = new FormData();
      fd.append('title', document.getElementById('service-title').value.trim());
      fd.append('icon', document.getElementById('service-icon').value.trim());
      fd.append('description', document.getElementById('service-description').value.trim());
      fd.append('tags', document.getElementById('service-tags').value.trim());
      fd.append('sort_order', document.getElementById('service-order').value || '0');

      btn.disabled = true; btn.textContent = 'Saving...';
      try {
        await api(id ? `/api/admin/services/${id}` : '/api/admin/services', {
          method: id ? 'PUT' : 'POST',
          body: fd,
        });
        document.getElementById('service-modal').classList.remove('open');
        loadServices();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
      }
      btn.disabled = false; btn.textContent = 'Save Service';
    });

    // Pricing form
    document.getElementById('pricing-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('pricing-id').value;
      const errEl = document.getElementById('pricing-error');
      const btn = document.getElementById('pricing-save-btn');
      errEl.classList.remove('show');

      const payload = {
        name: document.getElementById('pricing-name').value.trim(),
        price: document.getElementById('pricing-price').value.trim(),
        tagline: document.getElementById('pricing-tagline').value.trim(),
        features: document.getElementById('pricing-features').value.trim(),
        featured: document.getElementById('pricing-featured').checked,
        sort_order: document.getElementById('pricing-order').value || 0,
      };

      btn.disabled = true; btn.textContent = 'Saving...';
      try {
        await api(id ? `/api/admin/pricing/${id}` : '/api/admin/pricing', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        });
        document.getElementById('pricing-modal').classList.remove('open');
        loadPricing();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.add('show');
      }
      btn.disabled = false; btn.textContent = 'Save Plan';
    });

    // Settings form
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {};
      new FormData(form).forEach((value, key) => data[key] = value);
      const savedMsg = document.getElementById('settings-saved');
      try {
        await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
        savedMsg.classList.add('show');
        setTimeout(() => savedMsg.classList.remove('show'), 2500);
      } catch (err) {
        alert('Could not save settings: ' + err.message);
      }
    });
  }

  // ───────────────────────── INIT ─────────────────────────
  checkAuth();
})();