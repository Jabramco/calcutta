# Deployment Guide for Vercel

This guide will help you deploy the NCAA Calcutta Auction app to Vercel with a PostgreSQL database.

## Prerequisites
- A [Vercel account](https://vercel.com/signup) (free)
- Your GitHub repository connected to Vercel

## Step 1: Deploy to Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository: `Jabramco/calcutta`
3. Vercel will automatically detect it's a Next.js project

## Step 2: Add Vercel Postgres Database

1. After importing, **before** clicking Deploy, go to the "Storage" tab
2. Click "Create" → "Postgres"
3. Name it `calcutta-db` (or any name you prefer)
4. Click "Create"
5. Vercel will automatically add the `DATABASE_URL` environment variable

## Step 3: Add Environment Variables

In the Vercel project settings → Environment Variables, add:

### Required Variables:
- `DATABASE_URL` - (automatically added by Vercel Postgres)
- `JWT_SECRET` - Generate a random secret string (e.g., use [https://randomkeygen.com/](https://randomkeygen.com/))
- `NODE_ENV` - Set to `production`

### Example:
```
JWT_SECRET=your-super-secret-random-string-here-change-this
NODE_ENV=production
```

## Step 4: Deploy

1. Click "Deploy"
2. Wait for the build to complete (2-3 minutes)

## Step 5: Set Up Database

After the first deployment:

1. Go to your Vercel project → Settings → Storage
2. Click on your Postgres database
3. Go to the ".env.local" tab and copy the `DATABASE_URL`
4. Run the following commands locally:

```bash
# Set the DATABASE_URL environment variable temporarily
export DATABASE_URL="your-vercel-postgres-url-here"

# Generate Prisma client for PostgreSQL
npx prisma generate

# Push the schema to the database
npx prisma db push

# Seed the database
npm run seed
```

## Step 6: Create Your Admin Account

After seeding, create your admin user:

```bash
# Still using the DATABASE_URL from step 5
npx tsx scripts/make-admin.ts
```

When prompted, enter: `justin`

## Your App is Live! 🎉

Your app will be available at: `https://your-project-name.vercel.app`

## Automatic Deployments

From now on, every time you push to the `main` branch on GitHub, Vercel will automatically deploy your changes.

## Alternative: Quick Deploy Button

You can also use this one-click deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Jabramco/calcutta&env=JWT_SECRET&envDescription=Required%20environment%20variables&envLink=https://github.com/Jabramco/calcutta&project-name=calcutta-auction&repository-name=calcutta&stores=[{"type":"postgres"}])

## Troubleshooting

### Build Errors
- Make sure all environment variables are set
- Check the build logs in Vercel dashboard

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Make sure you ran `prisma db push` after deployment

### Admin Access
- After seeding, make sure to run the `make-admin.ts` script with your Vercel database URL

## Local Development with Production Database

If you want to develop locally but use the production database:

```bash
# Add to your local .env file
DATABASE_URL="your-vercel-postgres-url"
JWT_SECRET="same-as-production"
```

Then run:
```bash
npm run dev
```

---

Need help? Check the [Vercel documentation](https://vercel.com/docs) or [Prisma PostgreSQL guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql).
