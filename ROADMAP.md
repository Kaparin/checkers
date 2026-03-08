# Checkers — Roadmap

## Current State (2026-03-08)

Project built and pushed to GitHub. Core + blockchain infrastructure complete:
- Full game engine: Russian checkers (primary) + American checkers (alternative)
- Online multiplayer via WebSocket with real-time moves
- Game lobby with auto-refresh, invite links
- Move timer with auto-forfeit on timeout
- ELO rating system (K=32 provisional, K=16 established)
- Leaderboard, game history pages
- 5 board themes, sound effects (Web Audio API)
- Draw offer/accept, resign, spectator mode
- Light minimalistic UI (Next.js 15 + Tailwind CSS 4)
- **Wallet auth**: challenge-response, HMAC stateless sessions, mnemonic wallet with AES-256-GCM encryption
- **Smart contract**: `checkers-vault` (CosmWasm 1.5, native AXM wagers, 14 tests passing)
- **Relayer + Indexer**: sequence manager, authz MsgExec, block polling, event sync

### Infrastructure Status
- **GitHub**: https://github.com/Kaparin/checkers.git
- **Neon DB**: Project `odd-cell-67095538`, schema pushed (users, games, game_moves, sessions)
- **Vercel**: https://checkers-web.vercel.app (needs env vars: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL)
- **Railway**: Deploying (fixing pnpm install via npx)

---

## Phase 1 — Minimal Production (no blockchain)

**Goal**: Playable online checkers with rating system, no wagers.

### TODO:
- [ ] Fix Railway deploy (npx pnpm approach, awaiting build result)
- [ ] Set Vercel env vars:
  - `NEXT_PUBLIC_API_URL` = Railway public URL (https)
  - `NEXT_PUBLIC_WS_URL` = Railway public URL (wss)
- [ ] Set Railway env vars:
  - `CORS_ORIGIN` = `https://checkers-web.vercel.app,http://localhost:3000`
- [ ] Verify end-to-end: create game -> join -> play -> finish -> ELO update
- [ ] Test Russian + American variants both work online

### Nice-to-haves for Phase 1:
- [ ] Simple auth without wallet (temporary — just address input or guest mode)
- [ ] Mobile responsive tweaks (board sizing on small screens)
- [ ] SEO meta tags, OG image for sharing

---

## Phase 2 — Blockchain Integration

### 2a. Wallet Auth ✅
- [x] "Connect Wallet" button in header + connect modal
- [x] Mnemonic import with AES-256-GCM encryption (PIN-based, PBKDF2)
- [x] Challenge-response: GET /auth/challenge → sign nonce → POST /auth/verify
- [x] HMAC stateless session tokens (no DB sessions needed)
- [x] Cookie + Bearer token fallback (iOS Safari compatibility)
- [x] WS passes `?token=` query param for authentication

### 2b. Game Smart Contract (CosmWasm) ✅
Contract: `contracts/checkers-vault/` (Rust, CosmWasm 1.5)

**Messages:**
- `CreateGame { variant, time_per_move }` — locks wager (native AXM)
- `JoinGame { game_id }` — locks opponent's wager
- `ResolveGame { game_id, winner }` — called by relayer, pays winner (2x minus 10%)
- `ResolveDraw { game_id }` — refund both players
- `CancelGame { game_id }` — refund creator (before opponent joins)
- `ClaimTimeout { game_id }` — safety net if relayer doesn't resolve

**Testing:** 14 tests passing (full lifecycle, auth, edge cases)

### 2c. Relayer Service ✅
- [x] SequenceManager with mutex (prevent nonce races)
- [x] MsgExec via x/authz (execute contract on behalf of users)
- [x] Mutex-based broadcast lock (serialized txs)
- [x] Retry logic with sequence refresh on mismatch

