-- Safe RLS policies for likes and comments so authenticated users can interact with posts.

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_likes'
      AND policyname = 'Users can view likes'
  ) THEN
    CREATE POLICY "Users can view likes"
      ON public.post_likes
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_likes'
      AND policyname = 'Users can insert their own likes'
  ) THEN
    CREATE POLICY "Users can insert their own likes"
      ON public.post_likes
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_likes'
      AND policyname = 'Users can delete their own likes'
  ) THEN
    CREATE POLICY "Users can delete their own likes"
      ON public.post_likes
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can view comments'
  ) THEN
    CREATE POLICY "Users can view comments"
      ON public.comments
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can insert their own comments'
  ) THEN
    CREATE POLICY "Users can insert their own comments"
      ON public.comments
      FOR INSERT
      WITH CHECK (auth.uid() = author_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can update their own comments'
  ) THEN
    CREATE POLICY "Users can update their own comments"
      ON public.comments
      FOR UPDATE
      USING (auth.uid() = author_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users can delete their own comments'
  ) THEN
    CREATE POLICY "Users can delete their own comments"
      ON public.comments
      FOR DELETE
      USING (auth.uid() = author_id);
  END IF;
END $$;
