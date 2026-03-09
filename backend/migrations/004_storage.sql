-- ==============================================================================
-- 004_storage.sql
-- Create the checklist-photos storage bucket and its RLS policies
-- ==============================================================================

-- 1. Create the bucket (make it public so images can be viewed without auth tokens)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('checklist-photos', 'checklist-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if they exist (to allow re-running this script safely)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

-- 3. Create Policy: Allow anyone to view/read the photos
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT
USING (bucket_id = 'checklist-photos');

-- 4. Create Policy: Allow authenticated users to upload photos
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'checklist-photos' 
  AND auth.role() = 'authenticated'
);

-- 5. Create Policy: Allow authenticated users to update/delete (e.g., if they replace a photo before submitting)
CREATE POLICY "Auth Delete Update"
ON storage.objects FOR ALL
USING (
  bucket_id = 'checklist-photos'
  AND auth.role() = 'authenticated'
);
