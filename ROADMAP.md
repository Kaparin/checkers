# Checkers on Wagers — Full Project Documentation & Roadmap

> Last updated: 2026-03-08

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [What's Built (Completed)](#4-whats-built-completed)
5. [What's Needed (Remaining Work)](#5-whats-needed-remaining-work)
6. [Phase Breakdown](#6-phase-breakdown)
7. [Database Schema Plan](#7-database-schema-plan)
8. [Admin Panel Blueprint](#8-admin-panel-blueprint)
9. [Key Files Reference](#9-key-files-reference)
10. [Infrastructure](#10-infrastructure)
11. [Contract Addresses](#11-contract-addresses)

---

## 1. Project Overview

PvP Checkers dApp on Axiome Chain. Two players wager native AXM on a checkers game. Winner gets 2× stake minus 10% commission. "1-click" UX via Cosmos x/authz delegation + gas faucet. Supports Russian checkers (flying kings, backward captures) and American checkers (standard English rules).

**Target**: Feature parity with the Coinflip project — full admin panel, treasury management, referrals, jackpot, VIP, shop, events, diagnostics, and social features.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, App Router |
| Backend | Hono (Node.js 22), WebSocket (ws) |
| Database | PostgreSQL (Neon), Drizzle ORM |
| Blockchain | Axiome Chain (Cosmos SDK), CosmWasm 1.5 |
| Token | Native AXM (wagers), CHECKER (virtual, cosmetics/features) |
| Hosting | Vercel (web), Railway (API), Neon (DB) |
| Monorepo | pnpm workspaces + Turborepo |

---

## 3. Architecture

### Data Flow

```
User → Frontend (Next.js) → API (Hono) → Relayer (MsgExec via CosmJS) → Axiome Chain
                                        ← Indexer (polls blocks) ← Chain events
                                        → PostgreSQL (Drizzle) → fast reads
                                        → WebSocket broadcast → Frontend
```

### Key Patterns

1. **Async 202**: API returns immediately, relayer broadcasts in background, indexer confirms on-chain, WS notifies frontend
2. **Relayer + authz**: Single relayer key submits MsgExec on behalf of users. Mutex-based broadcast queue prevents nonce races
3. **Chain as source of truth**: DB is for performance/pagination. Contract state is authoritative
4. **Optimistic UI**: React state → pending updates → WS confirmation → cache invalidation
5. **HMAC sessions**: Stateless auth tokens (no DB sessions table needed)

### Monorepo Layout

```
checkers/
├── apps/
│   ├── api/                 # Hono backend (Railway)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── middleware/auth.ts
│   │   │   ├── routes/      # auth, games, users, chain
│   │   │   ├── services/    # relayer, indexer, sequence-manager, session, timeout-checker
│   │   │   └── ws/handler.ts
│   └── web/                 # Next.js 15 (Vercel)
│       ├── src/
│       │   ├── app/         # (main)/page, game/[id], history, leaderboard
│       │   ├── components/  # board/, layout/, ui/
│       │   ├── contexts/    # wallet-context
│       │   ├── hooks/       # use-websocket, use-web-wallet, use-board-theme
│       │   └── lib/         # api, auth-headers, chain-actions, chain-tx, sounds, wallet
├── contracts/
│   └── checkers-vault/      # CosmWasm 1.5 (Rust)
├── packages/
│   ├── db/                  # Drizzle ORM + PostgreSQL schema
│   ├── shared/              # Zod schemas, types, game engines, constants
│   └── tsconfig/            # Shared TS configs
├── scripts/                 # Deploy, authz grants
└── ROADMAP.md               # This file
```

---

## 4. What's Built (Completed)

### 4.1. Game Engine ✅

| Feature | Status | Details |
|---|---|---|
| American checkers | ✅ | Standard 8×8, men move forward, kings all directions, single captures |
| Russian checkers | ✅ | Flying kings, backward captures for men, multi-jump chains, mid-chain promotion |
| Unified variant dispatch | ✅ | `variants.ts` dispatches to correct engine by variant string |
| Move validation | ✅ | `getValidMoves()`, `getValidMovesForPiece()`, `isValidMove()`, `applyMove()` |
| Mandatory captures | ✅ | Both variants enforce mandatory capture rules |
| Game state serialization | ✅ | Board + metadata serialized to JSON for DB storage |
| ELO rating system | ✅ | K=32 provisional (<30 games), K=16 established |
| Board themes | ✅ | Wood, marble, dark, neon — via `use-board-theme` hook |
| Sound effects | ✅ | Move, capture, king promotion, game over — Web Audio API |

### 4.2. Online Multiplayer ✅

| Feature | Status | Details |
|---|---|---|
| Game lobby | ✅ | List open/active games, create new, join existing |
| Real-time moves | ✅ | WebSocket with exponential backoff reconnect |
| Move timer | ✅ | Configurable per-move timeout, auto-forfeit on timeout |
| Timeout checker | ✅ | Background service checks every 5s, resolves timed-out games |
| Draw offer/accept | ✅ | API routes + WS events for draw flow |
| Resign | ✅ | API route + game over handling |
| Local mode | ✅ | Play offline against yourself (testing) |
| Invite links | ✅ | Backend support for game sharing |

### 4.3. Wallet Authentication ✅

| Feature | Status | Details |
|---|---|---|
| Connect wallet modal | ✅ | Mnemonic import with AES-256-GCM encryption (PIN-based, PBKDF2) |
| Challenge-response auth | ✅ | GET /auth/challenge → sign nonce → POST /auth/verify |
| HMAC stateless sessions | ✅ | No DB sessions table, 24h expiry |
| Cookie + Bearer fallback | ✅ | iOS Safari compatibility via sessionStorage |
| WS auth | ✅ | `?token=` query param for WebSocket connections |

### 4.4. Smart Contract (CosmWasm) ✅

| Feature | Status | Details |
|---|---|---|
| Contract code | ✅ | `contracts/checkers-vault/` — Rust, CosmWasm 1.5, 14 tests passing |
| Deployed | ✅ | Code ID 42, address below |
| CreateGame | ✅ | Lock native AXM wager, emit create_game event |
| JoinGame | ✅ | Lock opponent wager, set game Active |
| ResolveGame | ✅ | Pay winner (2× minus 10% commission to treasury) |
| ResolveDraw | ✅ | Refund both players |
| CancelGame | ✅ | Refund creator (only before opponent joins) |
| ClaimTimeout | ✅ | Safety net if relayer doesn't resolve |
| Admin controls | ✅ | UpdateConfig, TransferAdmin |
| Bulk memory fix | ✅ | strip-bulk-memory.js for Rust 1.93+ WASM compatibility |

### 4.5. Relayer Service ✅

| Feature | Status | Details |
|---|---|---|
| MsgExec via x/authz | ✅ | Execute contract on behalf of users |
| Sequence manager | ✅ | Mutex-based nonce tracking, auto-refresh on mismatch |
| Retry logic | ✅ | 3 retries, reconnect on ECONNRESET |
| Gas faucet | ✅ | `sendGas()` — 0.1 AXM to new users for authz grant |
| on_chain_game_id parsing | ✅ | Extract game_id from wasm events |
| Fire-and-forget pattern | ✅ | Non-blocking background relayer calls in game routes |

### 4.6. Indexer ✅

| Feature | Status | Details |
|---|---|---|
| Block polling | ✅ | REST API, 3s interval, max 10 blocks/poll |
| Event parsing | ✅ | create_game, join_game, resolve_game, cancel_game, claim_timeout |
| DB sync | ✅ | Updates games table, stores tx hashes |
| Terminal state protection | ✅ | Won't regress resolved games |
| WS broadcast | ✅ | Notifies connected clients of state changes |
| UUID↔u64 mapping | ✅ | on_chain_game_id column + fallback matching by creator |

### 4.7. Frontend Pages ✅

| Page | Route | Status | Details |
|---|---|---|---|
| Lobby | `(main)/page.tsx` | ✅ | Game list, create game, join game, WalletSetup |
| Game | `game/[id]/page.tsx` | ✅ | Full-screen immersive, no header, player cards + timers, VS divider, move history panel |
| Leaderboard | `(main)/leaderboard` | ✅ | Top 50 by ELO |
| History | `(main)/history` | ✅ | User's completed games |
| Layout | `(main)/layout.tsx` | ✅ | Header + padding for lobby pages |
| Root layout | `layout.tsx` | ✅ | Providers only (no header) — enables headerless game page |

### 4.8. Authz Flow ✅

| Feature | Status | Details |
|---|---|---|
| Frontend signing | ✅ | `chain-tx.ts` — offline sign + broadcast_tx_sync via RPC proxy |
| WalletSetup component | ✅ | Single "Authorize for Wagering" button |
| Gas faucet integration | ✅ | Auto-funds gas if balance < 50000 uaxm |
| Authz check | ✅ | `/chain/authz/:address` proxy route |
| Chain proxy routes | ✅ | `/chain/balance`, `/chain/authz`, `/chain/fund-gas` |
| Next.js RPC/REST rewrites | ✅ | `/chain-rpc/*`, `/chain-rest/*` — avoids CORS |

### 4.9. Current Database (4 tables)

| Table | Columns |
|---|---|
| `users` | address, username, avatarUrl, gamesPlayed/Won/Lost/Draw, totalWagered/Won, elo, isOnline, lastSeen |
| `games` | id (UUID), blackPlayer, whitePlayer, winner, status, variant, wager, timePerMove, gameState (JSONB), moveCount, currentTurnDeadline, onChainGameId, txHash*, timestamps |
| `game_moves` | id, gameId, moveNumber, player, from/to row/col, captures (JSONB), promotion |
| `sessions` | id, address, token, expiresAt |

---

## 5. What's Needed (Remaining Work)

Based on coinflip feature parity analysis. Coinflip has **28 DB tables**, **30 services**, **15 admin tabs**, and full economy/social features. Below is everything needed.

### 5.1. Infrastructure & Deployment

| Task | Priority | Details |
|---|---|---|
| Fix Railway deploy | 🔴 Critical | pnpm install via npx approach, verify build succeeds |
| Set Vercel env vars | 🔴 Critical | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL pointing to Railway |
| Set Railway env vars | 🔴 Critical | CORS_ORIGIN, DATABASE_URL, RELAYER_MNEMONIC, CHECKERS_CONTRACT, etc |
| E2E test full flow | 🔴 Critical | Create → join → play → finish → ELO update → on-chain resolution |
| Feegrant setup | 🟡 Medium | Treasury → users gas sponsorship (eliminates need for gas faucet) |

### 5.2. Treasury & Economy System

| Feature | Priority | Coinflip Reference | Details |
|---|---|---|---|
| Treasury service | 🔴 Critical | `treasury.service.ts` | Balance queries, commission ledger, withdraw from vault |
| Treasury sweep | 🔴 Critical | `treasury-sweep.service.ts` | Batch collect offchain_spent from user vaults |
| Vault balances | 🔴 Critical | `vault_balances` table | Per-user: available, locked, bonus, offchainSpent |
| Commission tracking | 🔴 Critical | `treasury_ledger` table | Every commission entry: txHash, amount, source |
| Vault transactions | 🟡 Medium | `vault_transactions` table | Deposit/withdraw history per user |
| Platform config KV | 🔴 Critical | `platform_config` table | All settings (min wager, commission%, timeouts, maintenance) — no hardcodes |

### 5.3. Admin Panel (15 tabs)

| Tab | Priority | Coinflip Reference | What It Does |
|---|---|---|---|
| Dashboard | 🔴 Critical | Stats overview | Treasury balance, total games/volume/users, 24h/7d metrics, economy snapshot |
| Users | 🔴 Critical | User management | List, search, detail view, balance credit/debit with reason log |
| Games | 🔴 Critical | Bet management | All games with status filter, stuck games (>5m in transitional state), orphaned games |
| Config | 🔴 Critical | Platform settings | Edit all settings: min/max wager, commission%, timeouts, maintenance mode |
| Transactions | 🟡 Medium | Relayer tx logs | Filter by action/status, explore on-chain details |
| Diagnostics | 🔴 Critical | System health | Game status distribution, vault integrity, stuck funds detection |
| Actions | 🔴 Critical | Manual repairs | Force cancel, unlock funds, import orphans, heal system (1-click recovery) |
| Commission | 🟡 Medium | Commission breakdown | By source (game, referral, jackpot), partner management |
| Announcements | 🟡 Medium | Broadcasts | Send to all users, manage sponsored announcements |
| News | 🟢 Low | Content CRUD | i18n posts (EN/RU) |
| Events | 🟡 Medium | Contests & raffles | Create/manage, calculate results, distribute prizes |
| Jackpot | 🟡 Medium | Progressive jackpot | Tier config, current pools, force draw, reset |
| VIP | 🟡 Medium | Subscriptions | Tier config, subscriber list, grant/revoke |
| Shop | 🟡 Medium | Chest bundles | Tier pricing, purchase history, enable/disable |
| Staking | 🟡 Medium | 2% contributions | Pending balance, flush to chain, stats |

### 5.4. Referral System

| Feature | Priority | Coinflip Reference |
|---|---|---|
| Referral codes table | 🟡 Medium | `referral_codes` — unique per user |
| Referrals tracking | 🟡 Medium | `referrals` — who invited whom |
| L1/L2/L3 rewards | 🟡 Medium | `referral_rewards` — configurable BPS per level |
| Referral balances | 🟡 Medium | `referral_balances` — per-user total earned |
| Referral service | 🟡 Medium | Code generation, tracking, reward distribution |
| Referral UI | 🟡 Medium | Link sharing, stats page, earnings dashboard |
| Max cap | 🟡 Medium | 500 BPS (5%) per game |

### 5.5. Jackpot System

| Feature | Priority | Coinflip Reference |
|---|---|---|
| Jackpot tiers | 🟡 Medium | 5 tiers: mini/medium/large/mega/super_mega |
| Jackpot pools | 🟡 Medium | Active pool per tier: cycle, currentAmount, status |
| Contributions | 🟡 Medium | Per-game contribution from commission (idempotent) |
| Draw logic | 🟡 Medium | Trigger when target reached, random winner selection |
| Admin controls | 🟡 Medium | Force draw, reset pool, enable/disable tiers |
| Jackpot UI | 🟡 Medium | Current pools display, winner announcements |

### 5.6. VIP System

| Feature | Priority | Coinflip Reference |
|---|---|---|
| VIP tiers | 🟡 Medium | Silver/Gold/Diamond with pricing |
| Subscriptions | 🟡 Medium | Monthly/yearly, auto-expire |
| VIP cosmetics | 🟡 Medium | Name gradient, frame style, badge icon |
| VIP perks | 🟡 Medium | Custom board themes, piece skins, priority matching |
| Admin management | 🟡 Medium | Grant/revoke, tier config, pricing |

### 5.7. Shop System

| Feature | Priority | Coinflip Reference |
|---|---|---|
| Shop page | 🟡 Medium | Chest bundles with CHECKER rewards |
| Chest tiers | 🟡 Medium | Configurable pricing (AXM → CHECKER conversion + bonus) |
| Purchase flow | 🟡 Medium | Pay AXM → credit CHECKER to vault balance |
| Admin config | 🟡 Medium | Tier pricing, enable/disable, purchase history |
| Board themes shop | 🟢 Low | Purchase premium themes with CHECKER/AXM |
| Piece skins shop | 🟢 Low | Custom piece designs |

### 5.8. Social Features

| Feature | Priority | Coinflip Reference |
|---|---|---|
| In-game chat | 🟡 Medium | `bet_messages` — text during game |
| Global chat | 🟡 Medium | `global_chat_messages` — lobby chat with styles/effects |
| Player profiles | 🟡 Medium | Avatar, stats, game history, bio |
| Profile reactions | 🟢 Low | `profile_reactions` — emoji reactions |
| P2P CHECKER transfers | 🟢 Low | `coin_transfers` — send CHECKER with fee |
| Achievements | 🟢 Low | `achievement_claims` — earn CHECKER for milestones |
| Friends list | 🟢 Low | Follow/friend system |

### 5.9. Events & Tournaments

| Feature | Priority | Coinflip Reference |
|---|---|---|
| Contests | 🟡 Medium | By metric (most wins, highest streak, etc) |
| Raffles | 🟡 Medium | Random draw from participants |
| Sponsored events | 🟢 Low | User-created with admin approval |
| Prize distribution | 🟡 Medium | Automatic CHECKER/AXM payout to winners |
| Tournament brackets | 🟢 Low | Elimination-style tournaments (new for checkers) |

### 5.10. Staking Integration (LAUNCH)

| Feature | Priority | Coinflip Reference |
|---|---|---|
| Staking ledger | 🟡 Medium | `staking_ledger` — per-game 2% contributions from commission |
| Batch flush | 🟡 Medium | Distribute pending to LAUNCH stakers |
| Staking UI | 🟡 Medium | Rewards display (reuse existing LAUNCH staking contract) |

### 5.12. UX Polish

| Feature | Priority | Details |
|---|---|---|
| Mobile touch drag-and-drop | 🔴 Critical | Touch-friendly piece movement on small screens |
| Responsive board sizing | 🔴 Critical | Board fits any screen without scrolling |
| Spectator mode | 🟡 Medium | Watch live games without playing |
| Game replay | 🟡 Medium | Step through any completed game move-by-move |
| Rematch button | 🟡 Medium | Quick rematch after game over |
| Algebraic notation | 🟡 Medium | Move history in standard notation |
| PWA | 🟢 Low | Install prompt, offline local games |
| Telegram bot | 🟢 Low | Notifications, game invites |
| i18n (RU/EN) | 🟡 Medium | Full translation support |
| SEO meta tags | 🟢 Low | OG images, descriptions for sharing |
| Loading skeletons | 🟡 Medium | Skeleton states instead of spinners |

### 5.13. Background Tasks (cron)

| Task | Coinflip Reference | Details |
|---|---|---|
| Timeout checker | ✅ Already built | 5s interval, auto-forfeit |
| Treasury sweep | 🔴 Needed | Batch collect offchain_spent |
| Staking flush | 🟡 Needed | Distribute pending to stakers |
| Jackpot draw check | 🟡 Needed | Auto-trigger when pool target reached |
| VIP expiry check | 🟡 Needed | Expire subscriptions past their date |
| Stuck game recovery | 🔴 Needed | Detect + resolve games stuck in transitional state |

### 5.14. Audit & Logging

| Feature | Coinflip Reference | Details |
|---|---|---|
| tx_events table | 🔴 Needed | User action log (create, join, resolve, deposit, withdraw) |
| relayer_transactions table | 🔴 Needed | All relayer broadcasts: hash, status, duration, attempts |
| Structured logging (pino) | 🟡 Needed | Replace console.log with pino in production |

---

## 6. Phase Breakdown

### Phase 1 — Production Launch 🔴
**Goal**: Playable online checkers with wagers, deployed and working.

- [ ] Fix Railway deploy
- [ ] Set Vercel + Railway env vars
- [ ] E2E test: create → join → play → finish → ELO + on-chain resolution
- [ ] Mobile responsive board
- [ ] Touch drag-and-drop for pieces
- [ ] Loading skeletons
- [ ] Error boundaries + graceful error handling
- [ ] Feegrant setup (eliminate gas faucet dependency)

### Phase 2 — Economy & Admin 🔴
**Goal**: Treasury, commissions, admin panel, platform config.

- [ ] `platform_config` KV table + config.service.ts
- [ ] `vault_balances` table — per-user available/locked/bonus/offchainSpent
- [ ] `treasury_ledger` table — commission entries
- [ ] `vault_transactions` table — deposit/withdraw history
- [ ] `tx_events` table — user action log
- [ ] `relayer_transactions` table — relayer broadcast audit
- [ ] Treasury service (balance, ledger, withdraw)
- [ ] Treasury sweep service (batch offchain_spent collection)
- [ ] Admin route (`/admin`) with auth (ADMIN_SECRET)
- [ ] Admin tabs: Dashboard, Users, Games, Config, Diagnostics, Actions, Transactions
- [ ] Vault balance management (credit/debit with reason)
- [ ] System healing (1-click: fix stuck games, unlock funds, import orphans)
- [ ] Stuck game detection (transitional state > 5 minutes)
- [ ] Background tasks: sweep, stuck recovery

### Phase 3 — Referrals & Monetization 🟡
**Goal**: Referral program, jackpot, commission breakdown.

- [ ] Referral tables: codes, referrals, rewards, balances
- [ ] Referral service — code generation, L1/L2/L3 reward distribution
- [ ] Referral UI — link sharing, earnings dashboard
- [ ] Jackpot tables: tiers, pools, contributions
- [ ] Jackpot service — contribution tracking, draw logic
- [ ] Jackpot UI — current pools, winner announcements
- [ ] Commission breakdown by source
- [ ] Partner config + partner ledger
- [ ] Admin tabs: Commission, Jackpot

### Phase 4 — VIP, Shop & Social 🟡
**Goal**: Monetization + social features.

- [ ] VIP tables: subscriptions, config, customization
- [ ] VIP service — tiers (silver/gold/diamond), subscription CRUD
- [ ] VIP UI — subscribe, cosmetics (name gradient, frame, badge)
- [ ] VIP perks: premium board themes, piece skins
- [ ] Shop tables: purchases
- [ ] Shop service — chest tiers, CHECKER crediting
- [ ] Shop UI — chest bundles, purchase flow
- [ ] In-game chat (messages during game)
- [ ] Global lobby chat with styles/effects
- [ ] Player profiles (avatar, bio, stats)
- [ ] P2P CHECKER transfers
- [ ] Achievements (milestone-based CHECKER rewards)
- [ ] Admin tabs: VIP, Shop

### Phase 5 — Events & Content 🟡
**Goal**: Community engagement.

- [ ] Events tables: events, participants
- [ ] Events service — contests, raffles, prize distribution
- [ ] Sponsored events (user-created, admin approval)
- [ ] Announcements service — broadcast + sponsored
- [ ] News service — CRUD with i18n (EN/RU)
- [ ] Activity feed (unified history via UNION ALL)
- [ ] Admin tabs: Events, Announcements, News

### Phase 6 — LAUNCH Staking 🟢
**Goal**: 2% commission → LAUNCH stakers.

- [ ] Staking ledger — per-game 2% contributions from commission
- [ ] Staking flush — batch distribute to LAUNCH stakers on-chain
- [ ] Staking UI page (rewards display)
- [ ] Admin tab: Staking

### Phase 7 — Polish & Scale 🟢
**Goal**: Production hardening.

- [ ] Spectator mode (watch live games)
- [ ] Game replay viewer (step through completed games)
- [ ] Rematch button
- [ ] Tournament bracket system
- [ ] AI opponent (solo practice)
- [ ] PWA (installable, offline local games)
- [ ] Telegram bot (notifications, invites)
- [ ] Full i18n (RU/EN)
- [ ] SEO meta tags + OG images
- [ ] Structured logging (pino)
- [ ] Rate limiting
- [ ] DDoS protection

---

## 7. Database Schema Plan

### Current Tables (4)

| Table | Status |
|---|---|
| `users` | ✅ Built |
| `games` | ✅ Built |
| `game_moves` | ✅ Built |
| `sessions` | ✅ Built (unused — HMAC sessions are stateless) |

### Tables to Add (24+)

| Table | Phase | Coinflip Equivalent | Purpose |
|---|---|---|---|
| `vault_balances` | 2 | Same | Per-user: available, locked, bonus, offchainSpent, checkerBalance |
| `platform_config` | 2 | Same | KV store for all settings (by category) |
| `treasury_ledger` | 2 | Same | Commission entries: txHash, amount, source |
| `vault_transactions` | 2 | Same | Deposit/withdraw history |
| `tx_events` | 2 | Same | User action log |
| `relayer_transactions` | 2 | Same | Relayer broadcast audit trail |
| `referral_codes` | 3 | Same | Unique code per user |
| `referrals` | 3 | Same | Who invited whom |
| `referral_rewards` | 3 | Same | Per-reward: amount, level, fromPlayer |
| `referral_balances` | 3 | Same | Per-user total earned |
| `jackpot_tiers` | 3 | Same | 5 tiers: mini → super_mega |
| `jackpot_pools` | 3 | Same | Active pool per tier: cycle, amount, status |
| `jackpot_contributions` | 3 | Same | Per-game contribution (idempotent) |
| `partner_config` | 3 | Same | Partner: name, address, bps |
| `partner_ledger` | 3 | Same | Per-game partner payouts |
| `vip_subscriptions` | 4 | Same | Subscription history |
| `vip_config` | 4 | Same | Tier pricing |
| `vip_customization` | 4 | Same | Per-user cosmetics |
| `shop_purchases` | 4 | Same | Purchase log |
| `achievement_claims` | 4 | Same | Milestone claims (unique per user) |
| `global_chat_messages` | 4 | Same | Lobby chat with styles/effects |
| `game_messages` | 4 | `bet_messages` | In-game chat |
| `coin_transfers` | 4 | Same | P2P transfers |
| `profile_reactions` | 4 | Same | Emoji reactions on profiles |
| `events` | 5 | Same | Contests & raffles |
| `event_participants` | 5 | Same | Participation + results |
| `announcements` | 5 | Same | Broadcasts + sponsored |
| `news_posts` | 5 | Same | i18n content |
| `staking_ledger` | 6 | Same | Per-game 2% from commission → LAUNCH stakers |

---

## 8. Admin Panel Blueprint

### Route Structure

```
/admin                → Dashboard (protected by ADMIN_SECRET)
/admin/users          → User management
/admin/games          → Game inspection & recovery
/admin/config         → Platform settings editor
/admin/diagnostics    → System health checks
/admin/actions        → Manual repair tools
/admin/transactions   → Relayer tx logs
/admin/commission     → Revenue breakdown
/admin/referrals      → Referral stats
/admin/jackpot        → Tier & pool management
/admin/vip            → Subscription management
/admin/shop           → Chest config & stats
/admin/events         → Contest & raffle management
/admin/announcements  → Broadcasts
/admin/news           → Content CRUD
/admin/staking        → Contribution stats & flush
```

### API Endpoints Pattern

All admin endpoints under `/api/admin/*`, protected by `requireAdmin` middleware (validates ADMIN_SECRET header).

### Key Admin Features (from coinflip)

**System Healing (1-click)**:
1. Recover lost secrets
2. Sync from chain (re-index missed events)
3. Trigger pending reveals
4. Claim timeouts
5. Revert stuck transitions (>5 min in creating/joining/canceling)
6. Unlock stuck locked balances
7. Import orphaned on-chain games not in DB

**Diagnostics Dashboard**:
- Game status distribution (pie chart)
- Vault integrity check (DB balance vs chain balance)
- Stuck funds detection
- Relayer health (recent tx success rate, average duration)

---

## 9. Key Files Reference

### Game Engines
- `packages/shared/src/game/engine.ts` — American checkers
- `packages/shared/src/game/russian-engine.ts` — Russian checkers
- `packages/shared/src/game/variants.ts` — Unified dispatch
- `packages/shared/src/game/common.ts` — Board utilities

### Backend Core
- `apps/api/src/index.ts` — Main app, route registration
- `apps/api/src/routes/games.ts` — Game CRUD + relayer integration
- `apps/api/src/routes/auth.ts` — Challenge-response auth
- `apps/api/src/routes/chain.ts` — Chain proxy routes
- `apps/api/src/services/relayer.ts` — MsgExec broadcaster
- `apps/api/src/services/indexer.ts` — Block poller + event sync
- `apps/api/src/services/timeout-checker.ts` — Auto-forfeit service
- `apps/api/src/services/sequence-manager.ts` — Nonce safety
- `apps/api/src/services/session.service.ts` — HMAC session auth

### Frontend Core
- `apps/web/src/app/game/[id]/page.tsx` — Immersive game page
- `apps/web/src/app/(main)/page.tsx` — Lobby
- `apps/web/src/components/board/checkers-board.tsx` — Board UI
- `apps/web/src/components/ui/wallet-setup.tsx` — Authz grant flow
- `apps/web/src/lib/chain-tx.ts` — Offline signing + broadcast
- `apps/web/src/lib/chain-actions.ts` — Chain queries via API proxy
- `apps/web/src/hooks/use-websocket.ts` — WS with reconnect

### Smart Contract
- `contracts/checkers-vault/src/contract.rs` — Entry points + game logic
- `contracts/checkers-vault/src/msg.rs` — Message types
- `contracts/checkers-vault/src/state.rs` — Storage structures

### Database
- `packages/db/src/schema/users.ts`
- `packages/db/src/schema/games.ts`
- `packages/db/src/schema/sessions.ts`

### Config
- `packages/shared/src/chain.ts` — Axiome chain config
- `packages/shared/src/constants.ts` — Game constants
- `packages/shared/src/schemas.ts` — Zod schemas

---

## 10. Infrastructure

| Service | URL | Platform |
|---|---|---|
| Frontend | https://checkers-web.vercel.app | Vercel |
| API | (Railway — deploying) | Railway |
| Database | Neon project `odd-cell-67095538` | Neon |
| Blockchain | Axiome Chain (`axiome-1`) | Self-hosted |
| RPC (direct) | http://49.13.3.227:26657 | — |
| REST (direct) | http://49.13.3.227:1317 | — |

### Environment Variables

**Vercel (Frontend)**:
- `NEXT_PUBLIC_API_URL` — Railway API URL (https)
- `NEXT_PUBLIC_WS_URL` — Railway WS URL (wss)

**Railway (API)**:
- `DATABASE_URL` — Neon connection string
- `PORT` — 3001
- `CORS_ORIGIN` — Vercel URL + localhost
- `SESSION_SECRET` — HMAC key for sessions
- `ADMIN_SECRET` — Admin panel auth
- `RELAYER_MNEMONIC` — Relayer wallet mnemonic
- `CHECKERS_CONTRACT` — Contract address
- `CHAIN_RPC` — http://49.13.3.227:26657
- `CHAIN_REST` — http://49.13.3.227:1317

---

## 11. Contract Addresses

| Contract | Address | Code ID |
|---|---|---|
| Checkers Vault (native AXM) | `axm1dy3rn9qhjak7tg9dfp3r0z0hutwng2rysq0mxf43twa983yfgxksfa9ywc` | 42 |
| LAUNCH Staking | (reuse existing) | — |

### Chain Config
- Chain ID: `axiome-1`
- Bech32 prefix: `axm`
- BIP-44 coin type: 546
- HD path: `m/44'/546'/0'/0/0`
- Gas price: `0.025uaxm`
- Denom: `uaxm`

---

## Progress Summary

| Category | Built | Remaining | Total |
|---|---|---|---|
| Game engine | 10/10 | 0 | ✅ Complete |
| Multiplayer | 8/8 | 0 | ✅ Complete |
| Auth | 5/5 | 0 | ✅ Complete |
| Smart contract | 8/8 | 0 | ✅ Complete |
| Relayer | 6/6 | 0 | ✅ Complete |
| Indexer | 6/6 | 0 | ✅ Complete |
| Frontend pages | 6/6 | 0 | ✅ Complete |
| Authz flow | 6/6 | 0 | ✅ Complete |
| Infrastructure | 2/5 | 3 | 🟡 40% |
| Treasury & Economy | 0/6 | 6 | ❌ 0% |
| Admin Panel | 0/15 | 15 | ❌ 0% |
| Referrals | 0/7 | 7 | ❌ 0% |
| Jackpot | 0/6 | 6 | ❌ 0% |
| VIP | 0/5 | 5 | ❌ 0% |
| Shop | 0/6 | 6 | ❌ 0% |
| Social | 0/7 | 7 | ❌ 0% |
| Events | 0/5 | 5 | ❌ 0% |
| LAUNCH Staking | 0/3 | 3 | ❌ 0% |
| LAUNCH Staking | 0/3 | 3 | ❌ 0% |
| UX Polish | 2/12 | 10 | 🟡 17% |
| Background tasks | 1/6 | 5 | 🟡 17% |
| Audit & Logging | 0/3 | 3 | ❌ 0% |

**Core gameplay: 100% complete. Economy & features: ~15% complete.**

Next priority: Phase 1 (deploy) → Phase 2 (treasury + admin) → Phase 3 (referrals + jackpot).
