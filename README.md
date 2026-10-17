# Sanwo

Receivables financing with an open liquidity pool, launching first on Stellar.
A business submits an invoice its client owes, the pool advances most of it in
minutes, and the advance is repaid into the pool when the client pays.

This repo holds the marketing site and the testnet proof of concept. The
Soroban contracts live in [JoshdfG/sanwo](https://github.com/JoshdfG/sanwo).

## Try the full loop

Every step below is a real Stellar testnet transaction, and each one links to
it on [stellar.expert](https://stellar.expert/explorer/testnet).

1. **Connect.** Open `/app` and choose **Use a test wallet**. It creates a
   testnet keypair in the browser and funds it with Friendbot, so no extension
   is needed. Freighter works too, set to Testnet.
2. **Deposit.** On **Pool**, deposit some test XLM into the Capital Pool.
3. **Finance an invoice.** Choose **Finance an invoice**, then **Fill sample**,
   **Run verification**, **Review offer**, and accept. The receivable is
   registered and 75% of the invoice reaches your wallet in the same
   transaction.
4. **Repay.** On **Advances**, open the advance and choose **Repay advance**.
   The full advance moves from your wallet back into the pool.
5. **Withdraw.** On **Pool**, switch to **Withdraw** and take out up to what you
   deposited.

The guide in the bottom-right corner of the app ticks off these steps as you
go. **Activity** lists every contract event, and search (⌘K) finds any page,
advance or transaction.

## What the proof of concept does, exactly

- **Testnet only.** The pool holds native XLM as a stand-in for USDC, one token
  per dollar.
- **75% advances, no fee.** The advance rate is fixed by the contract. v1
  prices each invoice, up to 85%, with an origination fee.
- **Manual repayment.** The business repays the advance from its own wallet.
  Collection from the client to a controlled address per invoice is planned for
  v1 and is not live, so no one should pay the contracts directly.
- **Principal-only withdrawals.** Each depositor can withdraw up to their own
  principal, from liquidity not out in advances. There are no pool share tokens
  yet, so yield and losses are not shared pro rata.
- **Buyer not verified.** The client's Stellar address is recorded on-chain as
  the buyer but is not checked against anything.
- **Invoice details stay in the browser.** The chain stores the invoice
  fingerprint, amounts, parties and status. The invoice number, client name and
  dates live in the browser that submitted them. An advance made from another
  browser still appears, recovered from contract events, without those details.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page, with live pool figures read from the contract |
| `/app` | Home: pool balance and money in and out, accounts, advances, recent activity |
| `/app/advance` | Finance an invoice: details, automated checks, review, payout |
| `/app/advances` | Your advances, with a detail panel, timeline and repayment |
| `/app/pool` | Deposit or withdraw, and your position |
| `/app/activity` | Every pool and receivables event, with filters and CSV export |

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.example` points at the current testnet deployment:

| Contract | Address |
| --- | --- |
| Capital Pool | `CBFWEYF3B4CESQAS4RVKJLEU52EZLWPEJL4KVRTSUFI73DBI4RY3MV34` |
| Receivables | `CBYOWRE3PCTVA53DWVCRXNCGP5NCG4ZB62ZJ6S5ZYWKJGQIYKNRFVR2O` |

After a redeploy, update both IDs and `NEXT_PUBLIC_DEPLOY_LEDGER`, the first
ledger the app scans for events.

## How it talks to the chain

- `lib/contracts.ts` is the only module that knows the contract interface.
- `lib/stellar.ts` handles simulate, sign, submit and confirm, and maps contract
  error codes to readable messages.
- `lib/wallet.ts` puts Freighter and the test wallet behind one signer, so an
  embedded wallet can be added later without touching the flows. The test
  wallet's key is kept in localStorage, or in memory for the visit when storage
  is blocked.
- `lib/verify.ts` runs the automated checks before an advance. Every check uses
  live data. Signals the proof of concept cannot reach yet are shown as not
  connected.

Requires `@stellar/stellar-sdk` 17 or later. Testnet runs protocol 29, and older
SDKs fail to decode some of its responses.

## Limits of event history

Balances, the pool's running totals and each advance's status are read straight
from the contracts, so they are always complete. Activity, charts and recent
transactions come from contract events, and the public testnet RPC keeps only
about seven days of them. After a quiet week the activity lists are empty and
the charts show the live balance as a flat line. Run a fresh loop shortly before
sharing the demo. Reads page forward through at most 16 pages of 200 events; a
durable indexer replaces this in v1.

## Design and assets

- Landing sections declare `data-theme` (dark, beige, neutral). `ThemedPage`
  watches which one sits under the nav and cross-fades the page and nav
  colours. Elements with `.reveal` rise and fade in on scroll, only when motion
  is allowed.
- The hero video (`public/hero/`) is scrubbed by scroll and never plays on its
  own. It is stock footage, [Pexels video 9244099](https://www.pexels.com/video/a-laptop-on-the-table-9244099/),
  free to use under the Pexels licence, trimmed and encoded with a short
  keyframe interval so seeking stays smooth.
- The product tour shows real screenshots of the app in `public/product/`,
  taken at 1280×800 at 2× scale. Retake them after app changes.
- The logo is built from geometry in `scripts/logo-geometry.mjs`, which writes
  `design/logo/sanwo-mark*.svg`. `scripts/build-icons.mjs` turns it into
  `app/favicon.ico`, `app/icon.png` and `app/apple-icon.png`.
