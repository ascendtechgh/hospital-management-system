-- Preserve each check-in as a separate visit so dashboard daily-flow counts remain accurate.
-- Deliberately does not enable or add RLS; tenant access policies will be configured separately.

CREATE TABLE IF NOT EXISTS public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  checked_in_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  insured_at_checkin boolean NOT NULL DEFAULT false,
  insurance_provider_at_checkin text,
  status text NOT NULL DEFAULT 'checked_in'
    CHECK (status IN ('checked_in', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_visits_patient_hospital_fk
    FOREIGN KEY (patient_id, hospital_id)
    REFERENCES public.patients(id, hospital_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS patient_visits_hospital_checked_in_idx
  ON public.patient_visits (hospital_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS patient_visits_patient_checked_in_idx
  ON public.patient_visits (hospital_id, patient_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS patient_visits_hospital_status_idx
  ON public.patient_visits (hospital_id, status, checked_in_at DESC);

-- Preserve the latest known check-in for existing patients. Older visits cannot be reconstructed.
INSERT INTO public.patient_visits
  (hospital_id, patient_id, checked_in_by, checked_in_at, insured_at_checkin, insurance_provider_at_checkin)
SELECT hospital_id, id, checked_in_by, checked_in_at, checked_in_insured, checked_in_insurance_provider
FROM public.patients
WHERE checked_in_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add dashboard source tables to Postgres Changes so live summaries can refresh.
DO $$
DECLARE table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'patient_visits', 'patients', 'profiles', 'patient_vitals', 'consultations',
      'lab_orders', 'prescriptions', 'pharmacy_dispensations',
      'hospital_lab_inventory', 'hospital_pharmacy_inventory', 'hospitals'
    ]
    LOOP
      IF to_regclass('public.' || table_name) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = table_name
        )
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- Keep patient update and visit history insertion atomic.
CREATE OR REPLACE FUNCTION public.check_in_patient(
  p_hospital_id text,
  p_user_id uuid,
  p_patient_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_visit public.patient_visits%ROWTYPE;
  v_insured boolean;
BEGIN
  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id AND hospital_id = p_hospital_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found for this hospital.';
  END IF;

  v_insured := COALESCE(
    v_patient.insurance_enabled
    AND v_patient.insurance_expiry >= (CURRENT_DATE + INTERVAL '3 months')::date,
    false
  );

  UPDATE public.patients
  SET checked_in_at = now(),
      checked_in_by = p_user_id,
      checked_in_insured = v_insured,
      checked_in_insurance_provider = CASE WHEN v_insured THEN v_patient.insurance_provider ELSE NULL END,
      checked_in_insurance_number = CASE WHEN v_insured THEN v_patient.insurance_number ELSE NULL END
  WHERE id = p_patient_id AND hospital_id = p_hospital_id
  RETURNING * INTO v_patient;

  INSERT INTO public.patient_visits (
    hospital_id, patient_id, checked_in_by, checked_in_at,
    insured_at_checkin, insurance_provider_at_checkin
  ) VALUES (
    p_hospital_id, p_patient_id, p_user_id, v_patient.checked_in_at,
    v_insured, CASE WHEN v_insured THEN v_patient.insurance_provider ELSE NULL END
  )
  RETURNING * INTO v_visit;

  RETURN jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'visit', jsonb_build_object(
      'id', v_visit.id,
      'checked_in_at', v_visit.checked_in_at,
      'insured_at_checkin', v_visit.insured_at_checkin
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_patient(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_patient(text, uuid, uuid) TO service_role;

COMMENT ON TABLE public.patient_visits IS
  'Append-only visit/check-in history used for accurate daily arrivals and insurance-at-check-in reporting. Access policies are managed separately.';
