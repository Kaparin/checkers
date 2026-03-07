# Setup Requirements (for Aleksander)

## 1. Create GitHub Repository
- Go to github.com/new
- Name: `checkers`, Private
- Do NOT initialize with README (repo already has code)
- Then run:
```bash
cd E:\Work\checkers
git remote add origin https://github.com/Kaparin/checkers.git
git push -u origin master
```

## 2. Create Neon Database
- Go to console.neon.tech
- Create new project "checkers"
- Copy the DATABASE_URL connection string

## 3. Create `.env` file
```bash
cp .env.example .env
```
Fill in:
- `DATABASE_URL` — from Neon
- `JWT_SECRET` — any random string
- `ADMIN_SECRET` — any random string
- `RELAYER_MNEMONIC` — same relayer as coinflip

## 4. Push DB schema
```bash
pnpm db:push
```

## 5. Deploy
- **API** → Railway (same as coinflip setup)
- **Web** → Vercel (same as coinflip setup)
- **DB** → Already on Neon from step 2
