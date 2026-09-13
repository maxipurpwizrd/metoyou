-- Add the richer message columns expected by the chat UI.
-- These statements are safe to re-run because they use IF NOT EXISTS / DO $$ guards.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'message_type'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN message_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN metadata jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'reactions'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN reactions jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN edited_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'reply_to_id'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN reply_to_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'reply_to_text'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN reply_to_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN status text DEFAULT 'sent';
  END IF;
END $$;
