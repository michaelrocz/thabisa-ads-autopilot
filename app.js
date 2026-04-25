// ============================================================
// THABISA ADS AUTOPILOT — APP LOGIC
// ============================================================

const API_BASE = window.location.hostname === 'localhost' || window.location.protocol === 'file:'
  ? 'http://localhost:8008'
  : 'https://thabisa-ads-autopilot.vercel.app';
let liveMode = false;
let pollInterval = null;
let serverConfig = null;

// Helper to fetch with per-request token override
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('meta_access_token');
  if (token) {
    options.headers = { ...options.headers, 'x-meta-token': token };
  }
  return fetch(url, options);
}

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  buildSegments();
  buildAlgorithm();
  buildRules();
  buildPlatforms();
  buildCadence();
  buildReporting();
  buildChecklist();
  buildBrandSafety();
  loadChecklistState();
  initLiveData();
});

// ── LIVE DATA LAYER ─────────────────────────────────────────
async function initLiveData() {
  await checkServerStatus();
  if (liveMode) {
    fetchDashboardData();
    pollInterval = setInterval(fetchDashboardData, 5 * 60 * 1000); // every 5 min
  }
}

async function checkServerStatus() {
  try {
    const res = await apiFetch(`${API_BASE}/api/actions/status`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    liveMode = true;
    serverConfig = data;
    updateConnectionBadge('LIVE', data);
    updateSetupStatus(data);
  } catch {
    liveMode = false;
    updateConnectionBadge('OFFLINE', null);
  }
}

function updateConnectionBadge(status, data) {
  const badge = document.querySelector('.topbar-right .badge-green') ||
                document.querySelector('.topbar-right span:first-child');
  if (!badge) return;
  if (status === 'LIVE') {
    badge.textContent = '● Live';
    badge.className = 'topbar-badge badge-green';
    badge.title = `Server connected · DRY RUN: ${data?.dry_run ? 'ON' : 'OFF'}`;
  } else {
    badge.textContent = '○ Offline';
    badge.className = 'topbar-badge badge-amber';
    badge.title = 'Backend server not running — showing static data';
  }
}

function updateSetupStatus(data) {
  const metaItem = document.getElementById('ci-meta_access_token') ||
                   document.getElementById('ci-meta_account');
  if (data?.meta_connected && metaItem && !metaItem.classList.contains('done')) {
    // Auto-check meta items if server confirms connection
    ['meta_app_id','meta_account','meta_access_token','pixel_purchase','capi'].forEach(id => {
      const el = document.getElementById('ci-' + id);
      if (el) el.classList.add('done');
    });
    saveChecklistState();
  }
}

async function fetchDashboardData() {
  try {
    const [metaRes, alertsRes] = await Promise.allSettled([
      apiFetch(`${API_BASE}/api/meta/summary`).then(r => r.json()),
      apiFetch(`${API_BASE}/api/actions/alerts`).then(r => r.json())
    ]);
    if (metaRes.status === 'fulfilled') {
      if (metaRes.value.error) {
        showTokenModal(metaRes.value.error);
      } else {
        updateDashboard(metaRes.value);
      }
    }
    if (alertsRes.status === 'fulfilled') {
      updateAlertBadge(alertsRes.value);
    }
  } catch (e) {
    console.warn('Live data fetch failed:', e.message);
  }
}

// ── TOKEN MODAL CONTROLS ─────────────────────────────────────
function showTokenModal(errorMsg) {
  const modal = document.getElementById('token-modal');
  const status = document.getElementById('token-status');
  if (modal) modal.classList.add('active');
  if (errorMsg && status) {
    status.innerHTML = `<span style="color:var(--red);font-size:0.7rem">Meta Error: ${errorMsg}</span>`;
  }
}

function closeTokenModal() {
  const modal = document.getElementById('token-modal');
  if (modal) modal.classList.remove('active');
}

async function updateToken() {
  const input = document.getElementById('new-token-input');
  const btn = document.getElementById('btn-update-token');
  const status = document.getElementById('token-status');
  const token = input.value.trim();

  if (!token) {
    status.textContent = 'Please paste a token first';
    status.style.color = 'var(--red)';
    return;
  }

  btn.textContent = 'Updating...';
  btn.disabled = true;

  try {
    const res = await apiFetch(`${API_BASE}/api/actions/update-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.ok) {
      status.textContent = '✅ Success! Refreshing...';
      status.style.color = 'var(--emerald-light)';
      localStorage.setItem('meta_access_token', token);
      setTimeout(() => {
        closeTokenModal();
        location.reload(); 
      }, 800);
    } else {
      throw new Error(data.error || 'Failed to update');
    }
  } catch (e) {
    status.textContent = '❌ Error: ' + e.message;
    status.style.color = 'var(--red)';
  } finally {
    btn.textContent = 'Update Token & Resume';
    btn.disabled = false;
  }
}

function updateDashboard(meta) {
  // ── Stat cards
  setStatValue('stat-roas', meta.blended_roas + '×');
  setStatValue('stat-revenue', '₹' + formatNumber(meta.total_revenue));
  setStatValue('stat-campaigns', meta.active_campaigns);

  // ── ROAS gauge arc
  const arc = document.getElementById('gaugeArc');
  const gaugeNum = document.querySelector('.gauge-svg text[font-size="28"]');
  if (arc && meta.blended_roas) {
    const pct = Math.min(meta.blended_roas / 5, 1);
    const dashOffset = 282.7 - (282.7 * pct);
    arc.setAttribute('stroke-dashoffset', dashOffset.toFixed(1));
    if (gaugeNum) gaugeNum.textContent = meta.blended_roas + '×';
  }

  // ── Signal bars
  updateProgressBar('bar-frequency', (meta.avg_frequency / 3.5) * 100,
    meta.avg_frequency + ' / 3.5 limit', meta.avg_frequency > 3 ? 'var(--red)' : 'var(--gold)');

  // ── Live campaign table
  renderCampaignTable(meta.campaigns_detail || []);

  // ── Last updated timestamp
  const tsEl = document.querySelector('.topbar-meta');
  if (tsEl) tsEl.textContent = `Thabisa Shop · Live · Last updated ${new Date().toLocaleTimeString('en-IN')}`;
}

function renderCampaignTable(campaigns) {
  let container = document.getElementById('live-campaign-table');
  if (!container) {
    const dash = document.getElementById('section-dashboard');
    const div = document.createElement('div');
    div.id = 'live-campaign-table-wrap';
    div.innerHTML = `
      <div class="section-label mb-16" style="margin-top:28px">Live Campaign Performance — Meta (7d)</div>
      <div style="overflow-x:auto">
        <table id="live-campaign-table" style="width:100%;border-collapse:collapse;font-size:0.78rem"></table>
      </div>`;
    dash.querySelector('.content') ? dash.appendChild(div) : dash.appendChild(div);
    container = document.getElementById('live-campaign-table');
  }

  const headers = ['Campaign', 'Spend (₹)', 'ROAS', 'CPP (₹)', 'CTR%', 'Freq', 'Purchases', 'Health'];
  const headerRow = `<thead><tr>${headers.map(h =>
    `<th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:600;font-size:0.67rem;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap">${h}</th>`
  ).join('')}</tr></thead>`;

  const healthColor = { HEALTHY: 'var(--emerald-light)', WATCH: 'var(--amber)', CRITICAL: 'var(--red)' };
  const sorted = [...campaigns].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    // secondary sort by spend
    return parseFloat(b.spend) - parseFloat(a.spend);
  });

  const rows = sorted.slice(0, 15).map(c => {
    const col = healthColor[c.health_status] || 'var(--text-muted)';
    const flags = c.flags?.length ? `<span title="${c.flags.join(', ')}" style="color:var(--amber);margin-left:4px">⚠</span>` : '';
    const isActive = c.status === 'ACTIVE';
    const activeStyle = isActive ? 'background:rgba(34,201,151,0.08);border-left:4px solid var(--emerald)' : 'border-left:4px solid transparent';
    const activeBadge = isActive ? '<span style="background:var(--emerald);color:white;padding:2px 6px;border-radius:4px;font-size:0.6rem;font-weight:800;margin-left:8px;vertical-align:middle">ACTIVE</span>' : '';
    
    return `<tr style="border-bottom:1px solid var(--border);${activeStyle}">
      <td style="padding:12px 12px;color:var(--text);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.campaign_name}">
        <span style="display:flex;align-items:center;gap:8px">
          ${isActive ? '<span class="pulse-dot" style="width:8px;height:8px;background:var(--emerald);box-shadow:0 0 8px var(--emerald)"></span>' : ''}
          <span style="font-weight:${isActive ? '700' : '400'}">${c.campaign_name}</span>
          ${activeBadge}
        </span>
      </td>
      <td style="padding:12px 12px;color:var(--text-muted)">₹${formatNumber(c.spend)}</td>
      <td style="padding:12px 12px;font-weight:700;color:${c.roas >= 3 ? 'var(--emerald-light)' : c.roas >= 1.5 ? 'var(--amber)' : 'var(--red)'}">${c.roas}×</td>
      <td style="padding:12px 12px;color:var(--text-muted)">${c.cpp ? '₹'+c.cpp : '—'}</td>
      <td style="padding:12px 12px;color:${c.ctr < 0.8 ? 'var(--red)' : 'var(--text-muted)'}">${c.ctr}%</td>
      <td style="padding:12px 12px;color:${c.frequency > 3.5 ? 'var(--red)' : 'var(--text-muted)'}">${c.frequency}</td>
      <td style="padding:12px 12px;color:var(--text-muted)">${c.purchases}</td>
      <td style="padding:12px 12px"><span class="topbar-badge" style="background:${col}22;color:${col};border:1px solid ${col}44;padding:2px 8px;border-radius:4px;font-size:0.65rem;font-weight:700">${c.health_status}</span>${flags}</td>
    </tr>`;
  }).join('');

  container.innerHTML = headerRow + `<tbody>${rows || '<tr><td colspan="8" style="padding:16px;color:var(--text-dim);text-align:center">No campaign data</td></tr>'}</tbody>`;
}

function setStatValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateProgressBar(id, pct, label, color) {
  const bar = document.getElementById(id);
  if (bar) { bar.style.width = Math.min(pct, 100) + '%'; bar.style.background = color || 'var(--gold)'; }
}

function updateAlertBadge(alerts) {
  const unread = alerts.filter(a => !a.read).length;
  const el = document.getElementById('stat-alerts');
  if (el) el.textContent = unread;
  // colour the card red if critical alerts
  const hasCritical = alerts.some(a => !a.read && a.level === 'CRITICAL');
  const card = el?.closest('.stat-card');
  if (card) card.style.borderTopColor = hasCritical ? 'var(--red)' : '';
}

function formatNumber(n) {
  const num = parseFloat(n) || 0;
  if (num >= 100000) return (num/100000).toFixed(1) + 'L';
  if (num >= 1000) return (num/1000).toFixed(1) + 'k';
  return num.toFixed(0);
}

// ── Manual audit trigger (for UI button) ────────────────────
async function triggerAudit() {
  const btn = document.getElementById('btn-audit');
  if (btn) { btn.textContent = 'Running…'; btn.disabled = true; }
  try {
    const res = await apiFetch(`${API_BASE}/api/actions/audit`, { method: 'POST' });
    const data = await res.json();
    alert(`Audit complete.\nMeta actions: ${data.meta?.actions?.length || 0}\nGoogle actions: ${data.google?.actions?.length || 0}\nDry run: ${data.dry_run}`);
    fetchDashboardData();
  } catch (e) {
    alert('Audit failed: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '▶ Run Audit Now'; btn.disabled = false; }
  }
}

// ── NAVIGATION ──────────────────────────────────────────────
function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── SEGMENTS ────────────────────────────────────────────────
const TAG_COLORS = {
  gold: 'var(--gold)', emerald: 'var(--emerald-light)',
  amber: 'var(--amber)', purple: 'var(--purple)',
  teal: 'var(--teal)', blue: 'var(--blue)'
};

function buildSegments() {
  const grid = document.getElementById('segments-grid');
  grid.innerHTML = AUDIENCE_SEGMENTS.map(seg => {
    const col = TAG_COLORS[seg.tagColor] || 'var(--gold)';
    const interests = seg.interests.map(i => `<span class="tag-pill">${i}</span>`).join('');
    const products = seg.products.map(p => `<span class="tag-pill">${p}</span>`).join('');
    const layers = seg.layers ? `
      <div class="detail-col" style="flex:100%">
        <div class="detail-col-label">Retargeting Layers</div>
        <div class="layer-grid">
          ${seg.layers.map(l => `
            <div class="layer-item">
              <div class="layer-label">${l.label}</div>
              <div class="layer-desc">${l.desc}</div>
              <div class="layer-creative">${l.creative}</div>
            </div>`).join('')}
        </div>
      </div>` : '';
    const note = seg.note ? `<div style="font-size:0.75rem;color:var(--amber);margin-top:8px;padding:8px 10px;background:var(--amber-dim);border-radius:6px;border:1px solid rgba(224,123,57,0.2)">${seg.note}</div>` : '';
    const seasonal = seg.seasonal ? `<div style="font-size:0.75rem;color:var(--blue);margin-top:8px;padding:8px 10px;background:var(--blue-dim);border-radius:6px;border:1px solid rgba(59,130,246,0.2)">${seg.seasonal}</div>` : '';

    return `
    <div class="segment-card" id="seg-${seg.id}" onclick="toggleSegment('${seg.id}')">
      <div class="segment-header">
        <div class="segment-num">${seg.number}</div>
        <div class="segment-body">
          <div class="segment-tag" style="color:${col}">${seg.tag}</div>
          <div class="segment-name">${seg.name}</div>
          <div class="segment-sub">${seg.subtitle}</div>
          <div class="segment-demo">${seg.demo}</div>
        </div>
      </div>
      <div class="segment-detail">
        <div class="detail-row">
          <div class="detail-col">
            <div class="detail-col-label">Interests &amp; Signals</div>
            <div class="tag-list">${interests}</div>
          </div>
          <div class="detail-col">
            <div class="detail-col-label">Products</div>
            <div class="tag-list">${products}</div>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-col">
            <div class="detail-col-label">Google Targeting</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${seg.google}</div>
          </div>
          <div class="detail-col">
            <div class="detail-col-label">Meta Targeting</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${seg.meta}</div>
          </div>
        </div>
        ${layers ? `<div class="detail-row" style="flex-wrap:wrap">${layers}</div>` : ''}
        ${note}${seasonal}
      </div>
    </div>`;
  }).join('');
}

function toggleSegment(id) {
  const card = document.getElementById('seg-' + id);
  card.classList.toggle('expanded');
}

// ── ALGORITHM ───────────────────────────────────────────────
const ALGO_DATA = [
  {
    num: 'Layer 1', title: 'Signal Collection',
    items: [
      'ROAS per campaign, ad set, and individual ad',
      'CPP vs target threshold',
      'Frequency, CTR, hook rate (video 3s plays / impressions)',
      'Audience saturation and overlap signals',
      'Impression share and auction insights',
      'Conversion lag and attribution accuracy',
      'Pixel health and CAPI server-side matching rate'
    ]
  },
  {
    num: 'Layer 2', title: 'Score &amp; Classify',
    items: [
      'ROAS ≥ 3× = HEALTHY → scale immediately',
      'ROAS 1.5–3× = WATCH → diagnose &amp; optimize',
      'ROAS &lt; 1.5× = CRITICAL → pause after min spend',
      'CTR &lt; 0.8% = Creative fatigue flag',
      'Frequency &gt; 3.5 = Audience burn flag',
      'Learning Limited 7+ days → pause &amp; rebuild',
      'Budget utilization &lt; 70% → delivery issue'
    ]
  },
  {
    num: 'Layer 3', title: 'Act &amp; Optimize',
    items: [
      'Scale winners: +15–20% budget every 3 days',
      'Pause losers: CPP &gt; 2× target after min spend',
      'Rotate creatives on fatigue signals (auto-flag)',
      'Expand: build new lookalike audiences 1%, 2%, 5%',
      'Shift budgets within CBO campaigns to winners',
      'Refresh bids when bid strategy shows 3-day lag',
      'Log every action: timestamp, change, reason, outcome'
    ]
  }
];

function buildAlgorithm() {
  const container = document.getElementById('algo-layers-container');
  container.innerHTML = ALGO_DATA.map((layer, i) => `
    <div class="algo-layer">
      <div class="algo-layer-num">${layer.num}</div>
      <div class="algo-layer-title">${layer.title}</div>
      ${layer.items.map(item => `<div class="algo-item">${item}</div>`).join('')}
      ${i < 2 ? '<div class="algo-connector">›</div>' : ''}
    </div>`).join('');

  const flags = [
    { label: 'CTR Flag', val: '< 0.8%', action: 'Creative fatigue — flag for refresh', color: 'var(--amber)' },
    { label: 'Frequency Cap', val: '> 3.5', action: 'Audience burn — expand or rotate creative', color: 'var(--amber)' },
    { label: 'Learning Limited', val: '7+ days', action: 'Pause and rebuild ad set with broader audience', color: 'var(--red)' },
    { label: 'Budget Utilization', val: '< 70%', action: 'Diagnose delivery: bid, audience, creative score', color: 'var(--blue)' },
  ];
  document.getElementById('flag-thresholds').innerHTML = flags.map(f => `
    <div class="card" style="display:flex;align-items:center;gap:16px;padding:16px 20px">
      <div style="font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:${f.color};min-width:60px">${f.val}</div>
      <div>
        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);font-weight:600">${f.label}</div>
        <div style="font-size:0.82rem;color:var(--text);margin-top:2px">${f.action}</div>
      </div>
    </div>`).join('');
}

// ── RULES ENGINE ────────────────────────────────────────────
const RULE_COLORS = {
  scale: { tab: 'scale', label: 'Scale', color: 'var(--emerald-light)' },
  pause: { tab: 'pause', label: 'Pause', color: 'var(--red)' },
  alert: { tab: 'alert', label: 'Alert', color: 'var(--amber)' },
  refresh: { tab: 'refresh', label: 'Refresh', color: 'var(--blue)' }
};

function buildRules() {
  const container = document.getElementById('rules-panels');
  container.innerHTML = Object.entries(RULES_ENGINE).map(([key, rules]) => {
    const col = RULE_COLORS[key];
    return `
    <div class="rules-panel ${key === 'scale' ? 'active' : ''}" id="rules-${key}">
      ${rules.map(r => `
        <div class="rule-row">
          <div class="rule-if">IF: ${r.trigger}</div>
          <div class="rule-arrow">→</div>
          <div class="rule-then" style="color:${col.color}">THEN: ${r.action}</div>
          <div class="rule-confidence conf-${r.confidence.toLowerCase()}">${r.confidence}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function showRulesTab(tab, el) {
  document.querySelectorAll('.rules-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.rules-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('rules-' + tab).classList.add('active');
  el.classList.add('active');
}

// ── PLATFORMS ───────────────────────────────────────────────
function buildPlatforms() {
  const container = document.getElementById('platform-panels');
  container.innerHTML = `
  <div class="platform-panel active" id="platform-google">
    <div class="grid-2">
      <div>
        <div class="info-block">
          <div class="info-block-title">Campaign Structure</div>
          <div class="info-block-item">PMax: one per category — Home &amp; Dining, Bags, Kids/Baby/Mom, Pets, Outdoor</div>
          <div class="info-block-item">Smart Shopping: top-revenue SKUs from feed analysis</div>
          <div class="info-block-item">Brand Search: Thabisa, Thabisa Shop, Thabisa Home</div>
          <div class="info-block-item">Competitor Search: FabIndia alternatives, Nicobar table runners, Good Earth decor</div>
        </div>
        <div class="info-block">
          <div class="info-block-title">Bid Strategy</div>
          <div class="info-block-item">All conversion campaigns: Target ROAS = 300% (3×)</div>
          <div class="info-block-item">Impression share &lt; 50% and ROAS healthy → raise tROAS by 10%</div>
          <div class="info-block-item">Cost/conversion rising 3+ days → switch to Maximize Conversions for 7 days</div>
          <div class="info-block-item">New campaigns (&lt; 30 conversions) → Maximize Conversions first, then tROAS</div>
        </div>
        <div class="info-block">
          <div class="info-block-title">Negative Keywords (Weekly Refresh)</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">
            ${['cheap','free','wholesale','DIY','how to make','second hand','tutorial','homemade'].map(k => `<span class="tag-pill" style="color:var(--red);border-color:rgba(239,68,68,0.2)">${k}</span>`).join('')}
          </div>
        </div>
      </div>
      <div>
        <div class="info-block">
          <div class="info-block-title">Audience Signals (PMax)</div>
          <div class="info-block-item">Customer Match: upload purchaser list from CRM monthly</div>
          <div class="info-block-item">In-market: Home Decor, Baby Products, Handbags, Pet Supplies</div>
          <div class="info-block-item">Custom intent: 'table runner India', 'organic nursing pillow', 'tote bag women'</div>
          <div class="info-block-item">Competitor interest: FabIndia, Nicobar, Good Earth, West Elm, Pottery Barn</div>
        </div>
        <div class="info-block">
          <div class="info-block-title">Product Feed Rules (Every 14 Days)</div>
          <div class="info-block-item">Title: [Brand] + [Material] + [Product] + [Key Feature]</div>
          <div class="info-block-item">Example: Thabisa Handcrafted Cotton Table Runner — Sage Green 14×72 inch</div>
          <div class="info-block-item">All products need GTINs, correct prices, images min 800×800px</div>
          <div class="info-block-item">Custom labels: bestsellers, new arrivals, seasonal, high-margin</div>
        </div>
      </div>
    </div>
  </div>

  <div class="platform-panel" id="platform-meta">
    <div class="grid-2">
      <div>
        <div class="info-block">
          <div class="info-block-title">Campaign Structure</div>
          <div class="info-block-item">Advantage+ Shopping Campaign: primary purchase driver, dynamic product ads</div>
          <div class="info-block-item">TOF: Lifestyle creative — Instagram Reels + Stories for discovery</div>
          <div class="info-block-item">MOF: Retargeting — product viewers, video viewers 50%+</div>
          <div class="info-block-item">BOF: Cart abandoners + warm site visitors — urgency creative</div>
          <div class="info-block-item">Seasonal: activate 3 weeks before Diwali, Eid, Mother's Day, Christmas</div>
        </div>
        <div class="info-block">
          <div class="info-block-title">Budget Rules</div>
          <div class="info-block-item">CBO active on all campaigns with 3+ ad sets</div>
          <div class="info-block-item">Max budget shift: 20% at a time, maximum every 3 days</div>
          <div class="info-block-item">Retargeting: always minimum 20% of total Meta budget</div>
          <div class="info-block-item">Festive: increase total Meta budget 25–40% starting 3 weeks before occasion</div>
          <div class="info-block-item">Never change more than 1 major parameter per ad set within 7 days</div>
        </div>
        <div class="info-block">
          <div class="info-block-title">Bid Strategy</div>
          <div class="info-block-item">Purchase campaigns: Cost Cap at 1.3× target CPP</div>
          <div class="info-block-item">Retargeting warm audiences: Highest Value bidding</div>
          <div class="info-block-item">TOF awareness: Lowest Cost bidding</div>
          <div class="info-block-item">Review and switch bid strategy every 7 days based on CPP trend</div>
        </div>
      </div>
      <div>
        <div class="info-block">
          <div class="info-block-title">Creative Strategy</div>
          <div class="info-block-item">Lifestyle staging: premium home settings, aesthetic table setups</div>
          <div class="info-block-item">New mom creative: warm, organic, safe — never clinical or sterile</div>
          <div class="info-block-item">Pet creative: emotional bond imagery — animals in premium environment</div>
          <div class="info-block-item">Always premium, curated language. Never mass-market copy.</div>
          <div class="info-block-item">Video: product in beautiful context within first 3 seconds</div>
          <div class="info-block-item">Rotate any creative running &gt; 21 days on same audience</div>
        </div>
        <div class="info-block">
          <div class="info-block-title">Seasonal Calendar</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
            ${['Diwali','Eid','Mother\'s Day','Christmas','Baby Shower','Housewarming'].map(e => `<span class="tag-pill" style="color:var(--amber);border-color:rgba(224,123,57,0.25)">${e}</span>`).join('')}
          </div>
          <div class="info-block-item" style="margin-top:8px">Activate campaigns 3 weeks before each occasion</div>
          <div class="info-block-item">+30% budget on festive campaigns from activation date</div>
        </div>
      </div>
    </div>
  </div>`;
}

function showPlatformTab(tab, el) {
  document.querySelectorAll('.platform-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('platform-' + tab).classList.add('active');
  el.classList.add('active');
}

// ── CADENCE ─────────────────────────────────────────────────
function buildCadence() {
  const grid = document.getElementById('cadence-grid');
  const colors = ['var(--gold)', 'var(--emerald-light)', 'var(--blue)', 'var(--purple)', 'var(--amber)'];
  grid.innerHTML = MONITORING_CADENCE.map((c, i) => `
    <div class="cadence-card" style="border-top:2px solid ${colors[i]}">
      <div class="cadence-freq">${c.frequency}</div>
      ${c.actions.map(a => `<div class="cadence-action">${a}</div>`).join('')}
    </div>`).join('');
}

// ── REPORTING ───────────────────────────────────────────────
function buildReporting() {
  const grid = document.getElementById('reporting-grid');
  const metrics = [
    { label: 'Total Spend', value: 'Google + Meta (separate + combined)', note: '' },
    { label: 'Total Revenue Attributed', value: 'Blended ROAS + platform-split ROAS', note: '' },
    { label: 'Top 3 Performing Campaigns', value: 'Why they are winning', note: '' },
    { label: 'Bottom 3 Campaigns', value: 'Action taken on each', note: '' },
    { label: 'Creative Fatigue Alerts', value: 'Audience saturation signals', note: '' },
    { label: 'Budget Utilization Rate', value: 'Per platform', note: '' },
    { label: 'Next 7 Days Recommended Actions', value: 'Prioritized action list', note: '' },
    { label: 'Confidence Score Per Optimization', value: 'Low / Medium / High', note: '' },
  ];
  grid.innerHTML = `
    <div>
      <div class="report-card mb-24">
        <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:600;color:var(--gold);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">Weekly Report Metrics</div>
        ${metrics.map(m => `
          <div class="report-metric">
            <span class="report-metric-label">${m.label}</span>
            <span class="report-metric-value" style="font-size:0.75rem;color:var(--text-muted)">${m.value}</span>
          </div>`).join('')}
      </div>
    </div>
    <div>
      <div class="card mb-16" style="border-left:3px solid var(--emerald)">
        <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:600;color:var(--emerald-light);margin-bottom:12px">Confidence Score Guide</div>
        <div class="score-band healthy mb-8" style="margin-bottom:8px"><span class="score-indicator"></span><span style="font-size:0.8rem;color:var(--emerald-light);font-weight:600">HIGH</span><span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">Clear signal, safe to auto-apply</span></div>
        <div class="score-band watch mb-8" style="margin-bottom:8px"><span class="score-indicator"></span><span style="font-size:0.8rem;color:var(--amber);font-weight:600">MEDIUM</span><span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">Review before action, notify user</span></div>
        <div class="score-band critical"><span class="score-indicator"></span><span style="font-size:0.8rem;color:var(--red);font-weight:600">LOW</span><span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">Requires manual approval to proceed</span></div>
      </div>
      <div class="card" style="border-left:3px solid var(--blue)">
        <div style="font-family:'Playfair Display',serif;font-size:1rem;font-weight:600;color:var(--blue);margin-bottom:12px">Report Frequency</div>
        <div class="cadence-action">Weekly report every Monday 08:00</div>
        <div class="cadence-action">Monthly strategy review on 1st of month</div>
        <div class="cadence-action">Anomaly alerts sent immediately when triggered</div>
        <div class="cadence-action">Seasonal performance summary post each festive period</div>
      </div>
    </div>`;
}

// ── CHECKLIST ───────────────────────────────────────────────
function buildChecklist() {
  const container = document.getElementById('checklist-container');
  const groups = {};
  SETUP_CHECKLIST.forEach(item => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  container.innerHTML = Object.entries(groups).map(([cat, items]) => `
    <div class="checklist-group">
      <div class="checklist-group-label">${cat}</div>
      ${items.map(item => `
        <div class="checklist-item" id="ci-${item.id}" onclick="toggleCheck('${item.id}')">
          <div class="check-box">
            <span class="check-tick">✓</span>
          </div>
          <span class="check-label">${item.label}</span>
        </div>`).join('')}
    </div>`).join('');
}

function buildBrandSafety() {
  const container = document.getElementById('brand-safety-container');
  container.innerHTML = BRAND_SAFETY.map(rule => `
    <div class="brand-safety-item"><span>${rule}</span></div>`).join('');
}

function toggleCheck(id) {
  const el = document.getElementById('ci-' + id);
  el.classList.toggle('done');
  saveChecklistState();
}

function saveChecklistState() {
  const done = [];
  document.querySelectorAll('.checklist-item.done').forEach(el => {
    done.push(el.id.replace('ci-', ''));
  });
  localStorage.setItem('thabisa_checklist', JSON.stringify(done));
}

function loadChecklistState() {
  try {
    const saved = JSON.parse(localStorage.getItem('thabisa_checklist') || '[]');
    saved.forEach(id => {
      const el = document.getElementById('ci-' + id);
      if (el) el.classList.add('done');
    });
  } catch (e) {}
}

// ── LAUNCH PRO LOGIC ──────────────────────────────────────────

let launchPlatform = 'meta';
let launchFiles = [];

function setLaunchPlatform(platform, el) {
  launchPlatform = platform;
  document.querySelectorAll('#section-launch .platform-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  
  // Update button text or descriptions based on platform
  const btn = document.getElementById('btn-launch');
  btn.innerHTML = `<i data-lucide="rocket" style="width:16px;height:16px"></i> Launch Perfect ${platform === 'meta' ? 'Meta' : 'Google'} Campaign`;
  lucide.createIcons();
}

function handleFileUpload(input) {
  if (input.files) {
    const newFiles = Array.from(input.files);
    launchFiles = [...launchFiles, ...newFiles];
    renderPreviews();
    
    // Reset the zone UI if files exist
    const zone = document.getElementById('upload-zone');
    if (launchFiles.length > 0) {
      zone.innerHTML = `
        <i data-lucide="check-circle" style="width:32px;height:32px;color:var(--emerald)"></i>
        <p style="margin-top:8px;font-size:0.75rem;color:var(--emerald)">${launchFiles.length} file(s) selected</p>
      `;
    }
    lucide.createIcons();
  }
}

function renderPreviews() {
  const grid = document.getElementById('creative-preview-grid');
  if (!grid) return;
  
  grid.innerHTML = launchFiles.map((file, idx) => {
    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    return `
      <div class="preview-item">
        ${isVideo ? `<video src="${url}" muted autoplay loop></video>` : `<img src="${url}">`}
        <div class="preview-remove" onclick="removeFile(${idx})">✕</div>
      </div>
    `;
  }).join('');
}

function removeFile(idx) {
  launchFiles.splice(idx, 1);
  renderPreviews();
  
  const zone = document.getElementById('upload-zone');
  if (launchFiles.length === 0) {
    zone.innerHTML = `
      <i data-lucide="upload-cloud" style="width:32px;height:32px;color:var(--text-dim)"></i>
      <p style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">Click or drag files to upload (Images & Videos)</p>
    `;
  } else {
    zone.querySelector('p').textContent = `${launchFiles.length} file(s) selected`;
  }
  lucide.createIcons();
}

async function generateMagicCopy() {
  const btn = document.querySelector('[onclick="generateMagicCopy()"]');
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="spin" data-lucide="loader-2" style="width:14px;height:14px"></i> Thinking...';
  lucide.createIcons();

  // Simulated AI Logic for Thabisa Shop
  setTimeout(() => {
    const name = document.getElementById('launch-name').value || 'Thabisa Collection';
    const copies = [
      `Elevate your living space with the new ${name}. Luxury home decor designed for the modern home. Shop the collection today! ✨`,
      `Transform your home with Thabisa. Our ${name} brings elegance and warmth to every room. Limited stock available! 🌟`,
      `Experience premium quality with Thabisa Shop. The ${name} is now live. Get free shipping on your first order! 🛍️`
    ];
    document.getElementById('launch-text').value = copies[Math.floor(Math.random() * copies.length)];
    document.getElementById('launch-headline').value = `Shop ${name} | Thabisa Shop`;
    btn.innerHTML = original;
    lucide.createIcons();
  }, 1200);
}

async function uploadFileToMeta(file) {
  const token = localStorage.getItem('meta_access_token');
  const accountId = serverConfig?.meta_account_id;
  if (!token || !accountId) throw new Error("Meta connection details missing");

  const isVideo = file.type.startsWith('video/');
  const formData = new FormData();
  
  if (isVideo) {
    formData.append('source', file);
    formData.append('title', file.name);
    const res = await fetch(`https://graph.facebook.com/v21.0/${accountId}/advideos?access_token=${token}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { type: 'video', id: data.id };
  } else {
    formData.append('bytes', file);
    const res = await fetch(`https://graph.facebook.com/v21.0/${accountId}/adimages?access_token=${token}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const hash = Object.values(data.images)[0].hash;
    return { type: 'image', id: hash };
  }
}

async function launchCampaign() {
  const name = document.getElementById('launch-name').value;
  const budget = document.getElementById('launch-budget').value;
  const text = document.getElementById('launch-text').value;
  const headline = document.getElementById('launch-headline').value;
  const status = document.getElementById('launch-status');

  if (!name || !budget || !text || !headline || launchFiles.length === 0) {
    status.innerHTML = '<span style="color:var(--red)">Please fill in all fields and upload at least one creative</span>';
    return;
  }

  status.innerHTML = '<span class="spin" style="display:inline-block">⚙️</span> Step 1/2: Uploading large assets directly to Meta...';
  
  try {
    // Step 1: Direct Upload from Browser to Meta (Bypasses Vercel Limits)
    const assetResults = [];
    for (const file of launchFiles) {
      const result = await uploadFileToMeta(file);
      assetResults.push(result);
    }

    status.innerHTML = '<span class="spin" style="display:inline-block">⚙️</span> Step 2/2: Deploying "Gold Standard" campaign structure...';

    // Step 2: Notify Backend to create ads using the Asset IDs
    const res = await apiFetch(`/api/actions/launch-${launchPlatform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, budget, text, headline, 
        platform: launchPlatform,
        assets: assetResults 
      })
    });
    
    let data;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error("Server error: " + text.substring(0, 50));
    }

    if (data.ok) {
      status.innerHTML = `<span style="color:var(--emerald)">🚀 SUCCESS! ${launchPlatform === 'meta' ? 'Meta ASC' : 'Google PMax'} campaign is live with ${assetResults.length} ads.</span>`;
    } else {
      status.innerHTML = `<span style="color:var(--red)">Error: ${data.error}</span>`;
    }
  } catch (e) {
    status.innerHTML = `<span style="color:var(--red)">Launch failed: ${e.message}</span>`;
  }
}
