CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id text REFERENCES public.hospitals (id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  target_role text CHECK (
    target_role IS NULL
    OR target_role IN ('superadmin', 'hospitaladmin', 'consulting', 'nurse', 'labs', 'pharmacy', 'reception')
  ),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT notifications_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT notifications_scope_present CHECK (
    hospital_id IS NOT NULL OR recipient_user_id IS NOT NULL
  )
);

CREATE INDEX notifications_hospital_created_idx
  ON public.notifications (hospital_id, created_at DESC);

CREATE INDEX notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION
      'The supabase_realtime publication is missing. Apply the realtime migration in a Supabase project.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

COMMENT ON TABLE public.notifications IS
  'Development schema only: add and verify tenant- and recipient-scoped RLS policies before production.';
