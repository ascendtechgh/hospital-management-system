CREATE TABLE public.diagnosis_catalog (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  CONSTRAINT diagnosis_catalog_name_unique UNIQUE (category, name)
);

CREATE TABLE public.lab_catalog (
  code text PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  initial_stock_status text NOT NULL CHECK (initial_stock_status IN ('in_stock', 'low_stock')),
  CONSTRAINT lab_catalog_name_unique UNIQUE (category, name)
);

CREATE TABLE public.drug_catalog (
  code text PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  CONSTRAINT drug_catalog_name_unique UNIQUE (category, name)
);

INSERT INTO public.diagnosis_catalog (category, name) VALUES
('General symptoms', 'Fever'),
('General symptoms', 'Chills'),
('General symptoms', 'Weakness / Tiredness'),
('General symptoms', 'Malaise'),
('General symptoms', 'Fainting / Syncope'),
('General symptoms', 'Pain (General / Multiple Sites)'),
('General symptoms', 'Headache'),
('General symptoms', 'Dizziness / Giddiness'),
('General symptoms', 'Fatigue'),
('Infectious & Parasitic Diseases', 'Malaria'),
('Infectious & Parasitic Diseases', 'Typhoid Fever'),
('Infectious & Parasitic Diseases', 'Influenza'),
('Infectious & Parasitic Diseases', 'Whooping Cough'),
('Infectious & Parasitic Diseases', 'Viral Exanthem (e.g., Measles, Rubella)'),
('Infectious & Parasitic Diseases', 'Infectious Mononucleosis'),
('Infectious & Parasitic Diseases', 'Mumps'),
('Infectious & Parasitic Diseases', 'Chickenpox'),
('Infectious & Parasitic Diseases', 'Tuberculosis'),
('Infectious & Parasitic Diseases', 'HIV Infection / AIDS'),
('Infectious & Parasitic Diseases', 'Sepsis / Septicaemia'),
('Infectious & Parasitic Diseases', 'Tetanus'),
('Infectious & Parasitic Diseases', 'Cholera'),
('Infectious & Parasitic Diseases', 'Worm Infestation (Helminthiasis)'),
('Infectious & Parasitic Diseases', 'Schistosomiasis'),
('Infectious & Parasitic Diseases', 'Onchocerciasis'),
('Infectious & Parasitic Diseases', 'Trachoma'),
('Infectious & Parasitic Diseases', 'Scabies'),
('Infectious & Parasitic Diseases', 'Fungal Skin Infection'),
('Infectious & Parasitic Diseases', 'Candidiasis (Oral / Genital)'),
('Infectious & Parasitic Diseases', 'Viral Hepatitis'),
('Infectious & Parasitic Diseases', 'Dengue Fever'),
('Respiratory System', 'Upper Respiratory Tract Infection (URTI)'),
('Respiratory System', 'Common Cold'),
('Respiratory System', 'Influenza'),
('Respiratory System', 'Acute Pharyngitis'),
('Respiratory System', 'Acute Tonsillitis'),
('Respiratory System', 'Acute Laryngitis'),
('Respiratory System', 'Acute Sinusitis'),
('Respiratory System', 'Acute Bronchitis'),
('Respiratory System', 'Bronchiolitis'),
('Respiratory System', 'Pneumonia'),
('Respiratory System', 'Pleurisy'),
('Respiratory System', 'Chronic Obstructive Pulmonary Disease (COPD)'),
('Respiratory System', 'Asthma'),
('Respiratory System', 'Emphysema'),
('Respiratory System', 'Cough'),
('Respiratory System', 'Shortness of Breath / Dyspnoea'),
('Respiratory System', 'Wheezing'),
('Respiratory System', 'Haemoptysis (Coughing Blood)'),
('Respiratory System', 'Respiratory Tract Infection (Other)'),
('Cardiovascular System', 'Hypertension (Essential / Primary)'),
('Cardiovascular System', 'Angina Pectoris'),
('Cardiovascular System', 'Ischemic Heart Disease'),
('Cardiovascular System', 'Congestive Heart Failure'),
('Cardiovascular System', 'Myocardial Infarction (Heart Attack)'),
('Cardiovascular System', 'Palpitations'),
('Cardiovascular System', 'Atrial Fibrillation'),
('Cardiovascular System', 'Deep Vein Thrombosis (DVT)'),
('Cardiovascular System', 'Varicose Veins'),
('Cardiovascular System', 'Peripheral Arterial Disease'),
('Cardiovascular System', 'Rheumatic Heart Disease'),
('Cardiovascular System', 'Stroke / Cerebrovascular Accident (CVA)'),
('Cardiovascular System', 'Transient Ischemic Attack (TIA)'),
('Cardiovascular System', 'Phlebitis / Thrombophlebitis'),
('Cardiovascular System', 'Hypotension'),
('Cardiovascular System', 'Chest Pain (Unspecified)'),
('Gastrointestinal & Hepatobiliary System', 'Diarrhoea (Acute / Infectious)'),
('Gastrointestinal & Hepatobiliary System', 'Gastroenteritis'),
('Gastrointestinal & Hepatobiliary System', 'Dysentery (Bloody Diarrhoea)'),
('Gastrointestinal & Hepatobiliary System', 'Nausea'),
('Gastrointestinal & Hepatobiliary System', 'Vomiting'),
('Gastrointestinal & Hepatobiliary System', 'Abdominal Pain (General / Epigastric)'),
('Gastrointestinal & Hepatobiliary System', 'Gastritis'),
('Gastrointestinal & Hepatobiliary System', 'Duodenitis'),
('Gastrointestinal & Hepatobiliary System', 'Peptic Ulcer Disease (Gastric / Duodenal)'),
('Gastrointestinal & Hepatobiliary System', 'Gastroesophageal Reflux Disease (GORD / GERD)'),
('Gastrointestinal & Hepatobiliary System', 'Dyspepsia / Indigestion'),
('Gastrointestinal & Hepatobiliary System', 'Constipation'),
('Gastrointestinal & Hepatobiliary System', 'Irritable Bowel Syndrome (IBS)'),
('Gastrointestinal & Hepatobiliary System', 'Appendicitis'),
('Gastrointestinal & Hepatobiliary System', 'Diverticular Disease'),
('Gastrointestinal & Hepatobiliary System', 'Anal Fissure'),
('Gastrointestinal & Hepatobiliary System', 'Perianal Abscess'),
('Gastrointestinal & Hepatobiliary System', 'Haemorrhoids (Piles)'),
('Gastrointestinal & Hepatobiliary System', 'Cholecystitis'),
('Gastrointestinal & Hepatobiliary System', 'Cholelithiasis (Gallstones)'),
('Gastrointestinal & Hepatobiliary System', 'Hepatitis (Infectious / Alcoholic)'),
('Gastrointestinal & Hepatobiliary System', 'Cirrhosis'),
('Gastrointestinal & Hepatobiliary System', 'Ascites'),
('Gastrointestinal & Hepatobiliary System', 'Food Poisoning'),
('Gastrointestinal & Hepatobiliary System', 'Intestinal Obstruction'),
('Gastrointestinal & Hepatobiliary System', 'Mouth Ulcer (Aphthous Ulcer)'),
('Gastrointestinal & Hepatobiliary System', 'Gingivitis'),
('Gastrointestinal & Hepatobiliary System', 'Periodontitis'),
('Gastrointestinal & Hepatobiliary System', 'Dental Caries'),
('Gastrointestinal & Hepatobiliary System', 'Stomatitis'),
('Gastrointestinal & Hepatobiliary System', 'Halitosis (Bad Breath)'),
('Gastrointestinal & Hepatobiliary System', 'Pruritus Ani'),
('Genitourinary System', 'Urinary Tract Infection (UTI)'),
('Genitourinary System', 'Cystitis'),
('Genitourinary System', 'Pyelonephritis'),
('Genitourinary System', 'Urethritis'),
('Genitourinary System', 'Dysuria (Painful Urination)'),
('Genitourinary System', 'Urinary Frequency / Urgency'),
('Genitourinary System', 'Haematuria (Blood in Urine)'),
('Genitourinary System', 'Urinary Retention'),
('Genitourinary System', 'Kidney Stones (Renal Colic)'),
('Genitourinary System', 'Prostatitis'),
('Genitourinary System', 'Benign Prostatic Hyperplasia (BPH)'),
('Genitourinary System', 'Orchitis'),
('Genitourinary System', 'Epididymitis'),
('Genitourinary System', 'Balanitis'),
('Genitourinary System', 'Sexually Transmitted Infection (STI)'),
('Genitourinary System', 'Gonorrhoea'),
('Genitourinary System', 'Syphilis'),
('Genitourinary System', 'Pelvic Inflammatory Disease (PID)'),
('Genitourinary System', 'Vaginitis / Vulvitis'),
('Genitourinary System', 'Vaginal Discharge'),
('Genitourinary System', 'Menstrual Disorders'),
('Genitourinary System', 'Dysmenorrhoea'),
('Genitourinary System', 'Infertility'),
('Musculoskeletal & Connective Tissue', 'Rheumatism'),
('Musculoskeletal & Connective Tissue', 'Arthritis (Osteoarthritis / Rheumatoid)'),
('Musculoskeletal & Connective Tissue', 'Joint Pain (Arthralgia)'),
('Musculoskeletal & Connective Tissue', 'Back Pain (Low Back / Dorsalgia)'),
('Musculoskeletal & Connective Tissue', 'Neck Pain'),
('Musculoskeletal & Connective Tissue', 'Spondylosis'),
('Musculoskeletal & Connective Tissue', 'Myalgia (Muscle Pain)'),
('Musculoskeletal & Connective Tissue', 'Fibromyalgia'),
('Musculoskeletal & Connective Tissue', 'Gout'),
('Musculoskeletal & Connective Tissue', 'Soft Tissue Disorder'),
('Musculoskeletal & Connective Tissue', 'Sprain / Strain'),
('Musculoskeletal & Connective Tissue', 'Fracture'),
('Musculoskeletal & Connective Tissue', 'Dislocation'),
('Musculoskeletal & Connective Tissue', 'Bursitis'),
('Musculoskeletal & Connective Tissue', 'Tendinitis'),
('Musculoskeletal & Connective Tissue', 'Carpal Tunnel Syndrome'),
('Musculoskeletal & Connective Tissue', 'Systemic Lupus Erythematosus (SLE)'),
('Neurological & Psychiatric', 'Epilepsy / Seizures'),
('Neurological & Psychiatric', 'Migraine'),
('Neurological & Psychiatric', 'Tension Headache'),
('Neurological & Psychiatric', 'Neuralgia'),
('Neurological & Psychiatric', 'Neuropathy (Peripheral)'),
('Neurological & Psychiatric', 'Meningitis'),
('Neurological & Psychiatric', 'Encephalitis'),
('Neurological & Psychiatric', 'Paralysis / Weakness'),
('Neurological & Psychiatric', 'Tremor'),
('Neurological & Psychiatric', 'Multiple Sclerosis'),
('Neurological & Psychiatric', 'Parkinson''s Disease'),
('Neurological & Psychiatric', 'Anxiety Disorder'),
('Neurological & Psychiatric', 'Depression'),
('Neurological & Psychiatric', 'Insomnia / Sleep Disorder'),
('Neurological & Psychiatric', 'Psychosis'),
('Neurological & Psychiatric', 'Substance Abuse (Alcohol / Drug)'),
('Neurological & Psychiatric', 'Dementia'),
('Neurological & Psychiatric', 'Delirium'),
('Neurological & Psychiatric', 'Mental Health Disorder (Other)'),
('Endocrine & Metabolic', 'Diabetes Mellitus (Type 1 & Type 2)'),
('Endocrine & Metabolic', 'Hypothyroidism'),
('Endocrine & Metabolic', 'Hyperthyroidism'),
('Endocrine & Metabolic', 'Thyroid Nodule / Goitre'),
('Endocrine & Metabolic', 'Obesity'),
('Endocrine & Metabolic', 'Hyperlipidaemia'),
('Endocrine & Metabolic', 'Electrolyte Imbalance'),
('Endocrine & Metabolic', 'Dehydration'),
('Endocrine & Metabolic', 'Malnutrition'),
('Endocrine & Metabolic', 'Vitamin Deficiency (e.g., Vitamin D, B12)'),
('Endocrine & Metabolic', 'Iron Deficiency Anaemia'),
('Endocrine & Metabolic', 'Anaemia (Other / Unspecified)'),
('Endocrine & Metabolic', 'Gout (Metabolic)'),
('Skin & Subcutaneous Tissue', 'Dermatitis / Eczema'),
('Skin & Subcutaneous Tissue', 'Psoriasis'),
('Skin & Subcutaneous Tissue', 'Acne Vulgaris'),
('Skin & Subcutaneous Tissue', 'Urticaria (Hives)'),
('Skin & Subcutaneous Tissue', 'Skin Abscess'),
('Skin & Subcutaneous Tissue', 'Boil / Carbuncle'),
('Skin & Subcutaneous Tissue', 'Cellulitis'),
('Skin & Subcutaneous Tissue', 'Impetigo'),
('Skin & Subcutaneous Tissue', 'Fungal Infection (Tinea)'),
('Skin & Subcutaneous Tissue', 'Vitiligo'),
('Skin & Subcutaneous Tissue', 'Hyperpigmentation'),
('Skin & Subcutaneous Tissue', 'Pruritus (Itching)'),
('Skin & Subcutaneous Tissue', 'Localised Swelling / Lump'),
('Skin & Subcutaneous Tissue', 'Skin Ulcer'),
('Skin & Subcutaneous Tissue', 'Ingrowing Toenail'),
('Skin & Subcutaneous Tissue', 'Corn / Callus'),
('Skin & Subcutaneous Tissue', 'Wart'),
('Skin & Subcutaneous Tissue', 'Mole (Naevus)'),
('Skin & Subcutaneous Tissue', 'Sunburn'),
('Eye & Ear', 'Conjunctivitis (Red Eye)'),
('Eye & Ear', 'Cataract'),
('Eye & Ear', 'Glaucoma'),
('Eye & Ear', 'Refractive Error'),
('Eye & Ear', 'Eye Pain'),
('Eye & Ear', 'Blurred Vision'),
('Eye & Ear', 'Eye Discharge'),
('Eye & Ear', 'Stye (Hordeolum)'),
('Eye & Ear', 'Chalazion'),
('Eye & Ear', 'Dry Eye'),
('Eye & Ear', 'Trachoma'),
('Eye & Ear', 'Otitis Externa (Swimmer''s Ear)'),
('Eye & Ear', 'Otitis Media (Ear Infection)'),
('Eye & Ear', 'Earache'),
('Eye & Ear', 'Ear Wax Impaction'),
('Eye & Ear', 'Tinnitus (Ringing in Ears)'),
('Eye & Ear', 'Vertigo'),
('Eye & Ear', 'Perforated Eardrum'),
('Injuries & Trauma', 'Road Traffic Accident (RTA) Injury'),
('Injuries & Trauma', 'Fracture (Various Sites)'),
('Injuries & Trauma', 'Sprain / Strain'),
('Injuries & Trauma', 'Contusion / Bruise'),
('Injuries & Trauma', 'Open Wound'),
('Injuries & Trauma', 'Laceration'),
('Injuries & Trauma', 'Burn'),
('Injuries & Trauma', 'Head Injury'),
('Injuries & Trauma', 'Concussion'),
('Injuries & Trauma', 'Foreign Body (Eye / Ear / Nose)'),
('Injuries & Trauma', 'Insect Bite / Sting'),
('Injuries & Trauma', 'Snake Bite'),
('Injuries & Trauma', 'Poisoning (Accidental / Intentional)'),
('Injuries & Trauma', 'Near Drowning'),
('Injuries & Trauma', 'Electric Shock'),
('Pregnancy & Reproductive Health', 'Pregnancy (Normal / Antenatal)'),
('Pregnancy & Reproductive Health', 'Pregnancy-Induced Hypertension (PIH)'),
('Pregnancy & Reproductive Health', 'Gestational Diabetes'),
('Pregnancy & Reproductive Health', 'Anaemia in Pregnancy'),
('Pregnancy & Reproductive Health', 'Hyperemesis Gravidarum'),
('Pregnancy & Reproductive Health', 'Antepartum Haemorrhage'),
('Pregnancy & Reproductive Health', 'Ectopic Pregnancy'),
('Pregnancy & Reproductive Health', 'Spontaneous Abortion'),
('Pregnancy & Reproductive Health', 'Induced Abortion'),
('Pregnancy & Reproductive Health', 'Post-Abortion Complication'),
('Pregnancy & Reproductive Health', 'Puerperal Sepsis'),
('Pregnancy & Reproductive Health', 'Mastitis'),
('Pregnancy & Reproductive Health', 'Contraception Counselling'),
('Pregnancy & Reproductive Health', 'Family Planning'),
('Pregnancy & Reproductive Health', 'Menopause Symptoms'),
('Oral & Dental', 'Dental Caries (Tooth Decay)'),
('Oral & Dental', 'Gingivitis'),
('Oral & Dental', 'Periodontitis'),
('Oral & Dental', 'Tooth Abscess'),
('Oral & Dental', 'Mouth Ulcer'),
('Oral & Dental', 'Stomatitis'),
('Oral & Dental', 'Teething'),
('Oral & Dental', 'Halitosis'),
('Oral & Dental', 'Jaw Pain (TMJ Disorder)'),
('Haematological & Lymphatic', 'Anaemia (Iron Deficiency)'),
('Haematological & Lymphatic', 'Anaemia (Other)'),
('Haematological & Lymphatic', 'Lymphadenitis'),
('Haematological & Lymphatic', 'Lymphadenopathy'),
('Haematological & Lymphatic', 'Bleeding Disorder'),
('Haematological & Lymphatic', 'Thrombocytopenia'),
('Haematological & Lymphatic', 'Sickle Cell Disease (Pain Crisis)'),
('Haematological & Lymphatic', 'Haemophilia'),
('Other & Ill-Defined Conditions', 'Health Maintenance / Prevention'),
('Other & Ill-Defined Conditions', 'Allergy / Allergic Reaction'),
('Other & Ill-Defined Conditions', 'Adverse Drug Reaction'),
('Other & Ill-Defined Conditions', 'Convalescence'),
('Other & Ill-Defined Conditions', 'Chronic Pain Syndrome'),
('Other & Ill-Defined Conditions', 'Palliative Care'),
('Other & Ill-Defined Conditions', 'Social Problem'),
('Other & Ill-Defined Conditions', 'Relationship Problem'),
('Other & Ill-Defined Conditions', 'Unspecified Illness');

