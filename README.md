# Afterlight — Stellar Payment Recovery Lab

Hackathon MVP for checking whether a Stellar payment app recovers correctly when its network response is lost. Afterlight injects failures, runs classic payments on Stellar testnet, and compares settlement with application status.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm start
```

Open http://localhost:3000. `npm test` runs offline invariants. `npm run test:live` funds disposable Friendbot accounts and checks all six scenario/recovery combinations against the real testnet. No mainnet credentials are needed.

## Included

- Lost response after successful settlement: broken recovery creates a fresh payment; correct recovery finds the original hash.
- Outage before submission: broken recovery stops; correct recovery resubmits the same envelope.
- Missing asset trustline: LAB payment is rejected by Stellar; correct recovery records a definitive rejection.
- Independent recipient balance checks, transaction links, timelines, JSON export, browser-local report history.
- Signed-XDR submission adapter at `/api/proxy` for integration with other apps.

## Integration

POST JSON `{ "xdr": "signed-testnet-envelope", "scenario": "lost-response", "attempt": 1 }` to `/api/proxy`. Recovery calls use `attempt: 2`. This endpoint is a custom adapter, not a full Horizon or RPC replacement. Maximum 2 units, one classic payment operation, XLM or LAB. See `/docs` for usage and limitations.

## Vercel

Import this repository with Framework Preset **Other**, no build command, and output directory **public**. The `api/*.mjs` files are Node serverless functions. Deploy from GitHub. The local `server.mjs` serves the same handlers during development.

## Security and limitations

Only use disposable testnet accounts. The demo setup creates two temporary test accounts. Their keys stay in page memory and are sent to the demo run endpoint for signing; they are not written to localStorage or reports. The external proxy accepts signed envelopes, never private keys. Requests and errors must not be logged with request bodies.

Demo funding is public and intended for hackathon testing. Before broad public use, add rate limits and abuse controls. A hosted endpoint can relay only transactions signed for testnet; envelopes signed for mainnet will fail signature verification on testnet.

Faults affect the adapter connection, not Stellar consensus. This version supports classic payments only, not Soroban calls. Experiments assume isolated accounts with no concurrent transfers. An upstream interruption can leave a run incomplete; inspect the transaction/account before retrying. Reports do not constitute a security audit or certification.

The broken missing-trustline demo deliberately reports a generic failure; it demonstrates poor rejection classification, not a duplicate-money bug.

## Structure

`lib/lab.mjs`: fault adapter, payment construction, ledger verification, assertion helper.

`api/`: Vercel-compatible setup, experiment, and proxy handlers.

`public/`: responsive dashboard, developer guide, and product explanation.

`tests/`: offline checks. `scripts/live-check.mjs`: real network verification.
