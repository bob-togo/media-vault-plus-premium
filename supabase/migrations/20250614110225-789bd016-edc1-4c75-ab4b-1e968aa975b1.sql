
-- Update user_profile table to match requirements (ensure correct defaults)
ALTER TABLE public.user_profile 
  ALTER COLUMN plan_type SET DEFAULT 'free',
  ALTER COLUMN storage_limit SET DEFAULT 2147483648; -- 2GB for free

-- Update storage limit for premium users (10GB)
UPDATE public.user_profile 
SET storage_limit = 10737418240 
WHERE plan_type = 'premium';

-- The triggers already exist for user_files table, so no need to recreate them
