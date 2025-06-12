
-- Create user_profile table to track user storage and plan information
CREATE TABLE public.user_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
  storage_limit BIGINT DEFAULT 2147483648, -- 2GB in bytes for free plan
  storage_used BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_files table to store file metadata
CREATE TABLE public.user_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create storage bucket for user files
INSERT INTO storage.buckets (id, name, public) VALUES ('user-files', 'user-files', false);

-- Enable RLS on user_profile table
ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_files table
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profile
CREATE POLICY "Users can view their own profile" ON public.user_profile
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.user_profile
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.user_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for user_files
CREATE POLICY "Users can view their own files" ON public.user_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" ON public.user_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON public.user_files
  FOR DELETE USING (auth.uid() = user_id);

-- Storage policies for user-files bucket
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update storage usage when files are added/removed
CREATE OR REPLACE FUNCTION public.update_user_storage()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profile 
    SET storage_used = storage_used + NEW.file_size,
        updated_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profile 
    SET storage_used = storage_used - OLD.file_size,
        updated_at = now()
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to automatically update storage usage
CREATE TRIGGER on_file_insert
  AFTER INSERT ON public.user_files
  FOR EACH ROW EXECUTE FUNCTION public.update_user_storage();

CREATE TRIGGER on_file_delete
  AFTER DELETE ON public.user_files
  FOR EACH ROW EXECUTE FUNCTION public.update_user_storage();