INSERT INTO public.lab_catalog (code, category, name, initial_stock_status) VALUES
('LAB-003', 'Hematology / Blood Bank', 'Blood Film MPS', 'in_stock'),
('LAB-006', 'Hematology / Blood Bank', 'Blood Group', 'low_stock'),
('LAB-002', 'Hematology / Blood Bank', 'FBC', 'low_stock'),
('LAB-007', 'Hematology / Blood Bank', 'G6PD', 'low_stock'),
('LAB-001', 'Hematology / Blood Bank', 'HB', 'in_stock'),
('LAB-005', 'Hematology / Blood Bank', 'Sickling', 'low_stock'),
('LAB-016', 'Chemistry / Metabolic', 'FBS/RBS', 'in_stock'),
('LAB-018', 'Chemistry / Metabolic', 'Serum Protein Test', 'low_stock'),
('LAB-009', 'Serology / Immunology / Virology', 'HBsAg', 'low_stock'),
('LAB-010', 'Serology / Immunology / Virology', 'Hepatitis C', 'low_stock'),
('LAB-008', 'Serology / Immunology / Virology', 'Retro Screen', 'low_stock'),
('LAB-011', 'Serology / Immunology / Virology', 'VDRL', 'low_stock'),
('LAB-012', 'Serology / Immunology / Virology', 'Widal/Typhoid', 'low_stock'),
('LAB-015', 'Microbiology / STI', 'Gonorrhoea', 'low_stock'),
('LAB-014', 'Microbiology / STI', 'H. Pylori', 'low_stock'),
('LAB-004', 'Parasitology', 'RDT Malaria', 'in_stock'),
('LAB-017', 'Urinalysis', 'Urine Protein Test', 'low_stock'),
('LAB-013', 'Urinalysis', 'Urine R/E', 'low_stock'),
('LAB-019', 'Antenatal / Mixed Panel', 'Full ANC Package', 'low_stock');

