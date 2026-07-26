# Vape Mart catalogue and availability website

A deployable, age-gated product catalogue for an Ontario physical retail store. It includes a persistent planning cart with quantity controls and a 13% Ontario HST estimate. **Checkout, payment, shipping, delivery, reservation, and order submission remain disabled** until the retailer receives its required approvals and connects an approved vape-capable payment provider.

## Delivered phases

### Phase 1 — Core website and admin MVP

- 19+ age gate, persistent per device
- Ontario and Canada nicotine/vaping warnings
- Responsive homepage, catalogue, category and brand filters, search, product detail pages, contact page, and legal pages
- Catalogue fields: name, brand, category, price, image/placeholder, UPC, flavour, and availability request
- Hardware-category products excluded from catalogue import
- Database-backed admin dashboard for adding, editing, hiding, featuring, and deleting products; reviewing requests; and importing RetailzPOS files
- Admin routes protected by ChatGPT sign-in plus an optional server-side email allowlist

### Phase 2 — Excel import and availability

- `.xlsx`, `.xls`, and `.csv` RetailzPOS upload
- UPC-first add/update logic
- Duplicate UPC detection
- Automatic Hardware exclusion
- Missing imported products are marked `missing_review`; they are never automatically deleted
- Manual name, brand, category, and image overrides are respected by import updates
- Cost fields are ignored and are never returned to catalogue customers
- Import-run summary stored in the database
- Availability request status: Pending, Available, or Unavailable
- Store notification to `vapemart307@gmail.com`
- Customer email reply after Available/Unavailable selection
- Honeypot spam protection, input validation, hashed-IP rate limit (five requests per hour)

### Phase 3 — Images and promotions preparation

- R2 object storage binding prepared for owned image storage
- Distributor image matching scripts and storage model
- Matching policy: exact UPC first; otherwise normalized brand, series, flavour, puff count, and product name
- Unmatched products retain placeholders
- Promotion data model supports automatic start and expiry at display time

## Cart-only interim launch

- Cart data is stored in the customer browser and does not create an order.
- Prices are snapshots of the displayed catalogue price when an item is added.
- The cart calculates subtotal, 13% Ontario HST, and an estimated total in CAD.
- Checkout is visibly disabled and no payment or delivery information is collected.
- When regulatory and merchant approval is complete, replace this boundary with server-priced order creation, an approved vape-payment authorization flow, owner approval, payment capture, and proof-of-age delivery.

## Before production

The current catalogue was generated from `/Users/chiragsavani/Downloads/VAPE MART.xlsx`: 1,037 source rows produced 902 valid non-Hardware products, with 116 Hardware rows excluded and no duplicate UPCs. The address and requested hours are current. The phone number remains a placeholder because a confirmed number was not provided.

1. In Admin → Store, replace the placeholder phone number.
2. Add the real admin email to `ADMIN_EMAILS`.
3. Review the imported product names and prices.
4. Provide a selective distributor file listing or smaller product-image export; the Valor shared-folder archive is approximately 38 GB and could not be safely downloaded wholesale.
5. Sync distributor images and approve matches.
6. Configure and test the email sender.
7. Have Ontario counsel review the legal copy and required warnings.

## Local setup

Requirements: Node.js 22.13+.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The catalogue is available at `/`. The admin route is `/admin`. On Sites, admin authentication is provided by ChatGPT sign-in. There are no reusable sample passwords. For safe credential setup, set `ADMIN_EMAILS` to the real owner/admin ChatGPT account email. A signed-in user not on the allowlist is denied server-side.

## Database and migrations

The production database is Cloudflare D1 using the logical binding `DB`. Product-image and promotion files use the R2 binding `STORAGE`.

After changing `db/schema.ts`:

```bash
npm run db:generate
```

Inspect the generated SQL in `drizzle/`, commit it with the source, then deploy. The runtime also uses idempotent `CREATE TABLE IF NOT EXISTS` statements so a fresh environment can initialize safely.

Backups:

1. Export the D1 database before schema migrations and before large Excel imports.
2. Keep daily database exports for 30 days and monthly exports for one year.
3. Enable R2 versioning or keep a second bucket copy of approved product images and promotion banners.
4. Keep the original RetailzPOS exports and distributor asset downloads outside the website as the source archive.
5. Test a restore quarterly in a non-production environment.

## Excel import

