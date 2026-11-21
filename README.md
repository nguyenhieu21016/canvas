# Canvas

Vanilla HTML/CSS/JS LMS built with Vite and Supabase (Auth, Postgres, Realtime, Edge Functions).

## Project Structure

```text
src/
├── main.js                   # App bootstrap, auth listener, header shell & route registration
├── router.js                 # Hash router (#/...) and route teardown cleanup
├── store.js                  # Shared user session/profile state and theme helpers
├── styles/                   # CSS tokens, base rules, and component styles
├── services/
│   ├── supabaseClient.js     # Supabase client setup
│   └── lmsApi.js             # Data fetching/mutations, presence & caching
├── lib/                      # Small pure helpers (scoring, LaTeX/HTML, formatting, drafts)
└── pages/
    ├── Auth.js               # Login / Register / Password reset
    ├── Settings.js           # User profile & activity settings
    ├── student/
    │   ├── Learn.js          # Learning path & lecture viewer
    │   ├── Exam.js           # Assignment overview, exam runner, and review
    │   └── Grades.js         # Student gradebook
    └── admin/
        ├── ManageHub.js      # Admin hub menu
        ├── Students.js       # Student tracking, progress, and online users
        ├── Courses.js        # Course phases, modules & lectures manager
        ├── Assignments.js    # Assignment & LaTeX exam editor
        ├── QuestionBank.js   # Reusable question bank
        └── Salary.js         # Teaching schedule & salary calculator
```

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

4. Apply migrations in `supabase/migrations/` and deploy Edge Functions:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-update-user
supabase functions deploy admin-reset-password
supabase functions deploy admin-delete-user
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The project id is already set in `supabase/config.toml`.

5. Create the first admin user in Supabase Auth, then run:

```sql
update public.profiles set role = 'admin' where email = 'admin@example.com';
```

6. Start the app:

```bash
npm run dev
```

## Test Commands

```bash
npm test
npm run build
npm run test:e2e
```
