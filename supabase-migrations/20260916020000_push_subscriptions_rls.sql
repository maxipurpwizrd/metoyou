-- Push subscriptions are private to their authenticated owner.

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon;

DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
