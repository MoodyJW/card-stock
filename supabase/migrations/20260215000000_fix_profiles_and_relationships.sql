-- Add email to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Robust trigger that includes email and display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill emails for existing profiles
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id;

-- Add FK to allow joining memberships -> profiles
ALTER TABLE memberships
ADD CONSTRAINT fk_memberships_profiles
FOREIGN KEY (user_id) REFERENCES profiles(user_id);