INSERT INTO public.drug_catalog (code, category, name) VALUES
('PH-004', 'Tablets', 'Albendazole 400mg'),
('PH-006', 'Tablets', 'Amlodipine 10mg'),
('PH-005', 'Tablets', 'Amlodipine 5mg'),
('PH-007', 'Tablets', 'Amoxiclav 625mg'),
('PH-002', 'Tablets', 'Art/Amodiaquine 100/270'),
('PH-003', 'Tablets', 'Art/Amodiaquine 50/135'),
('PH-001', 'Tablets', 'Art/Lumefantrine 20/120'),
('PH-010', 'Tablets', 'Art/Lumefantrine Disp'),
('PH-009', 'Tablets', 'Ascorbic Acid'),
('PH-008', 'Tablets', 'Aspirin 75mg'),
('PH-013', 'Tablets', 'Atorvastatin 20mg'),
('PH-040', 'Tablets', 'Azithromycin 250mg'),
('PH-041', 'Tablets', 'Azithromycin 500mg'),
('PH-011', 'Tablets', 'Bendroflumethiazide 2.5mg'),
('PH-037', 'Tablets', 'Buscopan'),
('PH-014', 'Tablets', 'Cefuroxime 250mg'),
('PH-015', 'Tablets', 'Cefuroxime 500mg'),
('PH-016', 'Tablets', 'Cetirizine 10mg'),
('PH-039', 'Tablets', 'Ciprofloxacin 250mg'),
('PH-017', 'Tablets', 'Clarithromycin 500mg'),
('PH-012', 'Tablets', 'Co-Trimoxazole'),
('PH-018', 'Tablets', 'Diazepam 10mg'),
('PH-019', 'Tablets', 'Diclofenac 50mg'),
('PH-020', 'Tablets', 'Diclofenac 75mg'),
('PH-021', 'Tablets', 'Fersolate'),
('PH-043', 'Tablets', 'Folic Acid'),
('PH-022', 'Tablets', 'Furosemide'),
('PH-038', 'Tablets', 'Glibenclamide'),
('PH-023', 'Tablets', 'Ibuprofen 200mg'),
('PH-024', 'Tablets', 'Ibuprofen 400mg'),
('PH-025', 'Tablets', 'Lisinopril 10mg'),
('PH-026', 'Tablets', 'Losartan 50mg'),
('PH-042', 'Tablets', 'Mebendazole'),
('PH-030', 'Tablets', 'Metformin 500mg'),
('PH-027', 'Tablets', 'Metronidazole 200mg'),
('PH-028', 'Tablets', 'Metronidazole 400mg'),
('PH-029', 'Tablets', 'Multivitamin'),
('PH-031', 'Tablets', 'Nifedipine 20mg'),
('PH-032', 'Tablets', 'Nifedipine 30mg'),
('PH-033', 'Tablets', 'Paracetamol 500mg'),
('PH-034', 'Tablets', 'Zinc 10mg'),
('PH-035', 'Tablets', 'Zinc 20mg'),
('PH-036', 'Tablets', 'Zincovit'),
('PH-044', 'Capsules', 'Amoxicillin 250mg'),
('PH-045', 'Capsules', 'Amoxicillin 500mg'),
('PH-052', 'Capsules', 'Clindamycin 150mg'),
('PH-049', 'Capsules', 'Clindamycin 300mg'),
('PH-050', 'Capsules', 'Doxycycline 100mg'),
('PH-046', 'Capsules', 'Flucloxacillin 250mg'),
('PH-051', 'Capsules', 'Fluconazole 150mg'),
('PH-047', 'Capsules', 'Iron III Polymaltose'),
('PH-048', 'Capsules', 'Omeprazole 20mg'),
('PH-053', 'Capsules', 'Tramadol'),
('PH-069', 'Syrups / Oral liquids / Linctus — bottles', 'Amoxicillin Syrup'),
('PH-055', 'Syrups / Oral liquids / Linctus — bottles', 'Amoxiclav 228mg'),
('PH-056', 'Syrups / Oral liquids / Linctus — bottles', 'Amoxiclav 457mg'),
('PH-057', 'Syrups / Oral liquids / Linctus — bottles', 'Azithromycin Syrup'),
('PH-074', 'Syrups / Oral liquids / Linctus — bottles', 'Carbocistein A'),
('PH-075', 'Syrups / Oral liquids / Linctus — bottles', 'Carbocistein P'),
('PH-058', 'Syrups / Oral liquids / Linctus — bottles', 'Cefuroxime Syrup'),
('PH-059', 'Syrups / Oral liquids / Linctus — bottles', 'Cetirizine Syrup'),
('PH-070', 'Syrups / Oral liquids / Linctus — bottles', 'Co-Trimoxazole Syrup'),
('PH-068', 'Syrups / Oral liquids / Linctus — bottles', 'Cough Linctus A'),
('PH-067', 'Syrups / Oral liquids / Linctus — bottles', 'Cough Linctus P'),
('PH-061', 'Syrups / Oral liquids / Linctus — bottles', 'Diphenhydramine A'),
('PH-060', 'Syrups / Oral liquids / Linctus — bottles', 'Diphenhydramine P'),
('PH-054', 'Syrups / Oral liquids / Linctus — bottles', 'Flucloxacillin Syrup'),
('PH-062', 'Syrups / Oral liquids / Linctus — bottles', 'Ibuprofen Syrup'),
('PH-066', 'Syrups / Oral liquids / Linctus — bottles', 'Iron III Polymaltose Syrup'),
('PH-063', 'Syrups / Oral liquids / Linctus — bottles', 'Metronidazole Syrup'),
('PH-071', 'Syrups / Oral liquids / Linctus — bottles', 'MMT'),
('PH-064', 'Syrups / Oral liquids / Linctus — bottles', 'Multivitamin Syrup'),
('PH-065', 'Syrups / Oral liquids / Linctus — bottles', 'Paracetamol Syrup'),
('PH-073', 'Syrups / Oral liquids / Linctus — bottles', 'Vitamin C Syrup'),
('PH-083', 'Injections — Ampoules', 'Artemether 80mg'),
('PH-099', 'Injections — Ampoules', 'ATS'),
('PH-094', 'Injections — Ampoules', 'Buscopan 20mg Inj'),
('PH-091', 'Injections — Ampoules', 'Clindamycin 300mg Inj'),
('PH-105', 'Injections — Ampoules', 'Diazepam 10mg Inj'),
('PH-092', 'Injections — Ampoules', 'Diclofenac 75mg Inj'),
('PH-106', 'Injections — Ampoules', 'Furosemide 20mg Inj'),
('PH-095', 'Injections — Ampoules', 'Gentamycin 80mg'),
('PH-097', 'Injections — Ampoules', 'Metoclopramide'),
('PH-102', 'Injections — Ampoules', 'Promethazine'),
('PH-104', 'Injections — Ampoules', 'Tramadol 50mg Inj'),
('PH-103', 'Injections — Ampoules', 'Tranexamic Acid'),
('PH-100', 'Injections — Ampoules', 'Water for Injection'),
('PH-086', 'Injections — Vials', 'Artesunate 120mg'),
('PH-084', 'Injections — Vials', 'Artesunate 30mg'),
('PH-085', 'Injections — Vials', 'Artesunate 60mg'),
('PH-098', 'Injections — Vials', 'Benzathine Penicillin'),
('PH-088', 'Injections — Vials', 'Ceftriaxone 1g'),
('PH-087', 'Injections — Vials', 'Cefuroxime 750mg'),
('PH-089', 'Injections — Vials', 'Ciprofloxacin 200mg'),
('PH-082', 'Injections — Vials', 'Dextrose 50%'),
('PH-096', 'Injections — Vials', 'Hydrocortisone 100mg'),
('PH-079', 'Injections — Vials', 'IV Paracetamol'),
('PH-101', 'Injections — Vials', 'Lidocaine 25%'),
('PH-093', 'Injections — Vials', 'Omeprazole 40mg Inj'),
('PH-078', 'IV Fluids / Bags', 'Dextrose 5%'),
('PH-077', 'IV Fluids / Bags', 'DNS'),
('PH-090', 'IV Fluids / Bags', 'Metronidazole 500mg'),
('PH-080', 'IV Fluids / Bags', 'Ringers Lactate'),
('PH-081', 'IV Fluids / Bags', 'Sodium Chloride'),
('PH-107', 'Creams / Ointments / Topicals — tubes', 'Clotrimazole Cream 1%'),
('PH-108', 'Creams / Ointments / Topicals — tubes', 'Clotrimazole Cream 2%'),
('PH-122', 'Creams / Ointments / Topicals — tubes', 'Dreg Ointment Big'),
('PH-114', 'Creams / Ointments / Topicals — tubes', 'Dreg Ointment Small'),
('PH-121', 'Creams / Ointments / Topicals — tubes', 'Hydrocortisone Cream'),
('PH-116', 'Creams / Ointments / Topicals — tubes', 'Mupirocin Cream'),
('PH-124', 'Creams / Ointments / Topicals — tubes', 'Tetracycline Eye Ointment'),
('PH-113', 'Eye / Nasal Drops — bottles', 'Chloramphenicol Eye Drop'),
('PH-112', 'Eye / Nasal Drops — bottles', 'Ciprofloxacin Eye Drop'),
('PH-111', 'Eye / Nasal Drops — bottles', 'Gentamycin Eye Drop'),
('PH-125', 'Eye / Nasal Drops — bottles', 'Ephedrine Nasal Drop 0.5%'),
('PH-126', 'Eye / Nasal Drops — bottles', 'Ephedrine Nasal Drop 1%'),
('PH-117', 'Eye / Nasal Drops — bottles', 'Saline Nasal Drop'),
('PH-115', 'Topical Solutions — bottles', 'Dreg Solution Big'),
('PH-123', 'Topical Solutions — bottles', 'Dreg Solution Small'),
('PH-120', 'Suppositories', 'Supp Diclofenac 100mg'),
('PH-118', 'Suppositories', 'Supp Paracetamol 125mg'),
('PH-119', 'Suppositories', 'Supp Paracetamol 250mg'),
('PH-109', 'Packs / Pessaries / Ovules', 'Clotrimazole Vaginal Pess'),
('PH-110', 'Packs / Pessaries / Ovules', 'Miconazole Ovules'),
('PH-076', 'Packs / Pessaries / Ovules', 'Tottema 10 ampoules'),
('PH-072', 'Sachets', 'ORS'),
('PH-127', 'Nebules', 'Salbutamol Nebules');

