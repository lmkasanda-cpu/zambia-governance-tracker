'use strict';

/* ═══════════════════════════════════════════════
   ZAMBIA GOVERNANCE TRACKER — app.js
   Data sources: World Bank · Open Exchange Rates
   Bank of Zambia · PwC Mining 2025 · PBO 2025
   AllOrigins CORS proxy for RSS feeds
═══════════════════════════════════════════════ */

const PROXY = url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

// ── Static data verification registry ────────
// Dates when official sources were last checked.
// Update this when you refresh hardcoded numbers.
const VERIFIED = {
  'copper-prod':      { date: '2025-12-01', src: 'PwC Zambia Mining Report 2025' },
  'copper-price':     { date: '2025-12-01', src: 'PwC Mining 2025 / BoZ' },
  'cobalt':           { date: '2025-12-01', src: 'PwC Zambia Mining Report 2025' },
  'nickel':           { date: '2025-12-01', src: 'PwC Zambia Mining Report 2025' },
  'gold':             { date: '2025-12-01', src: 'PwC Zambia Mining Report 2025' },
  'emeralds':         { date: '2025-12-01', src: 'PwC Zambia Mining Report 2025' },
  'reserves':         { date: '2025-05-01', src: 'PBO Budget Brief / BoZ Q1 2025' },
  'zmw-history':      { date: '2025-05-01', src: 'BoZ Daily Rates / MoFNP 2025' },
  'inflation':        { date: '2025-06-01', src: 'ZamStats / MoFNP Econ Dev 2025' },
  'cpi-score':        { date: '2025-01-28', src: 'Transparency International 2024' },
  'mo-ibrahim':       { date: '2023-10-01', src: 'Mo Ibrahim Foundation IIAG 2023' },
  'press-freedom':    { date: '2024-05-03', src: 'Reporters Without Borders 2024' },
  'democracy-index':  { date: '2024-02-15', src: 'EIU Democracy Index 2023' },
  'rule-of-law':      { date: '2023-10-25', src: 'World Justice Project 2023' },
  'hdi':              { date: '2024-03-13', src: 'UNDP Human Development Report 2023/24' },
  'energy-access':    { date: '2024-11-01', src: 'MoE / ZamStats NEAS 2023' },
  'budget-2024':      { date: '2025-05-01', src: 'Parliamentary Budget Office May 2025' },
  'debt-restruct':    { date: '2026-06-26', src: 'AfDB / MoFNP June 2026' },
  'maize':            { date: '2026-05-01', src: 'Ministry of Agriculture May 2026' },
  'poverty-rate':     { date: '2025-06-01', src: 'UNICEF 2026 Social Sector Budget Analysis' },
  'birth-reg':        { date: '2024-01-01', src: 'UNICEF Zambia 2024' },
  'fuel-prices':      { date: '2026-06-28', src: 'Energy Regulation Board' },
  'zesco-status':     { date: '2025-06-01', src: 'ZESCO / Diggers News May 2025' },
  'mining-fdi':       { date: '2025-12-01', src: 'ZDA Annual Report / PwC 2025' },
  'mineral-exports':  { date: '2025-12-01', src: 'MoFNP Annual Economic Report 2024' },
  'social-budget':    { date: '2026-06-01', src: 'UNICEF 2026 Social Sector Budget Analysis' },
};

// ── Sentiment word lists ──────────────────────
const POS_WORDS = [
  'growth','increase','improve','record','achieve','success','develop','progress',
  'boost','recover','invest','build','launch','complete','award','support','partner',
  'fund','grant','revenue','surplus','gain','advance','reform','win','approve',
  'sign','agreement','peace','stable','expand','rise','positive','new','open'
];
const NEG_WORDS = [
  'fall','drop','decline','crisis','corrupt','arrest','fail','deficit','inflation',
  'debt','poverty','cut','close','protest','strike','shortage','threat','attack',
  'kill','die','violence','crime','fraud','scandal','suspend','ban','fire','resign',
  'collapse','default','flood','drought','hunger','looting','riot','detained','abuse'
];

function getSentiment(text) {
  const t = (text || '').toLowerCase();
  const p = POS_WORDS.filter(w => t.includes(w)).length;
  const n = NEG_WORDS.filter(w => t.includes(w)).length;
  if (p > n) return 'positive';
  if (n > p) return 'negative';
  return 'neutral';
}

