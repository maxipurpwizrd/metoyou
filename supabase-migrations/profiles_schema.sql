-- Ensure the profiles table has the columns used by the app.
-- This keeps the frontend profile save flow compatible with your Supabase schema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_pic text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS vibes_pro boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vibes_pro_portrait text,
  ADD COLUMN IF NOT EXISTS vibes_pro_until timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- If your project already uses first_name/last_name in auth metadata, this is optional.
-- The app does not need these columns for profile persistence.