CREATE TABLE public.hospital_lab_inventory (
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  lab_code text NOT NULL REFERENCES public.lab_catalog (code) ON DELETE RESTRICT,
  quantity_on_hand integer NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level integer NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  demo_stock boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hospital_id, lab_code)
);

CREATE TABLE public.hospital_pharmacy_inventory (
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  drug_code text NOT NULL REFERENCES public.drug_catalog (code) ON DELETE RESTRICT,
  quantity_on_hand integer NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level integer NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  demo_stock boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hospital_id, drug_code)
);

CREATE TABLE public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  chief_complaint text NOT NULL DEFAULT '',
  history text NOT NULL DEFAULT '',
  examination text NOT NULL DEFAULT '',
  assessment text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultations_patient_hospital_fk
    FOREIGN KEY (patient_id, hospital_id)
    REFERENCES public.patients (id, hospital_id) ON DELETE CASCADE,
  CONSTRAINT consultations_id_patient_hospital_unique
    UNIQUE (id, patient_id, hospital_id)
);

CREATE TABLE public.consultation_diagnoses (
  consultation_id uuid NOT NULL REFERENCES public.consultations (id) ON DELETE CASCADE,
  diagnosis_id bigint NOT NULL REFERENCES public.diagnosis_catalog (id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  PRIMARY KEY (consultation_id, diagnosis_id)
);

CREATE TABLE public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  consultation_id uuid NOT NULL,
  lab_code text NOT NULL REFERENCES public.lab_catalog (code) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  request_notes text NOT NULL DEFAULT '',
  result_value text NOT NULL DEFAULT '',
  result_notes text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  completed_at timestamptz,
  CONSTRAINT lab_orders_patient_hospital_fk
    FOREIGN KEY (patient_id, hospital_id)
    REFERENCES public.patients (id, hospital_id) ON DELETE CASCADE,
  CONSTRAINT lab_orders_consultation_patient_hospital_fk
    FOREIGN KEY (consultation_id, patient_id, hospital_id)
    REFERENCES public.consultations (id, patient_id, hospital_id) ON DELETE CASCADE
);

CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  consultation_id uuid NOT NULL,
  drug_code text NOT NULL REFERENCES public.drug_catalog (code) ON DELETE RESTRICT,
  prescribed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  dose text NOT NULL,
  route text NOT NULL DEFAULT '',
  frequency text NOT NULL,
  duration text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  instructions text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'dispensed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prescriptions_patient_hospital_fk
    FOREIGN KEY (patient_id, hospital_id)
    REFERENCES public.patients (id, hospital_id) ON DELETE CASCADE,
  CONSTRAINT prescriptions_consultation_patient_hospital_fk
    FOREIGN KEY (consultation_id, patient_id, hospital_id)
    REFERENCES public.consultations (id, patient_id, hospital_id) ON DELETE CASCADE,
  CONSTRAINT prescriptions_id_hospital_unique UNIQUE (id, hospital_id)
);

CREATE TABLE public.pharmacy_dispensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  dispensed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  notes text NOT NULL DEFAULT '',
  dispensed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pharmacy_dispensations_prescription_hospital_fk
    FOREIGN KEY (prescription_id, hospital_id)
    REFERENCES public.prescriptions (id, hospital_id) ON DELETE CASCADE
);

CREATE TABLE public.clinical_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text NOT NULL REFERENCES public.hospitals (id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('lab', 'drug')),
  item_code text NOT NULL,
  quantity_change integer NOT NULL CHECK (quantity_change <> 0),
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consultations_patient_history_idx
  ON public.consultations (hospital_id, patient_id, created_at DESC);
