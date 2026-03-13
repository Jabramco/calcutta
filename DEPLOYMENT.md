# Deployment Guide for Vercel

This guide will help you deploy the NCAA Calcutta Auction app to Vercel with a PostgreSQL database.

## Prerequisites
- A [Vercel account](https://vercel.com/signup) (free)
- Your GitHub repository connected to Vercel

## Step 1: Deploy to Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository: `Jabramco/calcutta`
3. Vercel will automatically detect it's a Next.js project

## Step 2: Database and environment variables

The app uses **standard** env var names (see `.env.example`). It does **not** require the "Prisma Postgres" integration—that integration is what’s failing for you.

**Required env vars:**

- `DATABASE_URL` – PostgreSQL connection string
- `DIRECT_DATABASE_URL` – Same URL (or your provider’s “direct” URL if they give two)
- `JWT_SECRET` – Random secret for JWT (e.g. [randomkeygen.com](https://randomkeygen.com/))

**If “Prisma Postgres” (prisma-postgres-calcutta) is failing:**

1. In Vercel → your project → **Settings → Integrations**, remove or disconnect the **Prisma Postgres** integration so deploys no longer try to provision it.
2. Add a database another way:
   - **Neon** (free): [neon.tech](https://neon.tech) → Create project → copy the connection string.
   - **Vercel Postgres** (no Prisma): In the project, Storage → Create → **Postgres** (the regular one, not “Prisma Postgres”). It will set `POSTGRES_URL`; in Environment Variables add `DATABASE_URL` and `DIRECT_DATABASE_URL` both set to that same value.
   - **Supabase / Railway / etc.**: Create a Postgres DB, copy the URL, set `DATABASE_URL` and `DIRECT_DATABASE_URL` to it (same value if you only have one).
3. In **Settings → Environment Variables** set:
   - `DATABASE_URL` = your Postgres URL
   - `DIRECT_DATABASE_URL` = same URL (or direct URL if you have two)
   - `JWT_SECRET` = a long random string
4. Redeploy.

## Step 3: Confirm env vars

In Vercel → Settings → Environment Variables, you should have:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `JWT_SECRET`

## Step 4: Deploy

1. Click "Deploy"
2. Wait for the build to complete (2-3 minutes)

## Step 5: Set up the database

After the first deployment, run migrations and seed from your machine using the same Postgres URL as in Vercel:

1. Get your connection string from your provider (Vercel Storage → your DB → .env tab, or Neon/Supabase/etc.).
2. In the project root, create a `.env` with:
   - `DATABASE_URL` = your Postgres URL
   - `DIRECT_DATABASE_URL` = same URL (or direct URL if different)
   - `JWT_SECRET` = any long random string
3. Run:

```bash
npx prisma generate
npx prisma db push
npm run seed
```

## Step 6: Create your admin account

After seeding:

```bash
npx tsx scripts/make-admin.ts
```

When prompted, enter the username you want to make admin (e.g. the one you signed up with). The seed creates `admin` / `admin123`; you can use that or create a user via the app and then run this script.

## Your App is Live! 🎉

Your app will be available at: `https://your-project-name.vercel.app`

## Automatic Deployments

From now on, every time you push to the `main` branch on GitHub, Vercel will automatically deploy your changes.

## Alternative: Quick Deploy Button

You can also use this one-click deploy:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Jabramco/calcutta&env=JWT_SECRET&envDescription=Required%20environment%20variables&envLink=https://github.com/Jabramco/calcutta&project-name=calcutta-auction&repository-name=calcutta&stores=[{"type":"postgres"}])

## Troubleshooting

### "Provisioning integrations failed" / Prisma Postgres "Installation" failing
Deployment fails when the **Prisma Postgres** integration (e.g. prisma-postgres-calcutta) can’t install or provision. **Fix:** Remove the Prisma Postgres integration from the project (Settings → Integrations). Add a different Postgres (Neon, or Vercel’s regular Postgres, or Supabase). Set `DATABASE_URL`, `DIRECT_DATABASE_URL`, and `JWT_SECRET` in Environment Variables. Redeploy. The app no longer requires the Prisma Postgres integration.

### Build errors
- Ensure all required env vars are set (see `.env.example`).
- Check the build logs in the Vercel dashboard.

### Database connection issues
- Verify `DATABASE_URL` and `DIRECT_DATABASE_URL` in Vercel.
- Run `npx prisma db push` (and seed) locally with the same URLs in `.env`.

### Admin access
- Run `npx tsx scripts/make-admin.ts` with the same env vars to promote a user to admin.

## Local development with production database

In `.env`:

```
DATABASE_URL="your-postgres-url"
DIRECT_DATABASE_URL="your-postgres-url"
JWT_SECRET="same-as-production"
```

Then run `npm run dev`.

---

Need help? Check the [Vercel documentation](https://vercel.com/docs) or [Prisma PostgreSQL guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql).
