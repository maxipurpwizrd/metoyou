-- Add a deterministic conversation key so chats resolve by the two participants instead of only by a random UUID.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'conversation_key'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN conversation_key text;
  END IF;
END $$;

UPDATE public.conversations
SET conversation_key = CASE
  WHEN user_1 IS NULL OR user_2 IS NULL THEN NULL
  ELSE LEAST(user_1::text, user_2::text) || ':' || GREATEST(user_1::text, user_2::text)
END
WHERE conversation_key IS NULL
  AND user_1 IS NOT NULL
  AND user_2 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_conversation_key_idx
ON public.conversations (conversation_key)
WHERE conversation_key IS NOT NULL;
