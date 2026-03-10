-- Add seller-specific fields to profiles table

-- Add business_name column (optional field for sellers)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_name text;

-- Add paypal_email column (optional field for seller payouts)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS paypal_email text;

-- Add check constraint for email format (only if value is provided)
ALTER TABLE public.profiles
ADD CONSTRAINT paypal_email_format CHECK (
  paypal_email IS NULL OR paypal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
);

-- Add index for business_name search (for future use)
CREATE INDEX IF NOT EXISTS profiles_business_name_idx ON public.profiles(business_name);

-- Comment the columns
COMMENT ON COLUMN public.profiles.business_name IS 'Optional business or shop name displayed on seller profile';
COMMENT ON COLUMN public.profiles.paypal_email IS 'Optional PayPal email for seller payouts';
