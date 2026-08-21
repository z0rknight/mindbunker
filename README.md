# RMEDIA MindBunker

MindBunker is Emmanuel's private single-user CRM and operating dashboard. This repository preserves the original February 2026 interface and runs it as a Next.js 16 application on Cloudflare Workers with Cloudflare D1.

The application is built for the `/mindbunker` base path and includes an iPhone-first capture layer: fixed mobile navigation, an always-available Quick Log sheet, safe-area support, large touch targets, and standalone web-app metadata.

## Local development

Prerequisites: Bun and Node.js 20 or newer.

```bash
bun install
bun run cf-typegen
bun run db:migrate:local
bun run dev
```

Wrangler stores the local D1 database under `.wrangler/state`. Data persists between development runs.

To test the actual Cloudflare Workers runtime locally:

```bash
bun run preview
```

## Database migrations

Drizzle schemas live in `src/db/schema.ts`, and SQL migrations live in `src/db/migrations`.

```bash
bun run db:generate
bun run db:migrate:local
```

## Private deployment

1. Authenticate and create the production D1 database:

   ```bash
   wrangler login
   wrangler d1 create mindbunker
   ```

2. Replace the placeholder `database_id` in `wrangler.jsonc` with the ID returned by Cloudflare.
3. Regenerate binding types and apply the production migrations:

   ```bash
   bun run cf-typegen
   bun run db:migrate:remote
   ```

4. Upload the application with public and preview routes disabled:

   ```bash
   bun run deploy
   ```

   `wrangler.jsonc` deliberately sets both `workers_dev` and `preview_urls` to `false`. A successful upload therefore reports `No targets deployed` and creates no reachable URL.

5. In the Cloudflare dashboard, create a Cloudflare Access application for this Worker and configure an Allow policy for the exact email address that should have access. Email one-time PIN is sufficient for a single-user deployment.
6. Add the intended domain to the same Cloudflare account, then attach the Worker route `your-domain.example/mindbunker*`.
7. Only after Access is configured, verify all three cases:
   - Signed out: the Cloudflare Access login page appears.
   - Wrong email: access is denied.
   - Allowed email: MindBunker loads.

MindBunker does not currently implement its own application login. Cloudflare Access is the authentication boundary. Do not add real client data until that boundary has been verified in a signed-out browser.

### Access branding

Use `public/mindbunker-access-logo.svg` for the Access login page, with background `#09090b`, organization name `RMEDIA MindBunker`, header `Acesso privado ao MindBunker`, and footer `Somente Emmanuel · seus dados permanecem privados`. Keep the Access login chooser enabled so the branded screen is shown before email one-time PIN authentication.
