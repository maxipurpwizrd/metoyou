-- Enforce admin authorization at the database boundary for existing admin UI operations.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF to_regclass('public.posts') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Admins can manage posts" ON public.posts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF to_regclass('public.comments') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Admins can manage comments" ON public.comments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF to_regclass('public.post_likes') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Admins can manage post likes" ON public.post_likes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Admins can manage messages" ON public.messages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "Admins can manage reports" ON public.reports FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;
