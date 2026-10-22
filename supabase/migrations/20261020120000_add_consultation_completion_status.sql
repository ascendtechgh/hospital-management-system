ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS consultations_hospital_status_created_idx
  ON public.consultations (hospital_id, status, created_at DESC);

COMMENT ON COLUMN public.consultations.status IS
  'Clinical encounter state. Billing remains browser-local; completion is stored with the clinical encounter.';