CREATE INDEX lab_orders_queue_idx ON public.lab_orders (hospital_id, status, priority, requested_at);
CREATE INDEX prescriptions_queue_idx ON public.prescriptions (hospital_id, status, created_at);
CREATE INDEX pharmacy_dispensations_patient_idx
  ON public.pharmacy_dispensations (hospital_id, prescription_id, dispensed_at DESC);

INSERT INTO public.hospital_lab_inventory
  (hospital_id, lab_code, quantity_on_hand, reorder_level, demo_stock)
SELECT hospitals.id, labs.code,
  CASE labs.initial_stock_status WHEN 'in_stock' THEN 20 ELSE 5 END,
  5, true
FROM public.hospitals AS hospitals
CROSS JOIN public.lab_catalog AS labs;

INSERT INTO public.hospital_pharmacy_inventory
  (hospital_id, drug_code, quantity_on_hand, reorder_level, demo_stock)
SELECT hospitals.id, drugs.code, 20, 5, true
FROM public.hospitals AS hospitals
CROSS JOIN public.drug_catalog AS drugs;

CREATE FUNCTION public.initialize_clinical_inventory_for_hospital()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.hospital_lab_inventory
    (hospital_id, lab_code, quantity_on_hand, reorder_level, demo_stock)
  SELECT NEW.id, code,
    CASE initial_stock_status WHEN 'in_stock' THEN 20 ELSE 5 END, 5, true
  FROM public.lab_catalog
  ON CONFLICT (hospital_id, lab_code) DO NOTHING;

  INSERT INTO public.hospital_pharmacy_inventory
    (hospital_id, drug_code, quantity_on_hand, reorder_level, demo_stock)
  SELECT NEW.id, code, 20, 5, true
  FROM public.drug_catalog
  ON CONFLICT (hospital_id, drug_code) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hospitals_initialize_clinical_inventory
  AFTER INSERT ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.initialize_clinical_inventory_for_hospital();

