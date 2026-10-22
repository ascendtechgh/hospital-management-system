ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_number text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE SEQUENCE IF NOT EXISTS public.patient_mrn_seq START WITH 100001;

CREATE FUNCTION public.assign_patient_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.patient_number IS NULL OR length(trim(NEW.patient_number)) = 0 THEN
    NEW.patient_number := 'MRN-' || lpad(nextval('public.patient_mrn_seq')::text, 6, '0');
  ELSE
    NEW.patient_number := upper(trim(NEW.patient_number));
  END IF;
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := trim(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_assign_patient_number ON public.patients;
CREATE TRIGGER patients_assign_patient_number
  BEFORE INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_patient_number();

CREATE UNIQUE INDEX IF NOT EXISTS patients_hospital_patient_number_unique
  ON public.patients (hospital_id, patient_number);

CREATE UNIQUE INDEX IF NOT EXISTS patients_hospital_phone_unique
  ON public.patients (hospital_id, phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

COMMENT ON COLUMN public.patients.patient_number IS
  'Hospital-scoped medical record number. Generated from a database sequence when omitted.';
COMMENT ON COLUMN public.patients.phone IS
  'Patient mobile number normalized to Ghana local format when captured.';