// ── Formatting helpers ────────────────────────
const fmt = {
  num:  (v, dp=2) => v != null ? Number(v).toFixed(dp) : '—',
  pct:  (v, dp=1) => v != null ? `${Number(v).toFixed(dp)}%` : '—',
  big:  (v) => {
    if (v == null) return '—';
    if (v >= 1e9) return `${(v/1e9).toFixed(2)}B`;
    if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
    return Number(v).toLocaleString();
  },
  date: (s) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }
};

// ── Set a KPI card value ──────────────────────
function setCard(id, value, sub, cssClass) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove('skeleton','up','down','neutral');
  if (cssClass) card.classList.add(cssClass);
  const valEl  = card.querySelector('.kpi-value');
  const subEl  = card.querySelector('.kpi-sub');
  if (valEl) valEl.textContent = value;
  if (subEl && sub) subEl.textContent = sub;
}

// ══════════════════════════════════════════════
//  1. EXCHANGE RATES
// ══════════════════════════════════════════════
async function loadExchangeRates() {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.result !== 'success') throw new Error('API error');

    const rates = data.rates;
    const ZMW   = rates.ZMW;  // ZMW per 1 USD

    const pairs = {
      usd: { label:'ZMW / USD', val: ZMW,                     dp: 2 },
      gbp: { label:'ZMW / GBP', val: ZMW / rates.GBP,         dp: 2 },
      eur: { label:'ZMW / EUR', val: ZMW / rates.EUR,         dp: 2 },
      zar: { label:'ZMW / ZAR', val: ZMW / rates.ZAR,         dp: 3 },
    };

    Object.entries(pairs).forEach(([key, p]) => {
      setCard(`fx-${key}`, fmt.num(p.val, p.dp), `1 ${key.toUpperCase()} = ${fmt.num(p.val, p.dp)} ZMW`);
    });

    // update ticker
    updateTicker(pairs, data.time_last_update_utc);
    return pairs;
  } catch(e) {
    console.warn('Exchange rate fetch failed:', e);
    ['usd','gbp','eur','zar'].forEach(k => setCard(`fx-${k}`, 'Unavailable','Check Bank of Zambia'));
  }
}

// ══════════════════════════════════════════════
//  2. COPPER PRICE  (Yahoo Finance via proxy)
// ══════════════════════════════════════════════
// Copper price sources (in priority order):
// 1. Yahoo Finance HG=F (COMEX front-month futures) via AllOrigins proxy
// 2. Fallback: manual reference to Google Finance HGW00:COMEX
// Reference: https://www.google.com/finance/beta/quote/HGW00:COMEX
// HGW00 = COMEX Copper front-month rolling contract (same underlying as HG=F)
const COPPER_GF_URL = 'https://www.google.com/finance/beta/quote/HGW00:COMEX';

async function loadCopperPrice() {
  try {
    const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/HG%3DF?interval=1d&range=1d';
    const res  = await fetch(PROXY(yahooUrl));
    const wrap = await res.json();
    const parsed = JSON.parse(wrap.contents);
    const meta   = parsed?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No data');

    // HG=F / HGW00 is quoted in USD/lb on COMEX
    const priceLb    = meta.regularMarketPrice;
    const priceTonne = priceLb * 2204.62;   // 1 tonne = 2204.62 lbs

    setCard('copper-card',
      `$${fmt.num(priceTonne, 0)}`,
      `USD/tonne · ${fmt.num(priceLb, 3)} USD/lb · COMEX HGW00 · ${new Date().toLocaleDateString()}`,
      priceLb > 3.5 ? 'up' : 'down'
    );
    return priceTonne;
  } catch(e) {
    console.warn('Copper price fetch failed — check Google Finance for live price:', e.message);
    const card = document.getElementById('copper-card');
    if (card) {
      card.classList.remove('skeleton');
      card.querySelector('.kpi-value').innerHTML =
        `<a href="${COPPER_GF_URL}" target="_blank" style="color:var(--copper-lt);font-size:1rem;">View live price ↗</a>`;
      card.querySelector('.kpi-sub').textContent = 'COMEX HGW00 · Google Finance';
    }
  }
}

