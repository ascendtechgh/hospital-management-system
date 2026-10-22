ALTER TABLE public.diagnosis_catalog
  ADD COLUMN IF NOT EXISTS icd10_code text;

ALTER TABLE public.consultation_diagnoses
  ADD COLUMN IF NOT EXISTS clinical_status text NOT NULL DEFAULT 'Confirmed'
  CHECK (clinical_status IN ('Suspected', 'Confirmed', 'Differential'));

INSERT INTO public.diagnosis_catalog (category, name, icd10_code) VALUES
  ('Infectious & Parasitic Diseases', 'Plasmodium falciparum malaria', 'B50.9'),
  ('Cardiovascular System', 'Essential (primary) hypertension', 'I10'),
  ('Endocrine & Metabolic', 'Type 2 diabetes mellitus without complications', 'E11.9'),
  ('Respiratory System', 'Acute nasopharyngitis (common cold)', 'J00'),
  ('Respiratory System', 'Acute pharyngitis, unspecified', 'J02.9'),
  ('Digestive System', 'Infectious gastroenteritis and colitis, unspecified', 'A09'),
  ('Digestive System', 'Gastritis, unspecified', 'K29.7'),
  ('Musculoskeletal System', 'Low back pain', 'M54.5'),
  ('Genitourinary System', 'Urinary tract infection, site not specified', 'N39.0'),
  ('Skin & Subcutaneous Tissue', 'Cellulitis, unspecified', 'L03.90')
ON CONFLICT (category, name) DO UPDATE
SET icd10_code = EXCLUDED.icd10_code;

GRANT USAGE, SELECT ON SEQUENCE public.patient_mrn_seq TO service_role;
