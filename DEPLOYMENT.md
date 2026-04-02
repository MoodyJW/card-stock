# Deployment Guide

CardStock deploys to **Vercel** (frontend) + **Supabase Cloud** (database, auth, storage).

## Cost Summary

| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| Vercel | Hobby (free) | $0 | Fine for personal/testing; commercial use technically needs Pro at $20/mo |
| Supabase | Free | $0 | Project pauses after 7 days inactivity (~30s cold-start to resume) |
| Domain | Optional | ~$12/yr | Cloudflare Registrar is cheapest |
| Email | Supabase built-in | $0 | 4 auth emails/hour — fine for MVP |

Upgrade to **Supabase Pro ($25/mo)** when you have consistent daily traffic and can't tolerate the cold-start, or when you approach the 500 MB DB / 1 GB storage limits.

---

## Checklist

```
□ Step 1: Create Supabase production project
□ Step 2: Push migrations
□ Step 3: Configure auth redirect URLs
□ Step 4: Create environment.prod.ts
□ Step 5: Update angular.json (fileReplacements)
□ Step 6: Create vercel.json
□ Step 7: Commit and push
□ Step 8: Deploy to Vercel
□ Step 9: Update Supabase Site URL to Vercel URL
□ Step 10: Smoke test
□ Step 11 (optional): Add custom domain
```

---

## Step 1: Create a Supabase Production Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Fill in name (`card-stock-prod`), a strong database password (save it), and the region closest to your users
3. **Enable Data API**: ✅ yes — this powers the entire Supabase JS client
4. **Enable automatic RLS**: leave unchecked — your migrations already handle RLS explicitly
5. Wait ~2 minutes for the project to provision
6. Go to **Project Settings → API → API Keys**
7. Copy and save two values:
   - **Project URL** — `https://<ref>.supabase.co`
   - **Publishable key** — `sb_publishable_...` (the new name for the anon key; safe to expose in frontend code)

> **Never use the Secret key in the frontend.** It is the equivalent of the old `service_role` key and bypasses all RLS policies.

---

## Step 2: Push Migrations to Production

The Supabase CLI applies your local migrations to the production database.

```bash
# Authenticate with Supabase
npx supabase login

# Link to your production project
# Your project ref is the subdomain in your Project URL, e.g. "abcdefgh" from https://abcdefgh.supabase.co
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
npx supabase db push
```

After this completes, open the **Table Editor** in your Supabase dashboard and verify you can see the tables: `profiles`, `organizations`, `memberships`, `inventory`, `inventory_images`, `transactions`, `invites`, `audit_log`.

---

## Step 3: Configure Auth Redirect URLs

Without this, email confirmation and password reset links will redirect to `localhost` instead of your production site.

In your Supabase dashboard go to **Authentication → URL Configuration**:

- **Site URL**: your Vercel app URL (set a placeholder for now — you'll update it after the first deploy)
  ```
  https://card-stock.vercel.app
  ```
- **Redirect URLs**: add all of these (replace the domain with yours):
  ```
  https://card-stock.vercel.app/**
  https://card-stock.vercel.app/auth/confirm
  https://card-stock.vercel.app/auth/reset-password
  ```

> Come back and update these once you have your real Vercel URL or custom domain.

---

## Step 4: Create `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  supabase: {
    url: 'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'sb_publishable_YOUR_KEY_HERE',
  },
};
```

Then remove it from `.gitignore` so Vercel can use it during builds:

```
# .gitignore — remove or comment out this line:
# src/environments/environment.prod.ts
```

Commit the file. The publishable key is safe to commit — it is designed to be public, and RLS enforces all data access rules.

---

## Step 5: Add `fileReplacements` to `angular.json`

This tells Angular to swap `environment.ts` for `environment.prod.ts` during production builds. Open `angular.json` and add `fileReplacements` to the `production` configuration under `architect → build → configurations`:

```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ],
  "budgets": [ ... ],
  "outputHashing": "all"
}
```

Verify the build works before continuing:

```bash
npm run build
```

Output lands in `dist/card-stock/browser/`.

---

## Step 6: Create `vercel.json`

This tells Vercel to serve `index.html` for every route, which is required for an Angular SPA. Without it, navigating directly to any URL other than `/` returns a 404.

Create `vercel.json` in the project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Step 7: Commit and Push

```bash
git add src/environments/environment.prod.ts angular.json vercel.json
git commit -m "chore: production build config and vercel deployment setup"
git push
```

---

## Step 8: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**
2. Import the `card-stock` repository
3. Confirm or set the build settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/card-stock/browser`
   - **Install Command**: `npm install`
4. Click **Deploy**

The first deploy takes ~2–3 minutes. When it finishes, Vercel gives you a URL like `https://card-stock-abc123.vercel.app`.

---

## Step 9: Update Supabase Site URL

Go back to **Supabase → Authentication → URL Configuration** and update the **Site URL** and **Redirect URLs** with your real Vercel URL from Step 8.

---

## Step 10: Smoke Test

Work through these in order:

1. **Auth** — Register with a real email. You should receive a confirmation email. Clicking the link should land on your Vercel URL.
2. **Shop** — Create a shop. Verify it persists after a page refresh.
3. **Inventory** — Add and edit a card.
4. **Images** — Upload an image. Verify the thumbnail appears and loads from Supabase Storage.
5. **Import** — Import a small CSV or Excel file.
6. **Export** — Export inventory as CSV.

If something breaks, check **Vercel → Deployments → Runtime Logs** and **Supabase → Logs** for errors.

---

## Step 11 (Optional): Custom Domain

1. Buy a domain from [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (~$8–10/yr for `.com`, at-cost pricing)
2. In Vercel → your project → **Settings → Domains → Add** your domain
3. Follow Vercel's instructions to add a `CNAME` or `A` record in your DNS provider
4. Update Supabase **Site URL** and **Redirect URLs** to use the custom domain

---

## Free Tier Limits Reference

| Resource | Supabase Free Limit |
|----------|-------------------|
| Database | 500 MB |
| Storage | 1 GB |
| Monthly active users | 50,000 |
| Auth emails | 4/hour (built-in SMTP) |
| Bandwidth | 5 GB |
| Project inactivity pause | After 7 days |

For more auth email volume, connect a custom SMTP provider under **Authentication → SMTP Settings**. [Resend](https://resend.com) has a free tier (3,000 emails/month).
