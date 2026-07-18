-- Migration: sync vibes_pro column with is_vibes_pro
-- Run this in Supabase SQL editor or via a DB connection with sufficient privileges (service_role).
BEGIN;

-- Ensure the canonical `vibes_pro` column matches the legacy `is_vibes_pro` value
UPDATE public.profiles
SET vibes_pro = is_vibes_pro
WHERE vibes_pro IS DISTINCT FROM is_vibes_pro;

COMMIT;

-- Notes:
-- - This makes `vibes_pro` equal to `is_vibes_pro` for all rows where they differ.
-- - Run in a maintenance window if you have active subscribers to realtime changes.
-- - Alternatively, adjust the WHERE clause to only update specific users.
