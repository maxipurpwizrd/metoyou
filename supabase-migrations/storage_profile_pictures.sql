-- Ensure the profile-pictures storage bucket exists and is publicly readable.
-- This keeps the existing frontend upload flow intact while enforcing ownership-based RLS.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view objects only inside their own folder.
DROP POLICY IF EXISTS "Profile pictures: authenticated users can select their own files" ON storage.objects;
CREATE POLICY "Profile pictures: authenticated users can select their own files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'profile-pictures'
    AND auth.role() = 'authenticated'
    AND coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );

-- Allow authenticated users to upload files only inside their own folder.
DROP POLICY IF EXISTS "Profile pictures: authenticated users can insert their own files" ON storage.objects;
CREATE POLICY "Profile pictures: authenticated users can insert their own files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND auth.role() = 'authenticated'
    AND coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );

-- Allow authenticated users to update files only inside their own folder.
DROP POLICY IF EXISTS "Profile pictures: authenticated users can update their own files" ON storage.objects;
CREATE POLICY "Profile pictures: authenticated users can update their own files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-pictures'
    AND auth.role() = 'authenticated'
    AND coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND auth.role() = 'authenticated'
    AND coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );

-- Allow authenticated users to delete files only inside their own folder.
DROP POLICY IF EXISTS "Profile pictures: authenticated users can delete their own files" ON storage.objects;
CREATE POLICY "Profile pictures: authenticated users can delete their own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-pictures'
    AND auth.role() = 'authenticated'
    AND coalesce((storage.foldername(name))[1], '') = auth.uid()::text
  );
