// ═══════════════════════════════════════════════════════════════
// FLOATING AI ASSISTANT v2 — talks only to OUR server (/api/ai/*,
// /api/chat/*), never to Groq directly. No API key in this file.
//
// Features:
//  - Persistent chat history per visitor (localStorage session id
//    + server-side storage), so returning visitors don't restart.
//  - Quick-action buttons for 7 creative tools (logo concept, brand
//    name, color palette, cold pitch, design critique, contract,
//    availability) plus pricing/recommend/services shortcuts.
//  - Lead capture: asks for name + contact once, saves it server-side.
//  - WhatsApp handoff: turns any AI result into a ready-to-send draft.
//  - Voice input via the browser's SpeechRecognition API, with a
//    graceful fallback (hidden) on browsers that don't support it.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  let WHATSAPP = '9779843122166';
  let EMAIL = 'business.tetsuo@gmail.com';

  fetch('/api/settings').then(r => r.json()).then(s => {
    if (s.whatsapp) WHATSAPP = s.whatsapp;
    if (s.email) EMAIL = s.email;
    document.querySelectorAll('.pm-wa-bar[data-wa]').forEach(a => a.href = 'https://wa.me/' + WHATSAPP);
  }).catch(() => {});

  // ───────────────────────── SESSION ID (persistent identity, no personal info) ─────────────────────────
  function getSessionId() {
    let id = localStorage.getItem('pm_chat_session');
    if (!id) {
      id = 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('pm_chat_session', id);
    }
    return id;
  }
  const SESSION_ID = getSessionId();

  // ───────────────────────── STYLES ─────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    #pm-btn{position:fixed;bottom:28px;left:28px;z-index:8888;width:60px;height:60px;border-radius:50%;background:#13183B;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 28px rgba(19,24,59,.35);transition:transform .25s;}
    #pm-btn:hover{transform:scale(1.08);background:#FFB627;}
    #pm-btn svg{width:26px;height:26px;fill:#F7F7FA;}
    .pm-badge{position:absolute;top:-3px;right:-3px;background:#16a34a;color:#fff;border-radius:50%;width:20px;height:20px;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #F7F7FA;font-family:monospace;}

    #pm-win{position:fixed;bottom:100px;left:28px;z-index:8887;width:430px;height:660px;max-height:88vh;background:#FFFFFF;border:1px solid rgba(19,24,59,.15);box-shadow:10px 14px 0 rgba(19,24,59,.15);display:flex;flex-direction:column;overflow:hidden;transform:scale(.9) translateY(16px);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.34,1.2,.64,1),opacity .25s ease;transform-origin:bottom left;font-family:'Inter',sans-serif;border-radius:18px;}
    #pm-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:auto;}

    .pm-head{background:#13183B;padding:16px 18px;flex-shrink:0;}
    .pm-head-top{display:flex;align-items:center;justify-content:space-between;}
    .pm-head-left{display:flex;align-items:center;gap:12px;}
    .pm-ava{width:38px;height:38px;border-radius:50%;background:#FFB627;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;color:#fff;}
    .pm-head-info h4{color:#F7F7FA;font-size:14px;font-weight:600;margin:0;font-family:'Sora',sans-serif;}
    .pm-head-info p{color:rgba(247,243,236,.65);font-size:11px;margin:3px 0 0;display:flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;}
    .pm-online{width:6px;height:6px;background:#16a34a;border-radius:50%;}
    .pm-close{width:30px;height:30px;border-radius:50%;background:rgba(247,243,236,.12);border:none;color:#F7F7FA;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .pm-close:hover{background:rgba(247,243,236,.22);}

    .pm-tabs{display:flex;gap:6px;overflow-x:auto;margin-top:12px;padding-bottom:2px;scrollbar-width:none;}
    .pm-tabs::-webkit-scrollbar{display:none;}
    .pm-tab{flex-shrink:0;background:rgba(247,247,250,.1);border:1px solid rgba(247,247,250,.18);color:rgba(247,247,250,.8);font-size:11px;font-weight:600;padding:6px 12px;border-radius:100px;cursor:pointer;white-space:nowrap;transition:all .15s;}
    .pm-tab:hover{background:rgba(247,247,250,.18);}
    .pm-tab.active{background:#FFB627;color:#13183B;border-color:#FFB627;}

    .pm-body{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;}

    .pm-msgs{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:12px;background:#F7F7FA;}
    .pm-msg{display:flex;gap:8px;max-width:90%;}
    .pm-msg.user{align-self:flex-end;flex-direction:row-reverse;}
    .pm-msg.bot{align-self:flex-start;}
    .pm-msg-ico{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:2px;}
    .pm-msg.bot .pm-msg-ico{background:#13183B;color:#F7F7FA;}
    .pm-msg.user .pm-msg-ico{background:#FFB627;color:#13183B;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;}
    .pm-bbl{padding:10px 14px;font-size:13.5px;line-height:1.6;word-break:break-word;border-radius:14px;}
    .pm-msg.bot .pm-bbl{background:#FFFFFF;color:#13183B;border:1px solid rgba(19,24,59,.08);border-bottom-left-radius:4px;}
    .pm-msg.user .pm-bbl{background:#13183B;color:#F7F7FA;border-bottom-right-radius:4px;}
    .pm-bbl strong{font-weight:700;}
    .pm-msg-actions{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;}
    .pm-msg-action-btn{background:#fff;border:1px solid rgba(19,24,59,.15);color:#13183B;font-size:11px;font-weight:600;padding:6px 10px;border-radius:100px;cursor:pointer;}
    .pm-msg-action-btn:hover{border-color:#FFB627;background:#FFF8E8;}

    .pm-typ-wrap{display:flex;gap:8px;align-self:flex-start;}
    .pm-typ-ico{width:26px;height:26px;border-radius:50%;background:#13183B;color:#F7F7FA;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;}
    .pm-typ{display:flex;align-items:center;gap:5px;padding:12px 16px;background:#FFFFFF;border:1px solid rgba(19,24,59,.08);border-radius:14px;border-bottom-left-radius:4px;}
    .pm-typ span{width:6px;height:6px;background:#FFB627;border-radius:50%;animation:pmDots 1.4s infinite;}
    .pm-typ span:nth-child(2){animation-delay:.2s}
    .pm-typ span:nth-child(3){animation-delay:.4s}
    @keyframes pmDots{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-7px);opacity:1}}

    .pm-quick{padding:10px 14px 0;display:flex;gap:7px;flex-wrap:wrap;background:#F7F7FA;flex-shrink:0;}
    .pm-qbtn{background:#FFFFFF;border:1.5px solid #FFB627;color:#A66B00;padding:7px 13px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:'IBM Plex Mono',monospace;border-radius:8px;}
    .pm-qbtn:hover{background:#FFB627;color:#13183B;}

    .pm-wa-bar{margin:10px 14px;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:#25d366;color:#fff;text-decoration:none;font-weight:700;font-size:13px;flex-shrink:0;border-radius:10px;}
    .pm-wa-bar:hover{background:#1ebe5d;}

    .pm-inp-row{padding:12px;border-top:1px solid rgba(19,24,59,.1);display:flex;gap:8px;align-items:flex-end;background:#FFFFFF;flex-shrink:0;}
    #pm-txt{flex:1;border:1.5px solid rgba(19,24,59,.15);padding:11px 14px;font-size:13.5px;font-family:'Inter',sans-serif;outline:none;resize:none;max-height:100px;color:#13183B;background:#F7F7FA;border-radius:10px;}
    #pm-txt:focus{border-color:#FFB627;background:#FFFFFF;}
    .pm-mic{width:40px;height:40px;border-radius:50%;background:#F7F7FA;border:1.5px solid rgba(19,24,59,.15);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
    .pm-mic:hover{border-color:#FFB627;}
    .pm-mic.listening{background:#FFB627;border-color:#FFB627;animation:pmPulseMic 1.2s infinite;}
    @keyframes pmPulseMic{0%,100%{box-shadow:0 0 0 0 rgba(255,182,39,.5);}50%{box-shadow:0 0 0 8px rgba(255,182,39,0);}}
    .pm-mic svg{width:16px;height:16px;fill:#13183B;}
    .pm-go{width:42px;height:42px;border-radius:50%;background:#13183B;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .pm-go:hover{background:#FFB627;}
    .pm-go:disabled{background:#A4A4B3;cursor:default;}
    .pm-go svg{width:16px;height:16px;fill:#F7F7FA;}
    .pm-foot{padding:7px 14px;text-align:center;background:#FFFFFF;flex-shrink:0;}
    .pm-foot span{font-size:10px;color:#6B6B7B;font-family:'IBM Plex Mono',monospace;}

    /* TOOL PANELS */
    .pm-panel{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:none;flex-direction:column;gap:10px;background:#F7F7FA;}
    .pm-panel.active{display:flex;}
    .pm-panel-title{font-family:'Sora',sans-serif;font-size:15px;font-weight:700;color:#13183B;}
    .pm-panel-sub{font-size:12px;color:#6B6B7B;margin-top:-6px;}
    .pm-field{display:flex;flex-direction:column;gap:5px;}
    .pm-field label{font-size:10.5px;font-weight:700;color:#6B6B7B;text-transform:uppercase;letter-spacing:.5px;}
    .pm-field input,.pm-field select,.pm-field textarea{
      border:1.5px solid rgba(19,24,59,.15);padding:10px 12px;font-size:13px;border-radius:8px;outline:none;
      font-family:'Inter',sans-serif;background:#fff;color:#13183B;transition:border-color .15s;
    }
    .pm-field input:focus,.pm-field select:focus,.pm-field textarea:focus{border-color:#FFB627;}
    .pm-field textarea{resize:none;height:70px;}
    .pm-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
    .pm-run-btn{background:#13183B;color:#fff;border:none;padding:12px;border-radius:100px;font-weight:700;font-size:13px;cursor:pointer;margin-top:4px;}
    .pm-run-btn:hover{background:#FFB627;color:#13183B;}
    .pm-run-btn:disabled{background:#A4A4B3;cursor:default;}
    .pm-result{background:#fff;border:1px solid rgba(19,24,59,.1);border-radius:10px;padding:14px;font-size:12.5px;line-height:1.7;color:#13183B;display:none;white-space:pre-wrap;}
    .pm-result.show{display:block;}
    .pm-tool-error{color:#be123c;font-size:12px;display:none;}
    .pm-tool-error.show{display:block;}
    .pm-back-btn{background:none;border:none;color:#6B6B7B;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;align-self:flex-start;padding:0;}
    .pm-back-btn:hover{color:#13183B;}

    /* LEAD CAPTURE CARD (inline in chat) */
    .pm-lead-card{background:#FFF8E8;border:1px solid rgba(255,182,39,.4);border-radius:12px;padding:14px;margin-top:4px;}
    .pm-lead-card h5{font-size:12.5px;font-weight:700;color:#13183B;margin-bottom:8px;}
    .pm-lead-row{display:flex;gap:6px;}
    .pm-lead-row input{flex:1;border:1.5px solid rgba(19,24,59,.15);padding:8px 10px;font-size:12px;border-radius:8px;outline:none;}
    .pm-lead-row input:focus{border-color:#FFB627;}
    .pm-lead-submit{background:#13183B;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;}
    .pm-lead-submit:hover{background:#FFB627;color:#13183B;}
    .pm-lead-dismiss{font-size:11px;color:#6B6B7B;text-align:center;margin-top:8px;cursor:pointer;text-decoration:underline;}

    @media(max-width:480px){
      #pm-win{width:calc(100vw - 16px);left:8px;bottom:84px;height:80vh;}
      #pm-btn{left:14px;bottom:14px;width:54px;height:54px;}
    }
  `;
  document.head.appendChild(css);

  // ───────────────────────── MARKUP ─────────────────────────
  const TOOLS = [
    { id: 'chat', label: '💬 Chat' },
    { id: 'recommend', label: '🎯 Find a service' },
    { id: 'logo', label: '🎨 Logo concept' },
    { id: 'brand', label: '💡 Brand name' },
    { id: 'palette', label: '🖼️ Color palette' },
    { id: 'pitch', label: '✍️ Cold pitch' },
    { id: 'critique', label: '⭐ Design critique' },
    { id: 'contract', label: '📝 Contract' },
    { id: 'avail', label: '📅 Availability' },
  ];

  document.body.insertAdjacentHTML('beforeend', `
    <button id="pm-btn" onclick="pmToggle()" aria-label="Open AI assistant">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
      <div class="pm-badge">AI</div>
    </button>

    <div id="pm-win" role="dialog" aria-label="AI assistant chat" aria-hidden="true">
      <div class="pm-head">
        <div class="pm-head-top">
          <div class="pm-head-left">
            <div class="pm-ava">🤖</div>
            <div class="pm-head-info"><h4>Pradip's AI Assistant</h4><p><span class="pm-online"></span>Ask me anything</p></div>
          </div>
          <button class="pm-close" onclick="pmToggle()" aria-label="Close chat">✕</button>
        </div>
        <div class="pm-tabs" id="pm-tabs">
          ${TOOLS.map(t => `<button class="pm-tab ${t.id === 'chat' ? 'active' : ''}" data-tool="${t.id}">${t.label}</button>`).join('')}
        </div>
      </div>

      <div class="pm-body">
        <!-- CHAT PANEL -->
        <div id="pm-chat-panel" style="display:flex;flex-direction:column;flex:1;min-height:0;">
          <div class="pm-msgs" id="pm-msgs" role="log" aria-live="polite"></div>
          <div class="pm-quick" id="pm-quick">
            <button class="pm-qbtn" data-q="What services does Pradip offer?">Services</button>
            <button class="pm-qbtn" data-q="What are your prices?">Pricing</button>
            <button class="pm-qbtn" data-q="How fast can you deliver?">Delivery</button>
            <button class="pm-qbtn" data-q="I want to hire Pradip!">Hire Now</button>
          </div>
          <a class="pm-wa-bar" data-wa href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">💬 Chat directly on WhatsApp</a>
          <div class="pm-inp-row">
            <button class="pm-mic" id="pm-mic" type="button" aria-label="Voice input" title="Speak your message" style="display:none;">
              <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a1 1 0 10-2 0 3 3 0 01-6 0 1 1 0 10-2 0 5 5 0 004 4.9V18H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.1A5 5 0 0017 11z"/></svg>
            </button>
            <textarea id="pm-txt" placeholder="Ask me anything..." rows="1" aria-label="Type your message"></textarea>
            <button class="pm-go" id="pm-go" aria-label="Send message">
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          <div class="pm-foot"><span>AI-assisted · <a href="mailto:${EMAIL}" style="color:#A66B00;">${EMAIL}</a></span></div>
        </div>

        <!-- TOOL PANELS (built dynamically, see TOOL_FORMS below) -->
        <div id="pm-tool-panels"></div>
      </div>
    </div>
  `);

  // ───────────────────────── TOOL PANEL DEFINITIONS ─────────────────────────
  // Each tool maps to one server endpoint under /api/ai/*. Fields describe
  // the inputs; endpoint + payload mapping happen in runTool().
  const TOOL_FORMS = {
    recommend: {
      title: '🎯 Find Your Service', sub: 'Tell me your goal and budget — I\'ll suggest the right package.',
      fields: [
        { id: 'goal', label: 'What do you want to achieve?', type: 'text', placeholder: 'e.g. get more YouTube views' },
        { id: 'budget', label: 'Your budget', type: 'select', options: ['$15-$30 starter', '$50-$100 standard', '$100+ premium'] },
      ],
      endpoint: '/api/ai/recommend', button: '✨ Recommend a Package',
    },
    logo: {
      title: '🎨 AI Logo Concept', sub: 'Describe your brand — get a detailed logo concept brief.',
      fields: [
        { id: 'brand', label: 'Brand name', type: 'text', placeholder: 'e.g. UrbanBites' },
        { id: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. Food, Tech, Fitness' },
        { id: 'style', label: 'Style', type: 'select', options: ['modern and minimal', 'bold and aggressive', 'elegant and luxury', 'playful and fun', 'tech and futuristic', 'traditional and trustworthy'] },
        { id: 'values', label: 'Brand values (optional)', type: 'text', placeholder: 'e.g. trust, energy, growth' },
      ],
      endpoint: '/api/ai/logo-concept', button: '✨ Generate Logo Concept',
    },
    brand: {
      title: '💡 Brand Name Generator', sub: 'Describe your business — get 5 name ideas.',
      fields: [
        { id: 'desc', label: 'What does your business do?', type: 'textarea', placeholder: 'e.g. I sell handmade jewelry online' },
        { id: 'audience', label: 'Target audience (optional)', type: 'text', placeholder: 'e.g. young professionals' },
        { id: 'vibe', label: 'Vibe', type: 'select', options: ['modern and catchy', 'professional and trustworthy', 'creative and unique', 'fun and playful', 'luxury and premium'] },
      ],
      endpoint: '/api/ai/brand-name', button: '💡 Generate 5 Names',
    },
    palette: {
      title: '🖼️ Color Palette', sub: 'Describe your brand vibe — get palettes with hex codes.',
      fields: [
        { id: 'brand', label: 'Brand name or type', type: 'text', placeholder: 'e.g. fitness app, luxury bakery' },
        { id: 'mood', label: 'Mood', type: 'select', options: ['energetic and bold', 'calm and trustworthy', 'luxury and elegant', 'fun and playful', 'natural and eco-friendly', 'dark and mysterious', 'minimal and clean'] },
        { id: 'industry', label: 'Industry', type: 'select', options: ['technology', 'food and beverage', 'health and fitness', 'fashion and beauty', 'education', 'finance', 'entertainment', 'real estate'] },
      ],
      endpoint: '/api/ai/palette', button: '🎨 Generate Palettes',
    },
    pitch: {
      title: '✍️ Cold Pitch Writer', sub: 'Enter a target — get a ready-to-send outreach message.',
      fields: [
        { id: 'target', label: 'Target name / channel', type: 'text', placeholder: 'e.g. TechWithTim' },
        { id: 'service', label: 'Service offering', type: 'select', options: ['YouTube thumbnail design', 'logo and brand identity design', 'website design and development', 'social media graphics', 'complete brand package'] },
        { id: 'note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. their thumbnails look outdated' },
      ],
      endpoint: '/api/ai/pitch', button: '✍️ Write Pitch',
    },
    critique: {
      title: '⭐ Design Critique', sub: 'Describe a design — get honest, specific feedback.',
      fields: [
        { id: 'type', label: 'Design type', type: 'select', options: ['logo', 'website', 'youtube thumbnail', 'social media post', 'poster'] },
        { id: 'desc', label: 'Describe the design', type: 'textarea', placeholder: 'Colors, fonts, layout, what you think is wrong...' },
        { id: 'goal', label: 'What is it for? (optional)', type: 'text', placeholder: 'e.g. tech startup' },
      ],
      endpoint: '/api/ai/critique', button: '⭐ Critique This Design',
    },
    contract: {
      title: '📝 Contract Generator', sub: 'Fill in details — get a simple project agreement.',
      fields: [
        { id: 'client', label: 'Client name', type: 'text' },
        { id: 'service', label: 'Service', type: 'select', options: ['YouTube Thumbnail Design', 'Logo & Brand Identity Design', 'Website Design & Development', 'Poster & Social Media Design', 'Motion Graphics', 'Complete Brand Package'] },
        { id: 'price', label: 'Agreed price', type: 'text', placeholder: 'e.g. $50' },
        { id: 'deadline', label: 'Delivery deadline', type: 'text', placeholder: 'e.g. 3 days' },
        { id: 'revisions', label: 'Revisions included (optional)', type: 'text', placeholder: 'e.g. 2' },
      ],
      endpoint: '/api/ai/contract', button: '📝 Generate Contract',
    },
    avail: {
      title: '📅 Availability Check', sub: 'Pick a service and date — get a confirmation message.',
      fields: [
        { id: 'service', label: 'Service', type: 'select', options: ['YouTube Thumbnail', 'Logo Design', 'Website', 'Poster', 'Full Brand Package'] },
        { id: 'date', label: 'Preferred start date', type: 'text', placeholder: 'e.g. June 28' },
      ],
      endpoint: '/api/ai/availability', button: '📅 Check Availability',
    },
  };

  const panelsWrap = document.getElementById('pm-tool-panels');
  Object.entries(TOOL_FORMS).forEach(([id, def]) => {
    const fieldsHtml = def.fields.map(f => {
      let inputHtml = '';
      if (f.type === 'textarea') inputHtml = `<textarea id="pm-${id}-${f.id}" placeholder="${f.placeholder || ''}"></textarea>`;
      else if (f.type === 'select') inputHtml = `<select id="pm-${id}-${f.id}">${f.options.map(o => `<option>${o}</option>`).join('')}</select>`;
      else inputHtml = `<input type="text" id="pm-${id}-${f.id}" placeholder="${f.placeholder || ''}">`;
      return `<div class="pm-field"><label>${f.label}</label>${inputHtml}</div>`;
    }).join('');

    const panel = document.createElement('div');
    panel.className = 'pm-panel';
    panel.id = `pm-panel-${id}`;
    panel.innerHTML = `
      <button class="pm-back-btn" data-back>← Back to chat</button>
      <div class="pm-panel-title">${def.title}</div>
      <div class="pm-panel-sub">${def.sub}</div>
      ${fieldsHtml}
      <p class="pm-tool-error" id="pm-${id}-error"></p>
      <button class="pm-run-btn" id="pm-${id}-run">${def.button}</button>
      <div class="pm-result" id="pm-${id}-result"></div>
      <a class="pm-wa-bar" data-wa href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener" id="pm-${id}-wa" style="display:none;">💬 Send via WhatsApp</a>
    `;
    panelsWrap.appendChild(panel);
  });

  // ───────────────────────── TAB SWITCHING ─────────────────────────
  function switchTab(toolId) {
    document.querySelectorAll('.pm-tab').forEach(t => t.classList.toggle('active', t.dataset.tool === toolId));
    document.getElementById('pm-chat-panel').style.display = toolId === 'chat' ? 'flex' : 'none';
    document.querySelectorAll('.pm-panel').forEach(p => p.classList.remove('active'));
    if (toolId !== 'chat') document.getElementById(`pm-panel-${toolId}`)?.classList.add('active');
  }
  document.getElementById('pm-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.pm-tab');
    if (btn) switchTab(btn.dataset.tool);
  });
  panelsWrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) switchTab('chat');
  });

  // ───────────────────────── TOOL EXECUTION ─────────────────────────
  let lastToolResult = { id: null, text: '' };

  async function runTool(id) {
    const def = TOOL_FORMS[id];
    const errEl = document.getElementById(`pm-${id}-error`);
    const resultEl = document.getElementById(`pm-${id}-result`);
    const waEl = document.getElementById(`pm-${id}-wa`);
    const btn = document.getElementById(`pm-${id}-run`);
    errEl.classList.remove('show');
    resultEl.classList.remove('show');
    waEl.style.display = 'none';

    const payload = {};
    let missingRequired = false;
    def.fields.forEach(f => {
      const el = document.getElementById(`pm-${id}-${f.id}`);
      const val = el.value.trim();
      payload[f.id] = val;
      const isOptional = /optional/i.test(f.label);
      if (f.type !== 'select' && !isOptional && !val) missingRequired = true;
    });
    if (missingRequired) {
      errEl.textContent = 'Please fill in the required fields.';
      errEl.classList.add('show');
      return;
    }

    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = '✨ Working...';
    try {
      const res = await fetch(def.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      resultEl.textContent = data.reply;
      resultEl.classList.add('show');
      lastToolResult = { id, text: data.reply };
      waEl.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(data.reply)}`;
      waEl.style.display = 'flex';
    } catch (e) {
      errEl.textContent = e.message || 'Could not complete this — please try again.';
      errEl.classList.add('show');
    }
    btn.disabled = false;
    btn.textContent = originalLabel;
  }

  Object.keys(TOOL_FORMS).forEach(id => {
    document.getElementById(`pm-${id}-run`)?.addEventListener('click', () => runTool(id));
  });

  // ───────────────────────── CHAT STATE ─────────────────────────
  let messages = [];
  let isOpen = false;
  let isTyping = false;
  let leadAsked = false;
  let leadCaptured = false;

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(t) { return esc(t).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'); }
  function scrollMsgs() { const m = document.getElementById('pm-msgs'); if (m) setTimeout(() => m.scrollTop = m.scrollHeight, 50); }

  // ───────────────────────── PERSISTENCE ─────────────────────────
  async function loadHistory() {
    try {
      const res = await fetch(`/api/chat/session/${SESSION_ID}`);
      const data = await res.json();
      if (data.messages && data.messages.length) {
        messages = data.messages;
        messages.forEach(m => renderMsg(m.role, m.content, false));
        document.getElementById('pm-quick').style.display = 'none';
      }
      if (data.lead_name) leadCaptured = true;
    } catch (e) { /* fine to start fresh if this fails */ }
  }

  let saveHistoryTimer = null;
  async function saveHistory() {
    clearTimeout(saveHistoryTimer);
    saveHistoryTimer = setTimeout(async () => {
      try {
        await fetch(`/api/chat/session/${SESSION_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        });
      } catch (e) { /* non-critical */ }
    }, 600);
  }

  // ───────────────────────── RENDER ─────────────────────────
  function renderMsg(role, text, animate) {
    const d = document.createElement('div');
    d.className = 'pm-msg ' + (role === 'user' ? 'user' : 'bot');
    if (role === 'user') {
      d.innerHTML = `<div class="pm-msg-ico">You</div><div class="pm-bbl">${esc(text)}</div>`;
    } else {
      d.innerHTML = `<div class="pm-msg-ico">🤖</div><div class="pm-bbl">${fmt(text)}</div>`;
    }
    document.getElementById('pm-msgs').appendChild(d);
    if (animate !== false) scrollMsgs();
    return d;
  }

  function userMsg(text) {
    messages.push({ role: 'user', content: text });
    renderMsg('user', text);
    saveHistory();
  }

  function botMsg(text) {
    messages.push({ role: 'assistant', content: text });
    renderMsg('assistant', text);
    saveHistory();
    maybeShowLeadCapture(text);
  }

  function showTyping() {
    const d = document.createElement('div');
    d.className = 'pm-typ-wrap';
    d.id = 'pm-typ';
    d.innerHTML = `<div class="pm-typ-ico">🤖</div><div class="pm-typ"><span></span><span></span><span></span></div>`;
    document.getElementById('pm-msgs').appendChild(d);
    scrollMsgs();
  }
  function hideTyping() { document.getElementById('pm-typ')?.remove(); }

  // ───────────────────────── LEAD CAPTURE ─────────────────────────
  function maybeShowLeadCapture(botText) {
    if (leadCaptured || leadAsked) return;
    const hireSignals = /whatsapp him|reach out|get started|contact pradip|hire pradip|share your (name|contact|number)/i;
    if (!hireSignals.test(botText) && messages.length < 6) return;
    leadAsked = true;
    const card = document.createElement('div');
    card.className = 'pm-lead-card';
    card.innerHTML = `
      <h5>📞 Want Pradip to follow up directly?</h5>
      <div class="pm-lead-row">
        <input type="text" id="pm-lead-name" placeholder="Your name">
        <input type="text" id="pm-lead-contact" placeholder="WhatsApp or email">
        <button class="pm-lead-submit" id="pm-lead-submit">Send</button>
      </div>
      <div class="pm-lead-dismiss" id="pm-lead-dismiss">No thanks, just chatting</div>
    `;
    document.getElementById('pm-msgs').appendChild(card);
    scrollMsgs();

    card.querySelector('#pm-lead-submit').addEventListener('click', async () => {
      const name = document.getElementById('pm-lead-name').value.trim();
      const contact = document.getElementById('pm-lead-contact').value.trim();
      if (!name || !contact) return;
      try {
        await fetch(`/api/chat/session/${SESSION_ID}/lead`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, contact }),
        });
        leadCaptured = true;
        card.innerHTML = `<h5>🎉 Thanks, ${esc(name)}! Pradip will reach out soon.</h5>`;
      } catch (e) {
        card.querySelector('h5').textContent = '⚠️ Could not send — please WhatsApp Pradip directly.';
      }
    });
    card.querySelector('#pm-lead-dismiss').addEventListener('click', () => card.remove());
  }

  // ───────────────────────── AI CHAT CALL ─────────────────────────
  async function getReply(text) {
    isTyping = true;
    document.getElementById('pm-go').disabled = true;
    showTyping();
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-14) }),
      });
      const data = await res.json();
      hideTyping();
      if (!res.ok) throw new Error(data.error || 'AI unavailable');
      botMsg(data.reply);
    } catch (e) {
      hideTyping();
      botMsg(`Sorry, quick hiccup there. 😅 You can reach Pradip directly on **WhatsApp**: +${WHATSAPP}`);
    }
    isTyping = false;
    document.getElementById('pm-go').disabled = false;
  }

  function send() {
    const inp = document.getElementById('pm-txt');
    const text = inp.value.trim();
    if (!text || isTyping) return;
    inp.value = '';
    inp.style.height = 'auto';
    document.getElementById('pm-quick').style.display = 'none';
    userMsg(text);
    getReply(text);
  }

  document.getElementById('pm-go').addEventListener('click', send);
  document.getElementById('pm-txt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  document.getElementById('pm-txt').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
  document.getElementById('pm-quick').addEventListener('click', (e) => {
    const btn = e.target.closest('.pm-qbtn');
    if (!btn) return;
    document.getElementById('pm-quick').style.display = 'none';
    const text = btn.dataset.q;
    userMsg(text);
    getReply(text);
  });

  // ───────────────────────── VOICE INPUT (graceful, Chrome/Edge only) ─────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const micBtn = document.getElementById('pm-mic');
    micBtn.style.display = 'flex';
    const recognizer = new SpeechRecognition();
    recognizer.lang = 'en-US';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    let listening = false;

    recognizer.addEventListener('result', (e) => {
      const transcript = e.results[0][0].transcript;
      const inp = document.getElementById('pm-txt');
      inp.value = (inp.value ? inp.value + ' ' : '') + transcript;
      inp.dispatchEvent(new Event('input'));
    });
    recognizer.addEventListener('end', () => { listening = false; micBtn.classList.remove('listening'); });
    recognizer.addEventListener('error', () => { listening = false; micBtn.classList.remove('listening'); });

    micBtn.addEventListener('click', () => {
      if (listening) { recognizer.stop(); return; }
      try {
        recognizer.start();
        listening = true;
        micBtn.classList.add('listening');
      } catch (e) { /* already started or blocked, ignore */ }
    });
  }

  // ───────────────────────── TOGGLE / INIT ─────────────────────────
  let historyLoaded = false;
  window.pmToggle = function () {
    isOpen = !isOpen;
    const win = document.getElementById('pm-win');
    win.classList.toggle('open', isOpen);
    win.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen && !historyLoaded) {
      historyLoaded = true;
      loadHistory().then(() => {
        if (messages.length === 0) {
          setTimeout(() => botMsg("Hey! I'm Pradip's AI assistant. Ask me about services, pricing, delivery times, or anything else — or tap a tool above for instant logo concepts, brand names, color palettes, and more. 😊"), 350);
        }
      });
    }
  };
})();