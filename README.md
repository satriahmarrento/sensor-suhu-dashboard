# sensor-suhu-dashboard

## Environment

Set these variables locally and in Vercel:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

The browser app calls `/api/admin_config` and `/api/sensor_data`; Supabase credentials stay in server-side environment variables.
