ALTER TABLE public.patients
  ADD CONSTRAINT patients_id_hospital_unique UNIQUE (id, hospital_id);

CREATE TABLE public.patient_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients (id) ON DELETE CASCADE,
  recorded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  systolic_blood_pressure smallint NOT NULL CHECK (systolic_blood_pressure BETWEEN 40 AND 300),
  diastolic_blood_pressure smallint NOT NULL CHECK (diastolic_blood_pressure BETWEEN 20 AND 200),
  pulse_rate smallint NOT NULL CHECK (pulse_rate BETWEEN 20 AND 250),
  temperature_c numeric(4, 1) NOT NULL CHECK (temperature_c BETWEEN 25 AND 45),
  respiratory_rate smallint NOT NULL CHECK (respiratory_rate BETWEEN 4 AND 80),
  oxygen_saturation smallint NOT NULL CHECK (oxygen_saturation BETWEEN 50 AND 100),
  weight_kg numeric(6, 2) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0.2 AND 500),
  height_cm numeric(6, 2) CHECK (height_cm IS NULL OR height_cm BETWEEN 20 AND 280),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patient_vitals_patient_hospital_fk
    FOREIGN KEY (patient_id, hospital_id)
    REFERENCES public.patients (id, hospital_id)
    ON DELETE CASCADE,
  CONSTRAINT patient_vitals_blood_pressure_order
    CHECK (systolic_blood_pressure > diastolic_blood_pressure)
);

CREATE INDEX patient_vitals_patient_recorded_idx
  ON public.patient_vitals (hospital_id, patient_id, recorded_at DESC);
CREATE INDEX patient_vitals_hospital_recorded_idx
  ON public.patient_vitals (hospital_id, recorded_at DESC);

ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.patient_vitals FROM anon, authenticated;
GRANT ALL ON TABLE public.patient_vitals TO service_role;

CREATE POLICY hospital_patient_vitals_broadcast_select
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

CREATE FUNCTION public.broadcast_patient_vitals_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('patient_id', NEW.patient_id, 'operation', 'VITALS_INSERT'),
    'patient_change',
    'hospital:' || NEW.hospital_id || ':patients',
    true
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER patient_vitals_broadcast_change
  AFTER INSERT ON public.patient_vitals
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_patient_vitals_change();

COMMENT ON TABLE public.patient_vitals IS
  'Vitals are immutable observations; reads and writes are brokered through patient-admin with hospital-scoped role checks.';