CREATE FUNCTION public.create_consultation_workflow(
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
  IF NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND hospital_id = p_hospital_id AND checked_in_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Checked-in patient not found';
  END IF;

  INSERT INTO public.consultations (
    hospital_id, patient_id, doctor_id, chief_complaint, history,
    examination, assessment, plan
  ) VALUES (
    p_hospital_id, p_patient_id, p_actor_id,
    coalesce(p_consultation->>'chief_complaint', ''),
    coalesce(p_consultation->>'history', ''),
    coalesce(p_consultation->>'examination', ''),
    coalesce(p_consultation->>'assessment', ''),
    coalesce(p_consultation->>'plan', '')
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

CREATE FUNCTION public.record_lab_result(
  p_hospital_id text, p_actor_id uuid, p_order_id uuid,
  p_result_value text, p_result_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND hospital_id = p_hospital_id AND role = 'labs'
  ) THEN
    RAISE EXCEPTION 'Laboratory role required';
  END IF;
  UPDATE public.lab_orders
  SET result_value = p_result_value, result_notes = p_result_notes,
      status = 'completed', completed_by = p_actor_id, completed_at = now()
  WHERE id = p_order_id AND hospital_id = p_hospital_id
    AND status IN ('pending', 'in_progress');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open laboratory order not found';
  END IF;
END;
$$;

CREATE FUNCTION public.add_clinical_inventory_stock(
  p_hospital_id text, p_actor_id uuid, p_item_type text,
  p_item_code text, p_quantity integer, p_reorder_level integer,
  p_replace_demo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous integer;
  v_was_demo boolean := false;
  v_change integer;
  v_reason text := 'stock_received';
BEGIN
  IF p_replace_demo IS NULL OR p_quantity < 0
    OR (p_quantity = 0 AND NOT p_replace_demo) OR p_reorder_level < 0 THEN
    RAISE EXCEPTION 'Enter valid stock quantities';
  END IF;
  IF p_item_type = 'lab' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_actor_id AND hospital_id = p_hospital_id AND role IN ('labs', 'hospitaladmin')
    ) THEN RAISE EXCEPTION 'Laboratory inventory role required'; END IF;
    SELECT quantity_on_hand, demo_stock INTO v_previous, v_was_demo
    FROM public.hospital_lab_inventory
    WHERE hospital_id = p_hospital_id AND lab_code = p_item_code
    FOR UPDATE;
    INSERT INTO public.hospital_lab_inventory AS inventory
      (hospital_id, lab_code, quantity_on_hand, reorder_level, demo_stock)
    VALUES (p_hospital_id, p_item_code, p_quantity, p_reorder_level, false)
    ON CONFLICT (hospital_id, lab_code) DO UPDATE SET
      quantity_on_hand = CASE
        WHEN p_replace_demo AND inventory.demo_stock THEN EXCLUDED.quantity_on_hand
        ELSE inventory.quantity_on_hand + EXCLUDED.quantity_on_hand
      END,
      reorder_level = EXCLUDED.reorder_level, demo_stock = false, updated_at = now();
  ELSIF p_item_type = 'drug' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_actor_id AND hospital_id = p_hospital_id AND role IN ('pharmacy', 'hospitaladmin')
    ) THEN RAISE EXCEPTION 'Pharmacy inventory role required'; END IF;
    SELECT quantity_on_hand, demo_stock INTO v_previous, v_was_demo
    FROM public.hospital_pharmacy_inventory
    WHERE hospital_id = p_hospital_id AND drug_code = p_item_code
    FOR UPDATE;
    INSERT INTO public.hospital_pharmacy_inventory AS inventory
      (hospital_id, drug_code, quantity_on_hand, reorder_level, demo_stock)
    VALUES (p_hospital_id, p_item_code, p_quantity, p_reorder_level, false)
    ON CONFLICT (hospital_id, drug_code) DO UPDATE SET
      quantity_on_hand = CASE
        WHEN p_replace_demo AND inventory.demo_stock THEN EXCLUDED.quantity_on_hand
        ELSE inventory.quantity_on_hand + EXCLUDED.quantity_on_hand
      END,
      reorder_level = EXCLUDED.reorder_level, demo_stock = false, updated_at = now();
  ELSE
    RAISE EXCEPTION 'Unsupported inventory type';
  END IF;
  v_change := CASE
    WHEN p_replace_demo AND v_was_demo THEN p_quantity - v_previous
    ELSE p_quantity
  END;
  IF p_replace_demo AND v_was_demo THEN v_reason := 'demo_stock_reconciled'; END IF;
  IF v_change <> 0 THEN
    INSERT INTO public.clinical_inventory_movements
      (hospital_id, item_type, item_code, quantity_change, reason, changed_by)
    VALUES (p_hospital_id, p_item_type, p_item_code, v_change, v_reason, p_actor_id);
  END IF;
END;
$$;

CREATE FUNCTION public.dispense_prescription(
  p_hospital_id text, p_actor_id uuid, p_prescription_id uuid,
  p_quantity integer, p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prescription public.prescriptions;
  v_inventory public.hospital_pharmacy_inventory;
  v_dispensed integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id AND hospital_id = p_hospital_id AND role = 'pharmacy'
  ) THEN RAISE EXCEPTION 'Pharmacy role required'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Dispense quantity must be positive'; END IF;

  SELECT * INTO v_prescription FROM public.prescriptions
  WHERE id = p_prescription_id AND hospital_id = p_hospital_id
    AND status IN ('pending', 'partial')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open prescription not found'; END IF;

  SELECT * INTO v_inventory FROM public.hospital_pharmacy_inventory
  WHERE hospital_id = p_hospital_id AND drug_code = v_prescription.drug_code
  FOR UPDATE;
  IF NOT FOUND OR v_inventory.quantity_on_hand < p_quantity THEN
    RAISE EXCEPTION 'Insufficient pharmacy stock';
  END IF;

  SELECT coalesce(sum(quantity), 0) INTO v_dispensed
  FROM public.pharmacy_dispensations WHERE prescription_id = p_prescription_id;
  IF v_dispensed + p_quantity > v_prescription.quantity THEN
    RAISE EXCEPTION 'Dispensed quantity exceeds the prescription quantity';
  END IF;

  UPDATE public.hospital_pharmacy_inventory
  SET quantity_on_hand = quantity_on_hand - p_quantity,
      demo_stock = false, updated_at = now()
  WHERE hospital_id = p_hospital_id AND drug_code = v_prescription.drug_code;
  INSERT INTO public.pharmacy_dispensations
    (hospital_id, prescription_id, quantity, dispensed_by, notes)
  VALUES (p_hospital_id, p_prescription_id, p_quantity, p_actor_id, p_notes);
  UPDATE public.prescriptions SET status =
    CASE WHEN v_dispensed + p_quantity = v_prescription.quantity THEN 'dispensed' ELSE 'partial' END
  WHERE id = p_prescription_id;
  INSERT INTO public.clinical_inventory_movements
    (hospital_id, item_type, item_code, quantity_change, reason, changed_by)
  VALUES (p_hospital_id, 'drug', v_prescription.drug_code, -p_quantity, 'prescription_dispensed', p_actor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_consultation_workflow(text, uuid, uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_lab_result(text, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_clinical_inventory_stock(text, uuid, text, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dispense_prescription(text, uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_consultation_workflow(text, uuid, uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_lab_result(text, uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_clinical_inventory_stock(text, uuid, text, text, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.dispense_prescription(text, uuid, uuid, integer, text) TO service_role;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'diagnosis_catalog', 'lab_catalog', 'drug_catalog',
    'hospital_lab_inventory', 'hospital_pharmacy_inventory',
    'consultations', 'consultation_diagnoses', 'lab_orders',
    'prescriptions', 'pharmacy_dispensations', 'clinical_inventory_movements'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END;
$$;

CREATE FUNCTION public.broadcast_clinical_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patient_id uuid;
  v_hospital_id text;
BEGIN
  IF TG_TABLE_NAME = 'consultations' THEN
    v_patient_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.patient_id ELSE NEW.patient_id END;
    v_hospital_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.hospital_id ELSE NEW.hospital_id END;
  ELSIF TG_TABLE_NAME = 'consultation_diagnoses' THEN
    SELECT patient_id, hospital_id INTO v_patient_id, v_hospital_id
    FROM public.consultations WHERE id = coalesce(NEW.consultation_id, OLD.consultation_id);
  ELSIF TG_TABLE_NAME = 'lab_orders' THEN
    v_patient_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.patient_id ELSE NEW.patient_id END;
    v_hospital_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.hospital_id ELSE NEW.hospital_id END;
  ELSIF TG_TABLE_NAME = 'prescriptions' THEN
    v_patient_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.patient_id ELSE NEW.patient_id END;
    v_hospital_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.hospital_id ELSE NEW.hospital_id END;
  ELSIF TG_TABLE_NAME = 'pharmacy_dispensations' THEN
    SELECT patient_id, hospital_id INTO v_patient_id, v_hospital_id
    FROM public.prescriptions WHERE id = coalesce(NEW.prescription_id, OLD.prescription_id);
  ELSE
    RETURN NULL;
  END IF;

  IF v_patient_id IS NOT NULL AND v_hospital_id IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('patient_id', v_patient_id, 'operation', TG_TABLE_NAME || '_' || TG_OP),
      'patient_change',
      'hospital:' || v_hospital_id || ':patients',
      true
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER consultations_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_change();
CREATE TRIGGER consultation_diagnoses_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.consultation_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_change();
CREATE TRIGGER lab_orders_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_change();
CREATE TRIGGER prescriptions_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_change();
CREATE TRIGGER pharmacy_dispensations_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.pharmacy_dispensations
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_change();

CREATE FUNCTION public.broadcast_clinical_inventory_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hospital_id text;
  v_item_code text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_hospital_id := OLD.hospital_id;
    IF TG_TABLE_NAME = 'hospital_lab_inventory' THEN
      v_item_code := OLD.lab_code;
    ELSE
      v_item_code := OLD.drug_code;
    END IF;
  ELSE
    v_hospital_id := NEW.hospital_id;
    IF TG_TABLE_NAME = 'hospital_lab_inventory' THEN
      v_item_code := NEW.lab_code;
    ELSE
      v_item_code := NEW.drug_code;
    END IF;
  END IF;
  PERFORM realtime.send(
    jsonb_build_object('operation', TG_TABLE_NAME || '_' || TG_OP, 'item_code', v_item_code),
    'patient_change',
    'hospital:' || v_hospital_id || ':patients',
    true
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER hospital_lab_inventory_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.hospital_lab_inventory
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_inventory_change();
CREATE TRIGGER hospital_pharmacy_inventory_broadcast_change
  AFTER INSERT OR UPDATE OR DELETE ON public.hospital_pharmacy_inventory
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_clinical_inventory_change();

CREATE TRIGGER hospital_lab_inventory_updated_at
  BEFORE UPDATE ON public.hospital_lab_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER hospital_pharmacy_inventory_updated_at
  BEFORE UPDATE ON public.hospital_pharmacy_inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.consultations IS
  'Consultation encounter records. All reads and writes are tenant/role-scoped through clinical-admin.';
COMMENT ON TABLE public.hospital_lab_inventory IS
  'Hospital-scoped lab stock. Seeded quantities are demo examples and must be reconciled before operational use.';
COMMENT ON TABLE public.hospital_pharmacy_inventory IS
  'Hospital-scoped pharmacy stock. Seeded quantities are demo examples and must be reconciled before operational use.';
