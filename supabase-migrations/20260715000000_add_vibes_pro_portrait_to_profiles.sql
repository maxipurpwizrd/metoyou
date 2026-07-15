-- Add the missing premium portrait column to the profiles table.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibes_pro_portrait text;
