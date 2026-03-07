# Setup Requirements (for Aleksander)

## Phase 1: Infrastructure (YOU do this)

### 1. Create GitHub Repository
- Go to github.com/new
- Name: `checkers`, Private
- Do NOT initialize with README (repo already has code)
- Then run:
```bash
cd E:\Work\checkers
git remote add origin https://github.com/Kaparin/checkers.git
git push -u origin master
```

### 2. Create Neon Database
- Go to console.neon.tech
- Create new project "checkers"
- Copy the DATABASE_URL connection string

### 3. Create `.env` file
```bash
cp .env.example .env
```
Fill in:
- `DATABASE_URL` — from Neon
- `JWT_SECRET` — any random string (e.g. `openssl rand -hex 32`)
- `ADMIN_SECRET` — any random string
- `RELAYER_MNEMONIC` — same relayer as coinflip

### 4. Push DB schema
```bash
pnpm db:push
```

### 5. Deploy API to Railway
- New project from GitHub repo
- Root directory: `apps/api`
- Build: `pnpm install && pnpm --filter @checkers/api run build`
- Start: `node apps/api/dist/index.js`
- Env vars: DATABASE_URL, JWT_SECRET, ADMIN_SECRET, CORS_ORIGIN, RELAYER_MNEMONIC, CHAIN_RPC, CHAIN_REST, CHAIN_ID, COIN_CONTRACT

### 6. Deploy Web to Vercel
- Import from GitHub
- Framework: Next.js
- Root directory: `apps/web`
- Env vars: NEXT_PUBLIC_API_URL (Railway URL), NEXT_PUBLIC_WS_URL (Railway WSS URL)

---

## Phase 2: Post-Deploy TODO (Claude will do)

### Smart Contract (Escrow for wagers)
- [ ] Write CosmWasm contract: create_game (lock wager), join_game (lock wager), resolve (pay winner - 10% commission), cancel (refund)
- [ ] Tests with cw-multi-test
- [ ] Deploy to Axiome chain
- [ ] Integrate contract calls into API relayer service

### Axiome Wallet Auth
- [ ] Wallet connect flow (same pattern as coinflip — sign nonce with wallet)
- [ ] Session management with wallet address
- [ ] Auth UI component (connect wallet button in header)

### Relayer Service
- [ ] Sequence manager (mutex-based, same as coinflip)
- [ ] MsgExec via authz for game actions (create/join/resolve)
- [ ] Background task for on-chain confirmation

### Indexer
- [ ] Poll chain blocks for contract events
- [ ] Sync on-chain game state with DB
- [ ] Handle edge cases (chain reorg, missed blocks)

### ELO Rating System
- [ ] Calculate ELO changes on game end (K=32 for new, K=16 for established)
- [ ] Store and update in users table
- [ ] Matchmaking suggestions based on ELO range

### Game Features
- [ ] Sound effects (move, capture, king promotion, game over)
- [ ] Spectator mode (watch live games without being a player)
- [ ] Rematch button after game over
- [ ] Draw offer / accept
- [ ] Game chat (text messages between players during game)
- [ ] Move history panel (algebraic notation, clickable to replay)
- [ ] Undo request (both players must agree)

### UI/UX Polish
- [ ] Mobile responsive improvements (touch drag-and-drop)
- [ ] Board themes (wood, marble, dark, neon)
- [ ] Piece animation improvements (slide along path, bounce on capture)
- [ ] Loading skeletons instead of spinners
- [ ] PWA support (installable, offline local games)
- [ ] Meta tags, OG images for social sharing

### Social Features
- [ ] Player profiles with game history
- [ ] Friends list
- [ ] Invite link (share game link, opponent joins)
- [ ] Telegram bot (game notifications, invite friends)

### Analytics & Admin
- [ ] Admin dashboard (active games, revenue, user stats)
- [ ] Commission tracking (treasury ledger)
- [ ] Game replay viewer (admin can review any game)

### Referral System
- [ ] Copy from coinflip: referral codes, BPS rewards per game
- [ ] Referral balance + withdrawal

### Staking Integration
- [ ] LAUNCH token staking (same contract as coinflip)
- [ ] Staking contributions per game (2% to staking pool)
