ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_original_url text;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS image_original_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_original_pic text;