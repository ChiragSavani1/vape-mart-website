# Vape Mart

Production catalogue, cart preview, availability workflow, and admin dashboard for Vape Mart in Barrie, Ontario. Checkout and payment remain disabled.

## Local setup

1. Install Node.js 22.13+ and PostgreSQL.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and configure it.
4. Run `npm run db:migrate`.
5. Run `npm run dev`.

Create the first admin password hash with:

```bash
npm run admin:hash-password -- "a-long-unique-password"
```

Set `ADMIN_EMAIL`, paste the generated value into `ADMIN_PASSWORD_HASH`, and set a random `SESSION_SECRET` of at least 32 characters. Admin sessions are stored in PostgreSQL; cookies are HttpOnly, SameSite Strict, and Secure in production. Sign out from the admin profile.

## Render deployment

The repository includes `render.yaml`. Connect the GitHub repository as a Render Blueprint, or create a Node web service and Render Postgres database manually.

- Build command: `npm ci && npm run db:migrate && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

The standalone server reads Render's `PORT` and binds to `0.0.0.0`.

Configure every environment variable shown in `.env.example`. Use Render's internal PostgreSQL connection URL for `DATABASE_URL`. Run schema changes with `npm run db:generate`, commit the generated files under `drizzle/`, and deploy with `npm run db:migrate`.

## Persistent images

Uploaded banners and the distributor image library use external S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.). Configure the `S3_*` variables.

Images recovered by the missing-image finder are intentionally downloaded to Render's temporary filesystem first. Their database status is `temporary` until an administrator chooses **Archive Images to GitHub**. If Render removes a temporary file, the catalogue immediately returns to its normal placeholder and the product re-enters the missing-image queue without losing its UPC, SKU, source URL, retry count, failure reason, or search history.

To enable the manual archive action, create a dedicated branch such as `product-images`, then configure `GITHUB_IMAGE_ARCHIVE_TOKEN`, `GITHUB_IMAGE_ARCHIVE_REPOSITORY`, and `GITHUB_IMAGE_ARCHIVE_BRANCH`. The token needs Contents read/write access to the configured repository. Images are not committed automatically.

The RetailzPOS import matches UPCs first, adds and updates products, excludes Hardware, flags missing products for review, preserves manual fields, and attempts to match approved existing images. The admin can upload a product image or run the controlled missing-image search.

## Availability email

Set `RESEND_API_KEY` and a verified `EMAIL_FROM`. Requests are stored even if mail delivery is unavailable. Store notifications go to `AVAILABILITY_TO` (default `vapemart307@gmail.com`).

## Backups and launch

- Enable Render Postgres backups and periodically verify a restore.
- Enable versioning/lifecycle protection on the S3 bucket.
- Keep a secure copy of Render environment variables.
- Test login/logout, Excel import, image upload, availability request/reply, mobile catalogue, and `/api/health`.
- Keep the existing Cloudflare deployment live until the Render service, database, storage, email, and custom domain have all been verified.

Run `npm test` and `npm run build` before release.
