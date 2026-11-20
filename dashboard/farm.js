// Farm plans for the token radar (radar-catmedian-1).
//
// A plain script, no modules and no network, so the dashboard page loads it as a
// classic script and main.ts loads the same file for board.json. One implementation,
// one answer: the steps the page shows for a protocol are byte for byte the steps
// board.json carries for it.
//
// Every plan has six steps, each an action plus what it costs and how long it
// takes. Steps 2 and 3 follow the protocol's own category (its archetype); the
// rest are the same discipline for every farm, filled in with the protocol's own
// name, home chain, capital size and qualifying window. Nothing here names a
// protocol from a hand-kept list: the archetype comes from the snapshot's category
// field, the capital from its TVL, the hold from its age, the gas from its chain.

var RadarFarm = (function () {
  'use strict';

  /** The chain the protocol names first, or a neutral phrase. */
  function homeChain(protocol) {
    if (Array.isArray(protocol.chains) && protocol.chains.length > 0) return protocol.chains[0];
    return 'its main chain';
  }

  /** How much capital one farm position needs, from the protocol's own TVL. */
  function capitalFor(protocol) {
    if (protocol.tvl_usd >= 1000000000) return 250;
    if (protocol.tvl_usd >= 100000000) return 150;
    return 75;
  }

  /** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
  function holdDaysFor(ageDays) {
    if (ageDays === null || ageDays === undefined) return 45;
    if (ageDays < 180) return 60;
    if (ageDays < 365) return 45;
    return 30;
  }

  /** Gas wording from the home chain: mainnet costs real money, L2s and alt-L1s do not. */
  function gasFor(chain) {
    if (chain === 'Ethereum') return '$4-$12 of gas per transaction on Ethereum mainnet';
    return '$0.50-$2 of gas per transaction';
  }

  /** The farming archetype: the snapshot's category, grouped by what a farmer actually does. */
  function archetypeFor(protocol) {
    var c = (protocol.category || '').toLowerCase();
    if (c.indexOf('dex') !== -1 || c.indexOf('liquidity manager') !== -1 || c === 'farm' || c.indexOf('leveraged farm') !== -1) return 'swap';
    if (c.indexOf('lend') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1) return 'lend';
    if (c.indexOf('yield') !== -1 || c.indexOf('basis trading') !== -1 || c.indexOf('interest rate') !== -1 || c.indexOf('restaking') !== -1 || c.indexOf('staking pool') !== -1) return 'yield';
    if (c.indexOf('rwa') !== -1 || c.indexOf('capital allocator') !== -1 || c.indexOf('stablecoin wrapper') !== -1 || c.indexOf('stablecoin') !== -1 || c.indexOf('cedefi') !== -1 || c.indexOf('anchor btc') !== -1 || c.indexOf('decentralized btc') !== -1) return 'rwa';
    if (c.indexOf('risk curator') !== -1 || c.indexOf('insurance') !== -1) return 'risk';
    if (c.indexOf('derivative') !== -1 || c.indexOf('options vault') !== -1 || c.indexOf('prediction') !== -1) return 'deriv';
    if (c === 'chain' || c.indexOf('payment') !== -1 || c.indexOf('indexes') !== -1 || c.indexOf('governance') !== -1 || c.indexOf('otc') !== -1 || c.indexOf('card issuer') !== -1 || c.indexOf('privacy') !== -1) return 'chain';
    return 'default';
  }

  // The core action (step 2) and the weekly action (step 3) per archetype.
  var CORE = {
    swap: function (p, capital, chain) {
      return 'Provide $' + capital + ' of liquidity to ' + p.name + '\u2019s largest pool on ' + chain + ', in the pair the protocol itself highlights, and keep the LP position open.';
    },
    lend: function (p, capital, chain) {
      return 'Supply $' + capital + ' of USDC to ' + p.name + ' on ' + chain + ', then borrow a small amount against it and repay it the same week to register both sides of the market.';
    },
    yield: function (p, capital, chain) {
      return 'Deposit $' + capital + ' into ' + p.name + '\u2019s highest-yield vault on ' + chain + ' and leave the receipt token in the wallet so the deposit stays visible on-chain.';
    },
    rwa: function (p, capital, chain) {
      return 'Mint $' + capital + ' of ' + p.name + '\u2019s yield-bearing asset on ' + chain + ' with USDC and hold it in the farming wallet for the full qualifying window.';
    },
    risk: function (p, capital, chain) {
      return 'Deposit $' + capital + ' into a ' + p.name + ' curator vault on ' + chain + ' and hold the vault shares; curator vaults are where the protocol\u2019s own points accrue.';
    },
    deriv: function (p, capital, chain) {
      return 'Deposit $' + capital + ' of USDC as margin on ' + p.name + ' on ' + chain + ', open one small hedged position, and close it the same week to register trading volume.';
    },
    chain: function (p, capital, chain) {
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' and use it inside ' + p.name + '\u2019s own app \u2014 a swap, a stake or a vote \u2014 so the activity is on the protocol\u2019s home chain.';
    },
    'default': function (p, capital, chain) {
      return 'Deposit $' + capital + ' of USDC into ' + p.name + ' on ' + chain + ' through its official app and keep the position open for the qualifying window.';
    },
  };

  var WEEKLY = {
    swap: function (p) {
      return 'Swap about $10 of volume through ' + p.name + ' every week so the wallet keeps showing up as an active trader, not a one-time depositor.';
    },
    lend: function (p) {
      return 'Touch the position once a week: add $10 of collateral or repay a little of the borrow, so the wallet shows ongoing use of the market.';
    },
    yield: function (p) {
      return 'Claim or compound the vault\u2019s yield once a week, even a small amount, so the wallet records repeated interaction with the vault.';
    },
    rwa: function (p) {
      return 'Top up the position by $10 once a week, or re-mint after a redemption, so the wallet shows a growing balance rather than a single mint.';
    },
    risk: function (p) {
      return 'Review the vault\u2019s allocation once a week and move $10 between vaults when the curator rebalances, so the wallet tracks the curator\u2019s activity.';
    },
    deriv: function (p) {
      return 'Place one small trade a week \u2014 about $10 of volume \u2014 and close it the same day, so the wallet builds a steady trading history.';
    },
    chain: function (p, chain) {
      return 'Make one transaction inside ' + p.name + ' every week on ' + chain + ' \u2014 a swap, a stake or a vote \u2014 so the wallet stays active on the protocol\u2019s home chain.';
    },
    'default': function () {
      return 'Make one qualifying action each week \u2014 a deposit, a swap or a vote \u2014 so the wallet shows steady activity instead of a single burst.';
    },
  };

  /** One step as a single string: the action, then its cost and its time. */
  function stepText(text, cost, time) {
    var s = text + ' Cost: ' + cost + '. Time: ' + time + '.';
    if (s.length > 600) s = s.slice(0, 597) + '...';
    if (s.length < 20) s = s + ' Keep the record and check the protocol\u2019s own page.';
    return s;
  }

  /**
   * A protocol's farm plan: six steps, derived from its own record (category,
   * chains, TVL, age) and nothing else. `ageDays` is the protocol's age in days
   * since DefiLlama began tracking it, or null when unrecorded.
   */
  function farmSteps(protocol, ageDays) {
    var chain = homeChain(protocol);
    var capital = capitalFor(protocol);
    var hold = holdDaysFor(ageDays);
    var gas = gasFor(chain);
    var arch = archetypeFor(protocol);
    return [
      stepText(
        'Set up a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline \u2014 never reuse a wallet that holds your main funds.',
        'under $3 of gas for the first transaction',
        '5 minutes'
      ),
      stepText(
        CORE[arch](protocol, capital, chain),
        '$' + capital + ' of capital plus ' + gas + ' for the deposit',
        '15 minutes to set up'
      ),
      stepText(
        WEEKLY[arch](protocol, chain),
        'about $2 of gas a week',
        '10 minutes a week'
      ),
      stepText(
        'Keep the position open for at least ' + hold + ' days so the activity lands in more than one snapshot window; withdrawing early can void the whole period.',
        'the $' + capital + ' stays in the position',
        hold + ' days'
      ),
      stepText(
        'Check ' + protocol.name + '\u2019s own points or rewards page weekly, and claim only through links the protocol itself publishes \u2014 never pay a fee to claim, and never connect from a link in a DM.',
        'nothing to check; claiming costs gas only',
        '10 minutes a week'
      ),
      stepText(
        'Write the wallet address, the dates and every transaction hash in a farm log, and plan your exit before any token launches so you can unwind in one session.',
        'nothing but the log',
        '5 minutes'
      ),
    ];
  }

  return {
    homeChain: homeChain,
    capitalFor: capitalFor,
    holdDaysFor: holdDaysFor,
    gasFor: gasFor,
    archetypeFor: archetypeFor,
    farmSteps: farmSteps,
  };
})();
