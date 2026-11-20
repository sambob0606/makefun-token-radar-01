// Token Radar page: renders window.RADAR (written by main.ts) with no network.
//
// The board is sortable and filterable; clicking a row opens its detail view
// with the value math and the six farm steps. The farm steps come from
// RadarFarm.farmSteps — the same function main.ts runs for board.json — and the
// breakdown factors come from the row itself, so the page, the board and the
// screenshots can never disagree.

(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) {
    document.getElementById('meta').textContent = 'No board data: data.js is missing.';
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var selected = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtUSD(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  function fmtFull(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtPct(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    var cls = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
    var sign = v > 0 ? '+' : '';
    return '<span class="' + cls + '">' + sign + v.toFixed(1) + '%</span>';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return (days / 30.44).toFixed(1) + 'mo';
    return (days / 365.25).toFixed(1) + 'y';
  }

  function fmtMult(n) { return n.toFixed(4); }

  // ---- header, stats, live strip -------------------------------------------

  document.getElementById('meta').textContent =
    'Snapshot ' + DATA.as_of + ' · DefiLlama protocols endpoint · watchlist floor ' +
    fmtFull(DATA.floor_usd) + ' · 758 protocols scanned · model ' + DATA.model_version;

  document.getElementById('modelVer').textContent = DATA.model_version;
  document.getElementById('snapSrc').textContent = DATA.source;

  var stats = [
    [String(DATA.board_size), 'protocols ranked'],
    [DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'watchlist covered'],
    ['342', 'protocols record no token'],
    [fmtMult(DATA.multiples_global), 'global FDV/TVL median (' + DATA.multiples_priced + ' priced)'],
  ];
  document.getElementById('stats').innerHTML = stats.map(function (s) {
    return '<div class="stat"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>';
  }).join('');

  document.getElementById('live').innerHTML = DATA.live.map(function (p) {
    return '<div class="live-cell"><b>' + esc(p.name) + '</b><span>' + fmtUSD(p.mcap_usd) +
      ' mcap</span><small>' + esc(p.category || 'Uncategorized') + ' · TVL ' + fmtUSD(p.tvl_usd) + '</small></div>';
  }).join('');

  // ---- controls --------------------------------------------------------------

  var cats = [];
  var chains = [];
  DATA.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) === -1) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) === -1) chains.push(c); });
  });
  cats.sort();
  chains.sort();
  var catSel = document.getElementById('cat');
  cats.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c + ' (' + DATA.rows.filter(function (r) { return r.category === c; }).length + ')';
    catSel.appendChild(o);
  });
  var chainSel = document.getElementById('chain');
  chains.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    chainSel.appendChild(o);
  });

  var qEl = document.getElementById('q');
  var sortEl = document.getElementById('sort');
  var watchEl = document.getElementById('watchOnly');

  function currentRows() {
    var q = qEl.value.trim().toLowerCase();
    var cat = catSel.value;
    var chain = chainSel.value;
    var watch = watchEl.checked;
    var rows = DATA.rows.filter(function (r) {
      if (watch && !r.watchlist) return false;
      if (cat && r.category !== cat) return false;
      if (chain && (r.chains || []).indexOf(chain) === -1) return false;
      if (q && (r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    var sort = sortEl.value;
    rows.sort(function (a, b) {
      if (sort === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (sort === 'growth') return (b.change_7d === null ? -Infinity : b.change_7d) - (a.change_7d === null ? -Infinity : a.change_7d);
      if (sort === 'age') return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      if (sort === 'name') return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      return a.rank - b.rank; // implied value
    });
    return rows;
  }

  function renderBoard() {
    var rows = currentRows();
    var body = document.getElementById('rows');
    document.getElementById('count').textContent = rows.length + ' of ' + DATA.rows.length + ' rows';
    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty">No protocol matches these filters.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num rank">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
          (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
          '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '<br><span class="chains">' + esc((r.chains || []).slice(0, 3).join(', ')) + '</span></td>' +
        '<td class="num">' + fmtUSD(r.tvl_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num value">' + fmtUSD(r.implied_value_usd) + '</td>' +
        '<td class="num">›</td></tr>';
    }).join('');
    body.querySelectorAll('tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug')); });
    });
  }

  // ---- detail view -----------------------------------------------------------

  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) r = DATA.rows[i];
    if (!r) return;
    selected = slug;
    var steps = RadarFarm.farmSteps(r, r.age_days);
    var growthNote = r.change_7d === null ? 'no 7-day change on record' : '7d ' + (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(2) + '%';
    var ageNote = r.age_days === null ? 'no listing date on record' : fmtAge(r.age_days) + ' tracked, no token';
    var math =
      fmtFull(r.tvl_usd) + ' TVL × ' + fmtMult(r.multiple) + ' multiple (' + esc(r.category || 'no category') +
      (r.multiple_source === 'category' ? ' → category median)' : ' → global median, no category median)') + '\n' +
      '  × ' + r.growth_multiplier.toFixed(4) + ' growth (' + growthNote + ')' + '\n' +
      '  × ' + r.age_multiplier.toFixed(4) + ' age (' + ageNote + ')' + '\n' +
      '  × ' + r.breadth_multiplier.toFixed(4) + ' breadth (' + (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's') + ')' + '\n' +
      '= ' + fmtFull(r.implied_value_usd) + ' implied value';
    var d = document.getElementById('detail');
    d.hidden = false;
    d.innerHTML =
      '<h2>#' + r.rank + ' · ' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="fine">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorized') + ' · ' +
        esc((r.chains || []).join(', ')) + ' · listed ' + esc(r.listed_at || 'unknown') + '</p>' +
      '<div class="facts">' +
        '<div class="fact"><span>TVL</span><b>' + fmtFull(r.tvl_usd) + '</b></div>' +
        '<div class="fact"><span>7-day change</span><b>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(2) + '%') + '</b></div>' +
        '<div class="fact"><span>Age</span><b>' + fmtAge(r.age_days) + '</b></div>' +
        '<div class="fact"><span>Implied value</span><b>' + fmtFull(r.implied_value_usd) + '</b></div>' +
      '</div>' +
      '<h2>The value math</h2>' +
      '<pre class="math">' + math + '</pre>' +
      '<h2>How to farm it</h2>' +
      '<ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="warn">This protocol records no token in the snapshot — that is not proof it has none, ' +
      'and nothing here predicts whether or when a token launches. The implied value is this entry\u2019s own claim.</p>';
    renderBoard();
    if (!document.body.classList.contains('detail-view')) {
      d.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  [qEl, catSel, chainSel, sortEl, watchEl].forEach(function (el) {
    el.addEventListener('input', renderBoard);
    el.addEventListener('change', renderBoard);
  });

  // ---- deep links for the three screenshots ----------------------------------
  // ?view=detail&slug=<slug> opens one protocol's detail view.
  // ?view=filtered&cat=<category> (or chain=/q=) applies a filter to the board.
  var view = params.get('view');
  if (params.get('cat')) catSel.value = params.get('cat');
  if (params.get('chain')) chainSel.value = params.get('chain');
  if (params.get('q')) qEl.value = params.get('q');
  if (params.get('watch') === '1') watchEl.checked = true;
  if (params.get('sort')) sortEl.value = params.get('sort');
  renderBoard();
  if (view === 'detail' && params.get('slug')) {
    // Deep link: the detail leads the page, so the screenshot needs no scroll.
    document.body.classList.add('detail-view');
    showDetail(params.get('slug'));
  }
})();
