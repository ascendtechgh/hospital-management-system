ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles AS profile
  SET email = lower(auth_user.email)
  FROM auth.users AS auth_user
  WHERE auth_user.id = profile.id
    AND profile.email IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
      WHERE conname = 'profiles_email_key'
        AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END;
$$;
