-- Drawn e-signature (signature-pad PNG data URL) captured at agreement
-- signing, alongside the typed legal name in seller_signature.
ALTER TABLE seller_applications
  ADD COLUMN IF NOT EXISTS seller_signature_image text;