// ══════════════════════════════════════════════
//  3. WORLD BANK DATA
// ══════════════════════════════════════════════
async function fetchWB(indicator, mrv = 5) {
  const url = `https://api.worldbank.org/v2/country/ZM/indicator/${indicator}?format=json&mrv=${mrv}`;
  const res  = await fetch(url);
  const json = await res.json();
  return (json[1] || []).filter(d => d.value != null).sort((a,b) => b.date - a.date);
}

async function loadWorldBankData() {
  try {
    const [inflation, gdpGrowth, gdpPc, debtGdp, ca, pop, poverty, life, unemp, reserves, zmwRate] = await Promise.allSettled([
      fetchWB('FP.CPI.TOTL.ZG', 6),   // Inflation
      fetchWB('NY.GDP.MKTP.KD.ZG', 6), // GDP growth
      fetchWB('NY.GDP.PCAP.CD', 3),    // GDP per capita
      fetchWB('GC.DOD.TOTL.GD.ZS', 3),// Debt/GDP
      fetchWB('BN.CAB.XOKA.GD.ZS', 3),// Current account
      fetchWB('SP.POP.TOTL', 3),       // Population
      fetchWB('SI.POV.DDAY', 5),       // Poverty
      fetchWB('SP.DYN.LE00.IN', 3),    // Life expectancy
      fetchWB('SL.UEM.TOTL.ZS', 3),   // Unemployment
      fetchWB('FI.RES.TOTL.CD', 3),   // Foreign reserves (total, current USD)
      fetchWB('PA.NUS.FCRF', 5),       // Official exchange rate ZMW/USD annual avg
    ]);

    const latest = arr => arr.status === 'fulfilled' && arr.value.length ? arr.value[0] : null;

    // Inflation
    const inf = latest(inflation);
    if (inf) {
      const cls = inf.value > 15 ? 'down' : inf.value > 8 ? 'neutral' : 'up';
      setCard('inflation-card', fmt.pct(inf.value), `${inf.date} · Annual % Change`, cls);
    }

    // GDP growth
    const gdpG = latest(gdpGrowth);
    if (gdpG) {
      const cls = gdpG.value > 3 ? 'up' : gdpG.value > 0 ? 'neutral' : 'down';
      setCard('gdp-growth-card', fmt.pct(gdpG.value), `${gdpG.date} · Annual GDP Growth`, cls);
    }

    // GDP per capita
    const gdpP = latest(gdpPc);
    if (gdpP) setCard('gdp-pc-card', `$${fmt.big(gdpP.value)}`, `${gdpP.date} · Current USD`);

    // Debt / GDP
    const debt = latest(debtGdp);
    if (debt) {
      const cls = debt.value > 80 ? 'down' : debt.value > 50 ? 'neutral' : 'up';
      setCard('debt-gdp-card', fmt.pct(debt.value), `${debt.date} · % of GDP`, cls);
    }

    // Current account
    const ca0 = latest(ca);
    if (ca0) {
      const cls = ca0.value >= 0 ? 'up' : 'down';
      setCard('ca-card', fmt.pct(ca0.value), `${ca0.date} · % of GDP`, cls);
    }

    // Population
    const pop0 = latest(pop);
    if (pop0) setCard('pop-card', fmt.big(pop0.value), `${pop0.date} · World Bank`);

    // Poverty
    const pov0 = latest(poverty);
    if (pov0) {
      const cls = pov0.value > 50 ? 'down' : pov0.value > 30 ? 'neutral' : 'up';
      setCard('poverty-card', fmt.pct(pov0.value), `${pov0.date} · at $2.15/day`, cls);
    }

    // Life expectancy
    const life0 = latest(life);
    if (life0) setCard('life-card', `${fmt.num(life0.value, 1)} yrs`, `${life0.date} · at birth`);

    // Unemployment
    const un0 = latest(unemp);
    if (un0) {
      const cls = un0.value > 15 ? 'down' : un0.value > 8 ? 'neutral' : 'up';
      setCard('unemp-card', fmt.pct(un0.value), `${un0.date} · % of labour force`, cls);
    }

    // Foreign reserves
    // Source: PBO Budget Brief May 2025 — US$4.5B = 4.6 months import cover at end-Q1 2025
    // BoZ monthly forex purchases from mines drive reserve build-up under IMF ECF programme
    // Monthly import baseline: $4,500M / 4.6 = ~$978M/month (BoZ/MoFNP data)
    const MONTHLY_IMPORTS = 978e6;
    const res0 = latest(reserves);
    if (res0) {
      const months = res0.value / MONTHLY_IMPORTS;
      const cls = months >= 3 ? 'up' : months >= 2 ? 'neutral' : 'down';
      setCard(
        'reserves-card',
        `$${fmt.big(res0.value)}`,
        `${res0.date} · ≈${fmt.num(months,1)} mths import cover · IMF min: 3 mths`,
        cls
      );
    } else {
      // Fallback to latest known official figure (PBO Brief, Q1 2025)
      setCard('reserves-card', '$4.5B', 'Q1 2025 · 4.6 months import cover (BoZ / PBO)', 'up');
    }

    // ZMW/USD annual average — year-on-year change
    if (zmwRate.status === 'fulfilled' && zmwRate.value.length >= 2) {
      const rates = zmwRate.value; // sorted newest first
      const latest_r = rates[0];
      const prev_r   = rates[1];
      const pctChange = ((latest_r.value - prev_r.value) / prev_r.value) * 100;
      // Depreciation = ZMW/USD rate rising = bad for ZMW
      const depreciated = pctChange > 0;
      const cls = depreciated ? 'down' : 'up';
      const arrow = depreciated ? '▲' : '▼';
      const label = depreciated ? 'depreciated' : 'strengthened';
      setCard(
        'zmw-yoy-card',
        `${arrow} ${fmt.num(Math.abs(pctChange), 1)}%`,
        `ZMW ${label} vs USD · ${prev_r.date}→${latest_r.date} · avg ${fmt.num(latest_r.value,2)} ZMW`,
        cls
      );
    }

    // Draw inflation chart
    if (inflation.status === 'fulfilled' && inflation.value.length) {
      drawLineChart(
        'inflation-chart',
        inflation.value.slice().reverse(),
        'Inflation Rate (%)',
        '#f59e0b'
      );
    }

    return { inflation, gdpGrowth, gdpPc, debtGdp };
  } catch(e) {
    console.warn('World Bank data error:', e);
  }
}

