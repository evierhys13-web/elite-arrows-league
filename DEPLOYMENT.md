# Elite Arrows Deployment

## Stack

- Database: Supabase PostgreSQL
- App host: Railway

## 1. Create the database

1. Create a Supabase project.
2. Copy the PostgreSQL connection string from the Supabase project settings.
3. Use that value as `DATABASE_URL`.

Example:

```env
DATABASE_URL=postgresql://postgres:password@db.example.supabase.co:5432/postgres
PGSSL=require
```

## 2. Deploy the app

1. Push this project to GitHub.
2. Create a new Railway project from that repo.
3. Add environment variables:
   - `DATABASE_URL`
   - `PGSSL=require`
4. Railway will run:

```bash
npm install
npm start
```

## 3. Custom domain

After deploy, add your custom domain in Railway:

- example: `elite-arrows-league.com`

## Notes

- The app now uses PostgreSQL when `DATABASE_URL` is present.
- If `DATABASE_URL` is missing, it falls back to the local JSON file for local development.
- The database table is auto-created on first boot.