1. Export products from RetailzPOS as Excel or CSV.
2. In `/admin`, open Imports and choose the file.
3. The importer recognizes common headings such as `UPC`, `Barcode`, `Product Name`, `Name`, `Category`, `Brand`, `Retail Price`, and `Selling Price`.
4. Review Added, Updated, Duplicate, Hardware skipped, and Missing/review counts.
5. Resolve duplicate UPCs in the source workbook.
6. Review missing products and hide/delete them manually only when appropriate.
7. For an unmatched product, open Admin → Products → Edit and use **Upload image**. Existing product images can be replaced from the same editor with **Change image**.

The importer never reads cost into the public model and never deletes missing products automatically.

## Distributor image sync

Sources:

- Valor Dropbox folder (provided by the client)
- Pacific Smoke Dropbox folder (provided by the client)

Operational flow:

1. Download the distributor folders to a secure operator machine. Do not embed Dropbox URLs.
2. Add approved distributor assets to the site-owned R2 `STORAGE` bucket as part of a managed catalogue image sync.
3. Normalize filenames and product text by lowercasing, removing punctuation and pack-size noise, and standardizing spaces.
4. Match exact UPCs first (confidence 98–100%).
5. For assets without UPC, score brand, product series, flavour, puff count, and normalized product name. Require admin review below the chosen confidence threshold.
6. Select one front-facing image per product.
7. Approve, reject, or manually select each candidate. Only approved objects may populate `products.image_key`.
8. Preserve placeholders for all unmatched or unapproved products.

New Excel products are matched automatically against the existing approved image catalogue using exact UPC first, then exact normalized product name. The import summary reports both **Images found** and **Need an image**. A truly new product whose image is not already in the approved catalogue keeps its placeholder; RetailzPOS exports do not include enough image data to safely identify and copy a distributor image from the public internet.

## Homepage banners

1. Open Admin → Banners.
2. Upload up to six image files and provide a useful description. The admin automatically converts and compresses each file before upload to meet the production request limit.
3. Custom banners rotate in their displayed order and replace the built-in hero posters.
4. Remove individual banners as promotions expire.
5. When all custom banners are removed, the original three built-in banners return automatically.

Banner and product-library files are stored in the site-owned R2 `STORAGE` bucket and are served through the website, never through Dropbox links.

## Email

This implementation uses the Resend HTTPS API, which is compatible with the Cloudflare runtime.

Set:

- `RESEND_API_KEY`
- `EMAIL_FROM` using a verified sending domain

Store notifications are sent to `vapemart307@gmail.com`. Customer responses are emailed only when the submitted contact is an email address; phone-only requests remain visible for manual store follow-up.

## Environment variables

Copy `.env.example` for local work. Set production values through the Sites environment-variable controls, not in source control.

- `ADMIN_EMAILS`: comma-separated server-side admin allowlist
- `RESEND_API_KEY`: transactional email credential
- `EMAIL_FROM`: verified sender
- `RATE_LIMIT_SALT`: long random secret used when hashing IP addresses

## Error logging

Server failures use structured console labels such as `inquiry_create_failed` and `excel_import_failed`. Connect production Worker logs to the organization’s chosen alerting/log-retention destination. Do not log customer contact details, raw IP addresses, credentials, workbook contents, or product cost.

## Deployment

1. Confirm the production environment variables.
2. Build with `npm run build`.
3. Confirm the D1 and R2 logical bindings in `.openai/hosting.json`.
4. Deploy the saved Sites version.
5. Test age verification, search, category/brand filters, one request, store notification, admin sign-in/allowlist, an admin response email, import summary, image approval, and promotion expiry.
6. Public access requires an explicit publishing decision. Keep admin authorization enforced regardless of site access level.

## Client handover checklist

- Replace the placeholder phone number
- Review the imported 902-product catalogue
- Verify no Hardware products are visible
- Approve product-image matches
- Configure sender domain and run test emails
- Confirm the admin allowlist
- Confirm legal copy with counsel
- Train staff to answer requests as Available or Unavailable
- Provide the backup owner and operations lead with the backup/restore location
- Record renewal owners for domain, email service, and hosting

## Security notes

- Authentication and authorization are checked server-side.
- Do not use a shared password or publish sample credentials.
- Rotate email credentials periodically and immediately after suspected exposure.
- Limit admin access to named owner/operator accounts.
- Keep dependencies patched; review `npm audit` output before each production release.
