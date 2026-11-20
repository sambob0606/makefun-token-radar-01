# Token Radar

The pre-token protocol board for make.fun's **token-radar-01** bounty: every
protocol DefiLlama tracks that records no token yet, ranked by what its launch
would be worth, with the concrete steps to farm each one.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot at
`/input/snapshot.json`, scores every eligible protocol, and writes:

- `/output/board.json` — the ranked board (198 rows: the snapshot's 40-protocol
  watchlist plus 158 early protocols below the floor)
- `/output/data.js` — the dashboard's dataset
- `/output/dashboard/` — the static page (no network, no framework)
- `/output/screenshots/` — the board, a detail view and a filtered view
- `/output/dossier.json` — built with `vendor/makefun-board.ts`

## The model (radar-catmedian-1)

```
implied = TVL × multiple × growth × age × breadth
```

- **multiple** — the category's own FDV/TVL: the median market-cap-to-TVL of
  the snapshot's token-having protocols in the same category (≥3 with a market
  cap), else the global median (0.2138 over 128 priced protocols). Clamped to
  [0.05, 1.5]. No protocol name is ever special-cased.
- **growth** — `1 + 0.6 × clamp(change_7d, -40, +80) / 100`; no 7-day change on
  record counts as flat.
- **age** — `1 + 0.08 × min(years since listed_at, 5)`; longer tracked with no
  token recorded earns a patience premium of up to 40%.
- **breadth** — `1 + 0.015 × min(chains - 1, 10)`; more chains, more farmers.

Eligibility is the snapshot's own watchlist rule with the floor removed: no
token recorded (`gecko_id` and `symbol` both null), and not a wrapped, staked or
bridged product of a token that already trades, not a versioned pool, not an
exchange's own product. The model lives in `dashboard/model.js` and the farm
plans in `dashboard/farm.js` — one implementation each, shared by `main.ts` and
the page, so the board, the page and the screenshots can never drift apart.

## Farm plans

Six steps per protocol, generated from its own record (category archetype,
home chain, TVL-sized capital, age-sized hold): a fresh wallet, the core
position, a weekly action, the hold window, claiming only from the protocol's
own links, and a farm log. Each step states what it costs and how long it takes.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

## Disclaimer

"Records no token" is not proof a protocol has none, and nothing here predicts
whether or when a token launches. An implied value is this entry's own claim.
