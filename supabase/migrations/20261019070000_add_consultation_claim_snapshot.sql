ALTER TABLE public.consultations
  ADD COLUMN nhis_eligible_at_service boolean NOT NULL DEFAULT false,
  ADD COLUMN insurance_type_snapshot text,
  ADD COLUMN insurance_provider_snapshot text,
  ADD COLUMN insurance_number_snapshot text;

ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_insurance_snapshot_consistency CHECK (
    (
      nhis_eligible_at_service
      AND insurance_type_snapshot = 'nhis'
      AND length(trim(coalesce(insurance_number_snapshot, ''))) > 0
    )
    OR (
      NOT nhis_eligible_at_service
      AND insurance_type_snapshot IS NULL
      AND insurance_provider_snapshot IS NULL
      AND insurance_number_snapshot IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.create_consultation_workflow(
  p_hospital_id text,
  p_patient_id uuid,
  p_actor_id uuid,
  p_consultation jsonb,
  p_diagnoses jsonb,
  p_lab_orders jsonb,
  p_prescriptions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_consultation_id uuid;
  v_patient public.patients;
  v_diagnosis jsonb;
  v_lab jsonb;
  v_prescription jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND hospital_id = p_hospital_id AND role = 'consulting'
  ) THEN
    RAISE EXCEPTION 'Consulting role required';
  END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE id = p_patient_id AND hospital_id = p_hospital_id
    AND checked_in_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checked-in patient not found';
  END IF;

  INSERT INTO public.consultations (
    hospital_id, patient_id, doctor_id, chief_complaint, history,
    examination, assessment, plan, nhis_eligible_at_service,
    insurance_type_snapshot, insurance_provider_snapshot, insurance_number_snapshot
  ) VALUES (
    p_hospital_id, p_patient_id, p_actor_id,
    coalesce(p_consultation->>'chief_complaint', ''),
    coalesce(p_consultation->>'history', ''),
    coalesce(p_consultation->>'examination', ''),
    coalesce(p_consultation->>'assessment', ''),
    coalesce(p_consultation->>'plan', ''),
    coalesce(v_patient.checked_in_insured AND v_patient.insurance_type = 'nhis', false)
      AND nullif(trim(v_patient.checked_in_insurance_number), '') IS NOT NULL,
    CASE WHEN coalesce(v_patient.checked_in_insured AND v_patient.insurance_type = 'nhis', false)
      AND nullif(trim(v_patient.checked_in_insurance_number), '') IS NOT NULL THEN 'nhis' END,
    CASE WHEN coalesce(v_patient.checked_in_insured AND v_patient.insurance_type = 'nhis', false)
      AND nullif(trim(v_patient.checked_in_insurance_number), '') IS NOT NULL
      THEN v_patient.checked_in_insurance_provider END,
    CASE WHEN coalesce(v_patient.checked_in_insured AND v_patient.insurance_type = 'nhis', false)
      AND nullif(trim(v_patient.checked_in_insurance_number), '') IS NOT NULL
      THEN v_patient.checked_in_insurance_number END
  ) RETURNING id INTO v_consultation_id;

  FOR v_diagnosis IN SELECT value FROM jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb))
  LOOP
    INSERT INTO public.consultation_diagnoses (consultation_id, diagnosis_id, is_primary, notes)
    VALUES (
      v_consultation_id,
      (v_diagnosis->>'diagnosis_id')::bigint,
      coalesce((v_diagnosis->>'is_primary')::boolean, false),
      coalesce(v_diagnosis->>'notes', '')
    );
  END LOOP;

  FOR v_lab IN SELECT value FROM jsonb_array_elements(coalesce(p_lab_orders, '[]'::jsonb))
  LOOP
    INSERT INTO public.lab_orders (
      hospital_id, patient_id, consultation_id, lab_code, requested_by,
      priority, request_notes
    ) VALUES (
      p_hospital_id, p_patient_id, v_consultation_id, v_lab->>'lab_code', p_actor_id,
      coalesce(v_lab->>'priority', 'routine'), coalesce(v_lab->>'request_notes', '')
    );
  END LOOP;

  FOR v_prescription IN SELECT value FROM jsonb_array_elements(coalesce(p_prescriptions, '[]'::jsonb))
  LOOP
    INSERT INTO public.prescriptions (
      hospital_id, patient_id, consultation_id, drug_code, prescribed_by,
      dose, route, frequency, duration, quantity, instructions
    ) VALUES (
      p_hospital_id, p_patient_id, v_consultation_id,
      v_prescription->>'drug_code', p_actor_id,
      v_prescription->>'dose', coalesce(v_prescription->>'route', ''),
      v_prescription->>'frequency', v_prescription->>'duration',
      (v_prescription->>'quantity')::integer, coalesce(v_prescription->>'instructions', '')
    );
  END LOOP;

  RETURN v_consultation_id;
END;
$$;
