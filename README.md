# Canvas

Vanilla HTML/CSS/JS LMS built with Vite, Supabase Auth/Postgres/Edge Functions, and Material Design 3 web components.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` for the Vite app:

```bash
cp .env.example .env
```

3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

4. Keep Prisma database URLs in `.env.local`. Prisma v7 loads them through `prisma.config.ts`; migration/introspection commands use `DIRECT_URL`.

```bash
npm run prisma:validate
npm run prisma:generate
```

5. Apply the migration in `supabase/migrations/202606010001_lms_schema.sql`.

6. Deploy functions:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
supabase functions deploy admin-reset-password
supabase functions deploy admin-delete-user
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The project id is already set in `supabase/config.toml`.

7. Create the first admin user in Supabase Auth, then run:

```sql
update public.profiles set role = 'admin' where email = 'admin@example.com';
```

8. Start the app:

```bash
npm run dev
```

## Test Commands

```bash
npm test
npm run build
npm run test:e2e
```

## V1 Scope

- One-class LMS model.
- Email/password login.
- Public Google Drive preview embeds only.
- Server-side grading via Supabase RPC.
- Service-role Auth management only inside Edge Functions.
