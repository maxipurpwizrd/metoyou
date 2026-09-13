-- Add push_subscriptions table to store browser push subscriptions

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NULL,
  endpoint text NOT NULL,
  keys jsonb NULL,
  expiration_time timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- Optional: allow service role to insert/upsert
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon;
