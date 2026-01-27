# Seeding Vercel Production Database

## Option 1: Using Vercel CLI (Recommended)

1. **Login to Vercel**:
```bash
vercel login
```

2. **Link your project**:
```bash
cd /Users/justincohen/calcutta
vercel link
```
- Select your team (jabramcos-projects)
- Select your project (calcutta)

3. **Pull environment variables**:
```bash
vercel env pull .env.production
```

4. **Run the seed script against production**:
```bash
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-) npx prisma db seed
```

## Option 2: Using Vercel Dashboard (Easiest)

1. Go to https://vercel.com/jabramcos-projects/calcutta
2. Click on your latest deployment
3. Click "..." menu → "Redeploy"
4. This will run migrations and seed automatically

## Option 3: Just Start the Auction

The auction state will be auto-created when you click "Start Auction" for the first time!

The API route has this built in:
```typescript
async function getAuctionState() {
  let state = await prisma.auctionState.findFirst()
  
  if (!state) {
    // Create initial state if it doesn't exist
    state = await prisma.auctionState.create({...})
  }
  
  return state
}
```

So you're good to go! Just wait for deployment to finish and start using the app.
