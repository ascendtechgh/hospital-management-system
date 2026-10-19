CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
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
    lower(trim(NEW.email)),
    coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'phone'), ''), 'Not provided'),
    'hospitaladmin'
  );

  RETURN NEW;
END;
$$;
