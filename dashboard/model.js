// Token Radar value model (radar-catmedian-1).
//
// A plain script, no modules and no network, so the dashboard page loads it as a
// classic script and main.ts loads the same file for the board. One implementation,
// one answer: the page's breakdowns and board.json's implied values come from the
// same functions.
//
// The model scores a protocol only from the sealed snapshot's own figures:
//
//   implied = TVL x multiple x growth x age x breadth
//
//   multiple  the category's own FDV/TVL: the median mcap_usd / tvl_usd of the
//             snapshot's token-having protocols in the same category (at least 3
//             of them with a market cap), else the global median over all such
//             protocols; clamped to [0.05, 1.5]. No name is ever special-cased:
//             the multiple is read off the market the snapshot records.
//   growth    1 + 0.6 x clamp(change_7d, -40, +80) / 100; no 7-day change on
//             record counts as flat (1.0).
//   age       1 + 0.08 x min(years since listed_at, 5); a protocol DefiLlama
//             has tracked longer with no token recorded earns a patience
//             premium of up to 40%; no listing date counts as 1.0.
//   breadth   1 + 0.015 x min(chains - 1, 10); a protocol live on more chains
//             reaches more farmers, worth up to 15%.
//
// Eligibility is the snapshot's own watchlist rule with the floor removed: a
// protocol records no token (gecko_id and symbol both null) and is not a
// wrapped, staked or bridged product of a token that already trades, not a
// versioned pool and not an exchange's own product. The watchlist's 40 are the
// floor; the board ranks every protocol that passes the same rule, floor or not.

var RadarModel = (function () {
  'use strict';

  var MODEL_VERSION = 'radar-catmedian-1';

  /** Whole days from `from` (YYYY-MM-DD) to `to`, clamped at zero; null when either is absent or bad. */
  function ageDays(asOf, listedAt) {
    if (listedAt === null || listedAt === undefined) return null;
    var a = Date.parse(asOf + 'T00:00:00Z');
    var b = Date.parse(listedAt + 'T00:00:00Z');
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.max(0, Math.floor((a - b) / 86400000));
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function median(values) {
    var sorted = values.slice().sort(function (x, y) { return x - y; });
    var mid = sorted.length >> 1;
    if (sorted.length % 2 === 1) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * The FDV/TVL multiple per category, read off the snapshot's own token-having
   * protocols: for each category with at least 3 protocols carrying both a market
   * cap and a TVL, the median of mcap_usd / tvl_usd; every other category falls
   * back to the global median over all such protocols. Clamped to [0.05, 1.5].
   */
  function categoryMultiples(protocols) {
    var byCategory = {};
    var all = [];
    for (var i = 0; i < protocols.length; i++) {
      var p = protocols[i];
      if (p.gecko_id === null || p.symbol === null) continue; // records a token
      if (typeof p.mcap_usd !== 'number' || typeof p.tvl_usd !== 'number') continue;
      if (!(p.mcap_usd > 0) || !(p.tvl_usd > 0)) continue;
      var ratio = p.mcap_usd / p.tvl_usd;
      if (!Number.isFinite(ratio)) continue;
      var key = p.category === null || p.category === undefined ? '(none)' : p.category;
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push(ratio);
      all.push(ratio);
    }
    var global = all.length > 0 ? clamp(median(all), 0.05, 1.5) : 0.2;
    var table = {};
    var counts = {};
    for (var cat in byCategory) {
      var ratios = byCategory[cat];
      counts[cat] = ratios.length;
      table[cat] = ratios.length >= 3 ? clamp(median(ratios), 0.05, 1.5) : global;
    }
    return { global: global, byCategory: table, counts: counts, priced: all.length };
  }

  /** The multiple one protocol's category earns: its category's median, else the global one. */
  function multipleFor(protocol, multiples) {
    var key = protocol.category === null || protocol.category === undefined ? '(none)' : protocol.category;
    var m = multiples.byCategory[key];
    return typeof m === 'number' ? m : multiples.global;
  }

  /**
   * One protocol's implied value and every factor behind it. Pure: the same
   * inputs always give the same answer, so two runs of main.ts agree byte for byte.
   */
  function impliedValue(protocol, asOf, multiples) {
    var age = ageDays(asOf, protocol.listed_at);
    var multiple = multipleFor(protocol, multiples);
    var change = typeof protocol.change_7d === 'number' && Number.isFinite(protocol.change_7d)
      ? protocol.change_7d
      : 0;
    var growth = 1 + 0.6 * (clamp(change, -40, 80) / 100);
    var years = age === null ? 0 : age / 365.25;
    var ageF = age === null ? 1 : 1 + 0.08 * Math.min(years, 5);
    var chains = Array.isArray(protocol.chains) ? protocol.chains.length : 0;
    var breadth = 1 + 0.015 * Math.min(Math.max(chains - 1, 0), 10);
    var implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growth * ageF * breadth));
    return {
      implied: implied,
      multiple: multiple,
      growth: growth,
      ageFactor: ageF,
      breadth: breadth,
      ageDays: age,
    };
  }

  // The watchlist rule, word for word from the snapshot's field guide, minus the
  // TVL floor: no token recorded, not a wrapped / staked / bridged product of a
  // token that trades, not a versioned pool, not an exchange's own product.
  var EXCLUDED_CATEGORIES = {
    'Bridge': true,
    'Canonical Bridge': true,
    'Liquid Staking': true,
    'Liquid Restaking': true,
    'Restaked BTC': true,
    'CEX': true,
  };
  var VERSIONED_NAME = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
  var WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
  var EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

  /** Whether a protocol is one the board may rank: pre-token and not an excluded product. */
  function isEligible(protocol) {
    if (protocol.gecko_id !== null || protocol.symbol !== null) return false;
    if (EXCLUDED_CATEGORIES[protocol.category]) return false;
    if (VERSIONED_NAME.test(protocol.name)) return false;
    if (WRAPPED_WORD.test(protocol.name)) return false;
    for (var i = 0; i < EXCHANGE_NAMES.length; i++) {
      if (protocol.name.indexOf(EXCHANGE_NAMES[i]) === 0) return false;
    }
    return true;
  }

  /** Whether a protocol records a token (its market value already trades). */
  function hasToken(protocol) {
    return protocol.gecko_id !== null || protocol.symbol !== null;
  }

  return {
    MODEL_VERSION: MODEL_VERSION,
    ageDays: ageDays,
    clamp: clamp,
    median: median,
    categoryMultiples: categoryMultiples,
    multipleFor: multipleFor,
    impliedValue: impliedValue,
    isEligible: isEligible,
    hasToken: hasToken,
  };
})();
