-- Allow authenticated users to create and manage their own posts.
-- Existing read policies and admin policies remain unchanged.

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts"
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);
