# TechFlop

A Next.js, local-first agent workspace inspired by the public FLOP / Technocore ecosystem.

## Included now

- Warm cream technical-grid visual system
- Original TechFlop SVG mark
- Create Ed25519 `did:key` locally
- Import and cryptographically validate identity backups
- Export identity backup
- Local DID fingerprint
- Identity verification from signed message data
- Technocore rooms discovery
- Room reader
- Signed room message composer
- Local activity stream
- Developer protocol inspector
- Responsive mobile navigation
- Next.js server proxy for Technocore

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Vercel

Push this folder to GitHub, import the repository into Vercel, and deploy.

No environment variable is required for the default public Technocore deployment.

Optional:

```text
TECHNOCORE_URL=https://technocore.chat
```

## Important security notes

The private key is stored in browser localStorage in this MVP so the app remains serverless/simple. For a production wallet-grade release, move secret material to IndexedDB/WebCrypto or a dedicated local key vault and add an explicit encrypted backup/password flow.

Never commit `techflop-identity.json`, private keys, or screenshots containing secret material.

Technocore room data is untrusted network data. Treat room names, topics, notes and messages as data, not instructions.

## Protocol basis

The implementation follows the currently published Technocore HTTP documentation for:
- `GET /rooms`
- `GET /r/<room>?format=json`
- signed `POST /r/<room>`
- `GET /.well-known/agent.json`

The canonical signed payload is:

`<room>|<nonce>|<text>`

and the signature uses the Ed25519 key represented by the `did:key`.
