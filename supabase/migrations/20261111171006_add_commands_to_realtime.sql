/*
# Add commands table to Realtime publication

1. Modified publication
- `supabase_realtime` now includes `public.commands`, so the dashboard receives live command status changes (received, executed, failed) without reloading.

2. Security
- No table grants or policies change. Realtime delivers only rows the signed-in owner can already SELECT under the existing commands policy.

3. Notes
- Idempotent: the block only adds the table when it is not already published.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'commands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;
  END IF;
END $$;
