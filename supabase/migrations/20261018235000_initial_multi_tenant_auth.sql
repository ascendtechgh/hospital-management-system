CREATE TABLE public.hospitals (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  address text NOT NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hospitals_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT hospitals_phone_not_blank CHECK (length(trim(phone)) > 0),
  CONSTRAINT hospitals_email_not_blank CHECK (length(trim(email)) > 0),
  CONSTRAINT hospitals_address_not_blank CHECK (length(trim(address)) > 0)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  role text NOT NULL DEFAULT 'hospitaladmin'
    CHECK (role IN ('superadmin', 'hospitaladmin', 'consulting', 'nurse', 'labs', 'pharmacy', 'reception')),
  hospital_id text REFERENCES public.hospitals (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_name_not_blank CHECK (length(trim(full_name)) > 0),
  CONSTRAINT profiles_phone_not_blank CHECK (length(trim(phone)) > 0),
  CONSTRAINT superadmin_has_no_hospital CHECK (role <> 'superadmin' OR hospital_id IS NULL)
);

CREATE INDEX profiles_hospital_id_idx ON public.profiles (hospital_id);

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER hospitals_set_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Hospital administrator'),
    lower(NEW.email),
    coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'phone'), ''), 'Not provided'),
    'hospitaladmin'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE FUNCTION public.create_hospital_for_current_user(
  p_name text,
  p_phone text,
  p_email text,
  p_address text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_hospital_id text;
  v_hospital_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before setting up a hospital.'
      USING ERRCODE = '28000';
  END IF;

  IF length(trim(coalesce(p_name, ''))) = 0
     OR length(trim(coalesce(p_phone, ''))) = 0
     OR length(trim(coalesce(p_email, ''))) = 0
     OR length(trim(coalesce(p_address, ''))) = 0 THEN
    RAISE EXCEPTION 'Complete all hospital details before continuing.'
      USING ERRCODE = '22023';
  END IF;

  SELECT role, hospital_id
    INTO v_role, v_hospital_id
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your account profile is not ready. Sign out and sign in again.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'hospitaladmin' THEN
    RAISE EXCEPTION 'Only a hospital administrator can create a hospital workspace.'
      USING ERRCODE = '42501';
  END IF;

  IF v_hospital_id IS NOT NULL THEN
    RAISE EXCEPTION 'Your account already belongs to a hospital.'
      USING ERRCODE = '23505';
  END IF;

  v_hospital_slug := upper(trim(both '-' FROM regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g')));
  v_hospital_slug := left(coalesce(nullif(v_hospital_slug, ''), 'HOSPITAL'), 32);
  v_hospital_id := 'HMS-' || v_hospital_slug || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.hospitals (id, name, phone, email, address, created_by)
  VALUES (
    v_hospital_id,
    trim(p_name),
    trim(p_phone),
    lower(trim(p_email)),
    trim(p_address),
    v_user_id
  );

  UPDATE public.profiles
    SET hospital_id = v_hospital_id
    WHERE id = v_user_id;

  RETURN v_hospital_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_hospital_for_current_user(text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_hospital_for_current_user(text, text, text, text)
  TO authenticated;

REVOKE ALL ON TABLE public.hospitals, public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.hospitals, public.profiles TO authenticated;

COMMENT ON TABLE public.hospitals IS
  'Development schema only: tenant isolation policies are intentionally not enabled yet. Add and verify RLS policies before production.';
COMMENT ON TABLE public.profiles IS
  'Development schema only: tenant isolation policies are intentionally not enabled yet. Add and verify RLS policies before production.';
