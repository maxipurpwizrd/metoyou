alter table public.profiles
  add column if not exists vibes_pro boolean default false,
  add column if not exists vibes_pro_until timestamp with time zone,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
