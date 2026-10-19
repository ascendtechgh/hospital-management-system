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

COMMENT ON TABLE public.patient_visits IS
  'Append-only visit/check-in history used for accurate daily arrivals and insurance-at-check-in reporting. Access policies are managed separately.';
