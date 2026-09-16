-- Expose only intentionally public profile fields through a dedicated read model.

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  username,
  bio,
  profile_pic,
  profile_original_pic,
  is_vibes_pro AS vibes_pro,
  vibes_pro_portrait,
  hommies_count,
  snapshots_count,
  vibes_count,
  language
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
