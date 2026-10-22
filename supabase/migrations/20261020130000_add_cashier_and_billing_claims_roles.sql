ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'superadmin',
    'hospitaladmin',
    'consulting',
    'nurse',
    'labs',
    'pharmacy',
    'reception',
    'cashier',
    'billing_claims'
  ));