### 2d. Indexer ✅
- [x] Poll chain blocks (REST API, 3s interval, max 10 blocks/poll)
- [x] Extract wasm events for checkers contract
- [x] Sync game state with PostgreSQL
- [x] Terminal state protection (won't regress resolved games)
- [x] WebSocket broadcast on state changes

### 2e. Contract Deployment ✅
- [x] Deploy checkers-vault: Code ID 42, `axm1dy3rn9qhjak7tg9dfp3r0z0hutwng2rysq0mxf43twa983yfgxksfa9ywc`
- [x] Strip bulk memory ops (Rust 1.93+ emits memory.copy regardless of target-feature)
- [x] CHECKERS_CONTRACT env var set on Railway

### 2f. Relayer ↔ Routes Integration ✅
- [x] Game routes fire relayer calls in background (non-blocking)
- [x] on_chain_game_id mapping (UUID ↔ contract u64 counter)
- [x] Indexer matches games by on_chain_game_id with fallback to creator
- [x] GET /config endpoint (relayer address, contract, chain info)
- [x] GET /chain/balance/:address, /chain/authz/:address proxy routes

### 2g. Immersive Game Page ✅
- [x] Full-screen game page without site header
- [x] Player cards with integrated timers + avatars
- [x] VS divider, move history slide-over panel
- [x] Route groups: (main) with header, game without

### 2h. Authz + Feegrant Setup
- [x] Script template: `scripts/grant-authz.sh`
- [ ] Grant `ContractExecutionAuthorization` to relayer for checkers contract
- [ ] `AcceptedMessageKeysFilter` scoped to: create_game, join_game, cancel_game, claim_timeout
- [ ] NEVER use `GenericAuthorization` on `MsgExecuteContract`
- [ ] Frontend authz grant flow (user signs MsgGrant from wallet)
- [ ] Feegrant from treasury to users for gas sponsorship

---

## Phase 3 — Token SHASHKA

**Token**: CW20 "SHASHKA" (ticker: SHASHKA, decimals: 6)

### 3a. CW20 Token Contract
- [ ] Deploy standard `cw20-base` contract
- [ ] Initial supply: TBD
- [ ] Minter: admin/treasury

### 3b. Presale Contract
- [ ] AXM -> SHASHKA swap contract (same pattern as coinflip presale)
- [ ] Configurable rate, min/max purchase

### 3c. Switch Game Contract to CW20
- [ ] Update game contract to accept CW20 `Send` with `Cw20ReceiveMsg`
- [ ] Or deploy new contract version (Code ID bump)
- [ ] Update relayer to use CW20 transfer instead of native send

### 3d. Contract Addresses (to be filled)
- **SHASHKA CW20**: `axm...` (TBD)
- **Checkers Game Contract (native AXM)**: `axm...` (TBD)
- **Checkers Game Contract (CW20 SHASHKA)**: `axm...` (TBD)
- **Presale Contract**: `axm...` (TBD)

---

## Phase 4 — Social & Economy Features

### Referral System
Copy from coinflip:
- [ ] Referral codes table, BPS rewards per game
- [ ] Referral balance + withdrawal
- [ ] Max 500 BPS (5%) per bet
- [ ] UI: referral link sharing, referral stats page

### Staking
- [ ] SHASHKA staking contract (Synthetix-style rewards)
- [ ] 2% of each game's commission goes to staking pool
- [ ] Staking UI page

### Shop & VIP
- [ ] Board themes purchasable with SHASHKA
- [ ] VIP subscription (premium features)
- [ ] Custom piece skins

### Jackpot System
- [ ] Progressive jackpot from game commissions
- [ ] Random trigger on game completion
- [ ] Multiple tiers

### Social
- [ ] In-game chat (text messages during game)
- [ ] Player profiles with avatar, stats, game history
- [ ] Friends list
- [ ] Telegram bot notifications

---

## Phase 5 — Polish & Scale

- [ ] Mobile optimization (touch drag-and-drop for pieces)
- [ ] PWA: offline local games, install prompt
- [ ] Game replay viewer (step through any completed game)
- [ ] Admin dashboard (active games, revenue, user stats)
- [ ] Commission tracking / treasury ledger
- [ ] Tournaments (bracket system)
- [ ] AI opponent (for solo practice)
- [ ] Internationalization (RU/EN)

---

## Tech Stack Reference

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | Next.js 15, React 19, Tailwind CSS 4   |
| Backend    | Hono (Node.js 22), WebSocket (ws)      |
| Database   | PostgreSQL (Neon), Drizzle ORM          |
| Blockchain | Axiome Chain (Cosmos SDK), CosmWasm 1.4 |
| Token      | CW20 SHASHKA (future)                  |
| Hosting    | Vercel (web), Railway (API), Neon (DB)  |
| Monorepo   | pnpm workspaces + Turborepo            |

## Key Files

- Game engines: `packages/shared/src/game/`
  - `engine.ts` — American checkers + types + serialization
  - `russian-engine.ts` — Russian checkers
  - `variants.ts` — unified dispatch layer
  - `common.ts` — shared utilities
- API routes: `apps/api/src/routes/games.ts`
- WebSocket: `apps/api/src/ws/handler.ts`
- Board UI: `apps/web/src/components/board/checkers-board.tsx`
- Game page: `apps/web/src/app/game/[id]/page.tsx`
- DB schema: `packages/db/src/schema/`
