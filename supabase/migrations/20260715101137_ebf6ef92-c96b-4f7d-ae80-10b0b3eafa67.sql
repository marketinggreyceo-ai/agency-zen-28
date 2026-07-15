
CREATE POLICY "Users read own voice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own voice files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own voice files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all voice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-messages' AND public.is_owner());
