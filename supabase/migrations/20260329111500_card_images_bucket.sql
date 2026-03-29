-- Create storage bucket for card images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-images',
  'card-images',
  true,
  2097152, -- 2 MB
  ARRAY['image/webp', 'image/jpeg', 'image/png']
);

-- Members can upload to their org's folder
CREATE POLICY "Members upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'card-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_org_ids())
  );

-- Members can view their org's images
CREATE POLICY "Members view" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'card-images'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_org_ids())
  );

-- Uploaders or admins can delete
CREATE POLICY "Uploader or admin delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'card-images'
    AND (
      owner = auth.uid()
      OR is_org_admin_or_owner((storage.foldername(name))[1]::uuid)
    )
  );

-- Partial unique index to enforce at most one primary image per card
CREATE UNIQUE INDEX idx_images_one_primary
ON public.inventory_images(inventory_id)
WHERE is_primary = true;

-- RPC for atomic primary toggling
CREATE OR REPLACE FUNCTION public.set_primary_image(
  p_image_id UUID,
  p_inventory_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Verify the image belongs to this card and get the org_id
  SELECT organization_id INTO v_org_id
  FROM public.inventory_images
  WHERE id = p_image_id AND inventory_id = p_inventory_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Image not found for this card';
  END IF;

  -- Verify caller is a member of the org
  IF v_org_id NOT IN (SELECT public.get_user_org_ids()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Atomically unset existing primary and set the new one
  UPDATE public.inventory_images
  SET is_primary = false
  WHERE inventory_id = p_inventory_id AND is_primary = true;

  UPDATE public.inventory_images
  SET is_primary = true
  WHERE id = p_image_id;
END;
$$;

-- Cleanup orphaned storage RPC
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_storage()
RETURNS TABLE(storage_path TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.name AS storage_path
  FROM storage.objects o
  WHERE o.bucket_id = 'card-images'
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_images i
      WHERE i.storage_path = o.name
    );
$$;
