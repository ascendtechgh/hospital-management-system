CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date,
  age_at_registration smallint,
  sex text NOT NULL CHECK (sex IN ('male', 'female')),
  residence text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  parent_name text NOT NULL DEFAULT '',
  parent_phone text NOT NULL DEFAULT '',
  emergency_contact_name text NOT NULL DEFAULT '',
  emergency_contact_phone text NOT NULL DEFAULT '',
  insurance_enabled boolean NOT NULL DEFAULT false,
  insurance_type text CHECK (insurance_type IN ('nhis', 'other')),
  insurance_provider text,
  insurance_number text,
  insurance_expiry date,
  checked_in_at timestamptz,
  checked_in_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  checked_in_insured boolean NOT NULL DEFAULT false,
  checked_in_insurance_provider text,
  checked_in_insurance_number text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patients_name_not_blank CHECK (length(trim(full_name)) > 0),
  CONSTRAINT patients_age_range CHECK (
    age_at_registration IS NULL OR age_at_registration BETWEEN 0 AND 130
  ),
  CONSTRAINT patients_insurance_details CHECK (
    (NOT insurance_enabled AND insurance_type IS NULL AND insurance_provider IS NULL
      AND insurance_number IS NULL AND insurance_expiry IS NULL)
    OR
    (insurance_enabled AND insurance_type IS NOT NULL
      AND length(trim(coalesce(insurance_provider, ''))) > 0
      AND length(trim(coalesce(insurance_number, ''))) > 0
      AND insurance_expiry IS NOT NULL)
  ),
  CONSTRAINT patients_checkin_snapshot CHECK (
    checked_in_insured
    OR (checked_in_insurance_provider IS NULL AND checked_in_insurance_number IS NULL)
  )
);

CREATE TABLE public.hospital_insurance_providers (
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hospital_id, provider_name),
  CONSTRAINT hospital_insurance_provider_name_not_blank
    CHECK (length(trim(provider_name)) > 0)
);

CREATE INDEX patients_hospital_created_idx
  ON public.patients (hospital_id, created_at DESC);
CREATE INDEX patients_hospital_checkin_idx
  ON public.patients (hospital_id, checked_in_at DESC)
  WHERE checked_in_at IS NOT NULL;
CREATE INDEX patients_hospital_name_idx
  ON public.patients (hospital_id, full_name);

CREATE TRIGGER patients_set_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.save_hospital_insurance_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.insurance_enabled AND NEW.insurance_type = 'other' THEN
    INSERT INTO public.hospital_insurance_providers (hospital_id, provider_name)
    VALUES (NEW.hospital_id, NEW.insurance_provider)
    ON CONFLICT (hospital_id, provider_name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER patients_save_insurance_provider
  AFTER INSERT OR UPDATE OF insurance_enabled, insurance_type, insurance_provider
  ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.save_hospital_insurance_provider();

CREATE FUNCTION public.broadcast_patient_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patient public.patients;
BEGIN
  v_patient := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  PERFORM realtime.send(
    jsonb_build_object('patient_id', v_patient.id, 'operation', TG_OP),
    'patient_change',
    'hospital:' || v_patient.hospital_id || ':patients',
    true
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER patients_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_patient_change();

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_insurance_providers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.patients, public.hospital_insurance_providers
  FROM anon, authenticated;
GRANT ALL ON TABLE public.patients, public.hospital_insurance_providers TO service_role;

CREATE POLICY hospital_patients_broadcast_select
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth.uid()
        AND profile.hospital_id = split_part((SELECT realtime.topic()), ':', 2)
        AND profile.role IN (
          'hospitaladmin', 'consulting', 'nurse', 'labs', 'pharmacy', 'reception'
        )
    )
  );

COMMENT ON TABLE public.patients IS
  'Patient data is accessed only through the tenant- and role-checked patient-admin Edge Function. Realtime broadcasts contain patient IDs only.';
COMMENT ON TABLE public.hospital_insurance_providers IS
  'Hospital-scoped provider names used for patient insurance autocomplete.';
