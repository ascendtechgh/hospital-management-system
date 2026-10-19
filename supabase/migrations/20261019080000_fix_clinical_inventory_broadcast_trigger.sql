CREATE OR REPLACE FUNCTION public.broadcast_clinical_inventory_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_hospital_id text;
  v_item_code text;
  v_code_field text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_hospital_id := v_row->>'hospital_id';
  v_code_field := CASE
    WHEN TG_TABLE_NAME = 'hospital_lab_inventory' THEN 'lab_code'
    WHEN TG_TABLE_NAME = 'hospital_pharmacy_inventory' THEN 'drug_code'
    ELSE NULL
  END;

  IF v_code_field IS NULL THEN
    RAISE EXCEPTION 'Unsupported clinical inventory table: %', TG_TABLE_NAME;
  END IF;

  v_item_code := v_row->>v_code_field;
  IF v_hospital_id IS NULL OR v_item_code IS NULL THEN
    RAISE EXCEPTION 'Clinical inventory change is missing its hospital or item code';
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