// ══════════════════════════════════════════════
//  4. CHARTS
// ══════════════════════════════════════════════
const chartInstances = {};

function drawLineChart(canvasId, dataPoints, label, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dataPoints.map(d => d.date),
      datasets: [{
        label,
        data:  dataPoints.map(d => d.value),
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: color,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899b4', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1a2235',
          borderColor: '#1f2d45',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#8899b4',
        }
      },
      scales: {
        x: { ticks: { color: '#8899b4', font: { size: 11 } }, grid: { color: '#1f2d45' } },
        y: { ticks: { color: '#8899b4', font: { size: 11 } }, grid: { color: '#1f2d45' } }
      }
    }
  });
}

function drawCopperProductionChart() {
  // Source: MMMD COPPER-PRODUCTION-1960-2023MAY.xlsx + MoFNP/PBO Budget Brief 2025
  // All values in metric tonnes (actual, not thousands)
  const data = [
    { year: '2010', val: 767_008  },
    { year: '2011', val: 739_759  },
    { year: '2012', val: 721_446  },
    { year: '2013', val: 763_805  },
    { year: '2014', val: 708_259  },
    { year: '2015', val: 710_560  },
    { year: '2016', val: 770_598  },
    { year: '2017', val: 797_265  },
    { year: '2018', val: 806_218  },
    { year: '2019', val: 733_089  },
    { year: '2020', val: 837_996  },
    { year: '2021', val: 800_696  },
    { year: '2022', val: 763_287  },
    { year: '2023', val: 736_747  },   // PBO Budget Brief 2025
    { year: '2024', val: 820_676  },   // PBO Budget Brief 2025 (MoFNP data)
  ];
  const ctx = document.getElementById('copper-prod-chart');
  if (!ctx) return;
  if (chartInstances['copper-prod-chart']) chartInstances['copper-prod-chart'].destroy();

  chartInstances['copper-prod-chart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        label: 'Production (000 tonnes)',
        data: data.map(d => d.val),
        backgroundColor: '#b8733344',
        borderColor: '#b87333',
        borderWidth: 2,
        borderRadius: 4,
      }, {
        label: '2031 Target (3,000K t)',
        data: data.map(() => 3000),
        type: 'line',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899b4', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1a2235',
          borderColor: '#1f2d45',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#8899b4',
          callbacks: {
            label: ctx => {
              if (ctx.dataset.type === 'line') return `Target: ${Number(ctx.raw).toLocaleString()} mt`;
              return `${Number(ctx.raw).toLocaleString()} mt (${(ctx.raw/1e6).toFixed(2)}M)`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8899b4' }, grid: { color: '#1f2d45' } },
        y: {
          min: 0,
          ticks: { color: '#8899b4', callback: v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1000).toFixed(0)}K` },
          grid: { color: '#1f2d45' }
        }
      }
    }
  });
}

// ── ZMW/USD Historical Rate Chart ─────────────────────
// Source: Bank of Zambia daily rates (DAILY_RATES_20.xlsx) + MoFNP Budget Brief 2025
function drawZMWChart() {
  const data = [
    { year: '2011', val: 5.01  },
    { year: '2012', val: 5.13  },
    { year: '2013', val: 5.38  },
    { year: '2014', val: 6.14  },
    { year: '2015', val: 8.69  },  // currency crisis / low copper prices
    { year: '2016', val: 10.29 },
    { year: '2017', val: 9.57  },  // brief recovery
    { year: '2018', val: 10.45 },
    { year: '2019', val: 12.90 },
    { year: '2020', val: 18.29 },  // COVID + Eurobond default
    { year: '2021', val: 19.89 },
    { year: '2022', val: 16.88 },  // partial recovery
    { year: '2023', val: 20.23 },  // PBO Budget Brief: K20.23 avg
    { year: '2024', val: 26.19 },  // PBO Budget Brief: K26.19 avg (–29.4% depreciation)
    { year: '2026*', val: 18.56 }, // ERB pricing window rate, May/Jun 2026 — strong appreciation
  ];

  const plotData = data.filter(d => d.val !== null);
  const ctx = document.getElementById('zmw-chart');
  if (!ctx) return;
  if (chartInstances['zmw-chart']) chartInstances['zmw-chart'].destroy();

  chartInstances['zmw-chart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: plotData.map(d => d.year),
      datasets: [{
        label: 'ZMW per 1 USD (annual avg)',
        data: plotData.map(d => d.val),
        borderColor: '#b87333',
        backgroundColor: 'rgba(184,115,51,0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: plotData.map(d =>
          d.year === '2024' ? '#dc2626' :
          d.year === '2020' ? '#f59e0b' : '#b87333'
        ),
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899b4', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1a2235',
          borderColor: '#1f2d45',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#8899b4',
          callbacks: {
            label: ctx => `K ${Number(ctx.raw).toFixed(2)} per USD`,
            afterLabel: ctx => {
              const notes = {
                '2015': 'Copper price crash & fiscal pressures',
                '2020': 'COVID-19 + Eurobond default',
                '2023': 'Drought pressure begins',
                '2024': '–29.4% depreciation (drought, food/electricity imports)',
                '2026*': 'ERB pricing window rate (May/Jun 2026) — sharp appreciation',
              };
              return notes[ctx.label] || '';
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8899b4', font: { size: 10 } }, grid: { color: '#1f2d45' } },
        y: {
          title: { display: true, text: 'ZMW per USD', color: '#8899b4', font: { size: 10 } },
          ticks: { color: '#8899b4', callback: v => `K ${v.toFixed(0)}` },
          grid: { color: '#1f2d45' }
        }
      }
    }
  });
}

function drawCPIChart() {
  // Static historical CPI scores for Zambia (Transparency International)
  const cpiData = [
    { year: '2017', score: 37 },
    { year: '2018', score: 35 },
    { year: '2019', score: 34 },
    { year: '2020', score: 33 },
    { year: '2021', score: 32 },
    { year: '2022', score: 33 },
    { year: '2023', score: 33 },
    { year: '2024', score: 33 },
  ];
  const ctx = document.getElementById('cpi-chart');
  if (!ctx) return;
  if (chartInstances['cpi-chart']) chartInstances['cpi-chart'].destroy();

  chartInstances['cpi-chart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cpiData.map(d => d.year),
      datasets: [{
        label: 'CPI Score (/100, higher = less corrupt)',
        data: cpiData.map(d => d.score),
        backgroundColor: cpiData.map(d =>
          d.score >= 50 ? '#16a34a44' : d.score >= 35 ? '#d9770644' : '#dc262644'
        ),
        borderColor: cpiData.map(d =>
          d.score >= 50 ? '#16a34a' : d.score >= 35 ? '#f59e0b' : '#ef4444'
        ),
        borderWidth: 2,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899b4', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1a2235',
          borderColor: '#1f2d45',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#8899b4',
          callbacks: {
            label: ctx => `Score: ${ctx.raw}/100`
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8899b4' }, grid: { color: '#1f2d45' } },
        y: {
          min: 0, max: 100,
          ticks: { color: '#8899b4' },
          grid: { color: '#1f2d45' }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════
//  5. FUEL PRICES  (ERB — via CORS proxy)
// ══════════════════════════════════════════════

// ERB pump prices — June 2026 (ERB Press Release, effective midnight 31 May 2026)
// Source: Energy Regulation Board — Review of Petroleum Pump Prices June 2026
// BoZ rate used for this pricing window: K18.56/USD (significant kwacha appreciation)
const FUEL_FALLBACK = { petrol: 27.15, diesel: 32.11, kerosene: 33.91, jetA1: 36.68 };
// Note: diesel > petrol in June 2026 due to higher global diesel benchmark prices

async function loadFuelPrices() {
  try {
    const res  = await fetch(PROXY('https://www.erb.org.zm/'), { signal: AbortSignal.timeout(8000) });
    const wrap = await res.json();
    const html = (wrap.contents || '').replace(/<[^>]+>/g, ' ');

    // ERB pages typically show prices as "K 32.46" or "32.46 per litre"
    const extract = (pattern) => {
      const m = html.match(pattern);
      return m ? parseFloat(m[1]) : null;
    };

    const petrol   = extract(/[Pp]etrol[^K\d]{0,30}K?\s*(\d{2,3}\.\d{2})/);
    const diesel   = extract(/[Dd]iesel[^K\d]{0,30}K?\s*(\d{2,3}\.\d{2})/);
    const kerosene = extract(/[Kk]erosene[^K\d]{0,30}K?\s*(\d{2,3}\.\d{2})/);

    renderFuelCards(
      petrol   || FUEL_FALLBACK.petrol,
      diesel   || FUEL_FALLBACK.diesel,
      kerosene || FUEL_FALLBACK.kerosene,
      !!petrol  // true = live, false = fallback
    );
  } catch(e) {
    console.warn('ERB fuel fetch failed, using June 2026 ERB prices:', e.message);
    renderFuelCards(FUEL_FALLBACK.petrol, FUEL_FALLBACK.diesel, FUEL_FALLBACK.kerosene, false);
  }
}

function renderFuelCards(petrol, diesel, kerosene, isLive) {
  const src  = isLive ? 'ERB (live)' : 'ERB Jun 2026 · erb.org.zm';
  const note = `ZMW / litre · ${src}`;

  setCard('fuel-petrol-card',   `K ${fmt.num(petrol,   2)}`, note, 'neutral');
  setCard('fuel-diesel-card',   `K ${fmt.num(diesel,   2)}`, note + ' · ↓ from K33.99', 'up');
  setCard('fuel-kerosene-card', `K ${fmt.num(kerosene, 2)}`, note + ' · ↓ from K35.05', 'up');
}

// ══════════════════════════════════════════════
//  6. MAIZE PRODUCTION CHART
// ══════════════════════════════════════════════

function drawMaizeChart() {
  // Historical Zambia maize production (thousand metric tonnes) — FAO / Ministry of Agriculture
  const data = [
    { year: '2017', val: 2_731, note: '' },
    { year: '2018', val: 2_438, note: '' },
    { year: '2019', val: 3_396, note: '' },
    { year: '2020', val: 3_740, note: 'Record' },
    { year: '2021', val: 3_430, note: '' },
    { year: '2022', val: 3_480, note: '' },
    { year: '2023/24', val: 1_946, note: 'El Niño' },
    { year: '2024/25', val: 3_400, note: 'Est.' },
    { year: '2025/26', val: 5_000, note: 'Projected' },
  ];

  const ctx = document.getElementById('maize-chart');
  if (!ctx) return;
  if (chartInstances['maize-chart']) chartInstances['maize-chart'].destroy();

  const colors = data.map(d =>
    d.year === '2025/26' ? '#16a34a66' :
    d.year === '2023/24' ? '#dc262666' : '#b8733344'
  );
  const borders = data.map(d =>
    d.year === '2025/26' ? '#16a34a' :
    d.year === '2023/24' ? '#dc2626' : '#b87333'
  );

  chartInstances['maize-chart'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.year),
      datasets: [{
        label: 'Maize Production (000 mt)',
        data: data.map(d => d.val),
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 2,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899b4', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1a2235',
          borderColor: '#1f2d45',
          borderWidth: 1,
          titleColor: '#e8edf5',
          bodyColor: '#8899b4',
          callbacks: {
            label: ctx => {
              const d = data[ctx.dataIndex];
              return `${Number(ctx.raw).toLocaleString()} 000 mt${d.note ? ` (${d.note})` : ''}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#8899b4' }, grid: { color: '#1f2d45' } },
        y: {
          min: 0,
          ticks: { color: '#8899b4', callback: v => `${(v/1000).toFixed(0)}M` },
          grid: { color: '#1f2d45' }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════
//  7. NEWS RSS FEEDS
// ══════════════════════════════════════════════
const RSS_FEEDS = [
  // ── Local Zambian media ──
  { url: 'https://www.daily-mail.co.zm/feed/',       source: 'Daily Mail',    type: 'local' },
  { url: 'https://diggers.news/feed/',               source: 'Diggers',       type: 'local' },
  { url: 'https://dailynationzambia.com/feed/',      source: 'Daily Nation',  type: 'local' },
  { url: 'https://makanday.org/feed/',               source: 'Makanday',      type: 'local' },
  { url: 'https://www.lusakatimes.com/feed/',        source: 'Lusaka Times',  type: 'local' },
  { url: 'https://znbc.co.zm/feed/',                 source: 'ZNBC',          type: 'local' },
  { url: 'https://times.co.zm/feed/',                source: 'Times of Zambia', type: 'local' },
  // ── International, filtered for Zambia ──
  { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', source: 'BBC Africa',     type: 'international', filterZambia: true },
  { url: 'https://feeds.reuters.com/reuters/africaNews',        source: 'Reuters Africa', type: 'international', filterZambia: true },
];

let allNewsItems = [];
let activeFilter = 'all';

function parseRSSXML(xml) {
  const doc    = new DOMParser().parseFromString(xml, 'text/xml');
  const items  = [...doc.querySelectorAll('item')];
  return items.slice(0, 15).map(item => {
    const get = tag => item.querySelector(tag)?.textContent?.trim() || '';
    // Some feeds put link text inside CDATA — extract text node
    const linkEl = item.querySelector('link');
    const link   = linkEl ? (linkEl.nextSibling?.nodeValue?.trim() || linkEl.textContent?.trim() || '') : '';
    return {
      title:   get('title').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      link,
      date:    get('pubDate'),
      desc:    get('description').replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim().slice(0, 200),
    };
  }).filter(i => i.title && i.link);
}

async function fetchFeed(feed) {
  try {
    const res  = await fetch(PROXY(feed.url), { signal: AbortSignal.timeout(10000) });
    const wrap = await res.json();
    let items  = parseRSSXML(wrap.contents || '');
    if (feed.filterZambia) {
      items = items.filter(i =>
        /zambia|zambian|lusaka|kwacha|zesco|znbc|copperbelt/i.test(i.title + ' ' + i.desc)
      );
    }
    return items.map(i => ({
      ...i,
      source:    feed.source,
      type:      feed.type,
      sentiment: getSentiment(i.title + ' ' + i.desc),
    }));
  } catch(e) {
    console.warn(`Feed failed (${feed.source}):`, e.message);
    return [];
  }
}

async function loadNews() {
  document.getElementById('news-grid').innerHTML =
    '<div class="news-skeleton">Loading news from Zambia sources…</div>';

  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
  allNewsItems  = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  renderNews(activeFilter);
  setupNewsTabs();
}

function renderNews(filter) {
  const grid    = document.getElementById('news-grid');
  const countEl = document.getElementById('news-count');

  let items = allNewsItems;
  if (filter === 'local')         items = items.filter(i => i.type === 'local');
  if (filter === 'international') items = items.filter(i => i.type === 'international');
  if (filter === 'positive')      items = items.filter(i => i.sentiment === 'positive');
  if (filter === 'negative')      items = items.filter(i => i.sentiment === 'negative');

  countEl.textContent = `${items.length} articles`;

  if (!items.length) {
    grid.innerHTML = '<div class="news-skeleton">No articles matched this filter.</div>';
    return;
  }

  grid.innerHTML = items.map(item => `
    <article class="news-card ${item.sentiment}">
      <div class="news-meta">
        <span class="news-source">${item.source}</span>
        <span class="news-date">${fmt.date(item.date)}</span>
        <span class="sentiment-badge ${item.sentiment}">${
          item.sentiment === 'positive' ? '▲ Positive' :
          item.sentiment === 'negative' ? '▼ Negative' : '● Neutral'
        }</span>
      </div>
      <a href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
      ${item.desc ? `<p class="news-desc">${item.desc}</p>` : ''}
    </article>
  `).join('');
}

function setupNewsTabs() {
  document.getElementById('news-tabs').addEventListener('click', e => {
    if (!e.target.classList.contains('tab-btn')) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeFilter = e.target.dataset.filter;
    renderNews(activeFilter);
  });
}

// ══════════════════════════════════════════════
//  6. TICKER BAR
// ══════════════════════════════════════════════
function updateTicker(pairs, updatedAt) {
  const items = [
    { label:'ZMW/USD', val: fmt.num(pairs.usd.val, 2) },
    { label:'ZMW/GBP', val: fmt.num(pairs.gbp.val, 2) },
    { label:'ZMW/EUR', val: fmt.num(pairs.eur.val, 2) },
    { label:'ZMW/ZAR', val: fmt.num(pairs.zar.val, 3) },
    { label:'CPI Score', val: '33/100 (TI 2024)' },
    { label:'HDI', val: '0.565 (UNDP 2023)' },
    { label:'Press Freedom', val: 'Rank 96/180 (RSF 2024)' },
    { label:'Mo Ibrahim', val: '48.4/100 (2023)' },
  ];

  // Duplicate for seamless scroll
  const html = [...items, ...items].map(i =>
    `<span class="tick-item">${i.label} <span class="tick-val">${i.val}</span></span>`
  ).join('');

  document.getElementById('ticker').innerHTML = html;

  const ts = updatedAt ? new Date(updatedAt).toLocaleString() : new Date().toLocaleString();
  document.getElementById('last-updated').textContent = `Last updated: ${ts}`;
}

// ══════════════════════════════════════════════
//  7. GOVERNANCE SCORE COLOURING
// ══════════════════════════════════════════════
function colourScoreRings() {
  document.querySelectorAll('.score-ring[data-score]').forEach(el => {
    const score = parseInt(el.dataset.score, 10);
    const max   = parseInt(el.dataset.max,   10) || 100;
    const pct   = (score / max) * 100;
    if (pct >= 60) el.classList.add('good');
    else if (pct < 35) el.classList.add('poor');
  });
}

// ══════════════════════════════════════════════
//  8. MISC INIT
// ══════════════════════════════════════════════
function setYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

// ══════════════════════════════════════════════
//  8. VERIFIED BADGES
// ══════════════════════════════════════════════
function renderVerifiedBadges() {
  document.querySelectorAll('[data-verified]').forEach(el => {
    const key  = el.dataset.verified;
    const info = VERIFIED[key];
    if (!info) return;
    const badge = document.createElement('span');
    badge.className = 'verified-badge';
    badge.title = `Source: ${info.src}`;
    badge.textContent = `✓ ${info.date}`;
    el.appendChild(badge);
  });
}

// ══════════════════════════════════════════════
//  MAIN: load all data
// ══════════════════════════════════════════════
async function init() {
  setYear();
  colourScoreRings();
  renderVerifiedBadges();
  drawCPIChart();
  drawCopperProductionChart();
  drawMaizeChart();
  drawZMWChart();

  // Load in parallel — each handles its own errors
  await Promise.allSettled([
    loadExchangeRates(),
    loadCopperPrice(),
    loadWorldBankData(),
    loadFuelPrices(),
    loadNews(),
  ]);
}

// Expose refresh for the button
window.ZGT = { refresh: init };

// Kick off
document.addEventListener('DOMContentLoaded', init);

// Auto-refresh exchange rates every 5 minutes
setInterval(loadExchangeRates, 5 * 60 * 1000);
// Auto-refresh news every 15 minutes
setInterval(loadNews, 15 * 60 * 1000);
// Re-check fuel prices once per hour (ERB updates are infrequent but worth catching)
setInterval(loadFuelPrices, 60 * 60 * 1000);
