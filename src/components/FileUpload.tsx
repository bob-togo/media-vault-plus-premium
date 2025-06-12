
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';
import { UserProfile } from '@/hooks/useUserProfile';

interface FileUploadProps {
  onUploadComplete: () => void;
  userProfile: UserProfile | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, userProfile }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || !userProfile) return;

    // Check storage limit
    const totalSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
    const currentUsed = userProfile.storage_used || 0;
    const limit = userProfile.storage_limit || 0;

    if (currentUsed + totalSize > limit) {
      toast({
        title: "Storage Limit Exceeded",
        description: "You don't have enough storage space for these files. Consider upgrading to Premium.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      for (const file of acceptedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-files')
          .getPublicUrl(fileName);

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('user_files')
          .insert({
            user_id: user.id,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          });

        if (dbError) throw dbError;
      }

      toast({
        title: "Success",
        description: `${acceptedFiles.length} file(s) uploaded successfully!`,
      });

      onUploadComplete();
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'An error occurred during upload',
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [user, userProfile, toast, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    disabled: uploading,
  });

  return (
    <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`cursor-pointer text-center p-8 rounded-lg transition-colors ${
            isDragActive ? 'bg-primary/10' : 'hover:bg-muted/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          {uploading ? (
            <p className="text-lg font-medium">Uploading files...</p>
          ) : isDragActive ? (
            <p className="text-lg font-medium">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">Drag & drop files here, or click to select</p>
              <p className="text-sm text-muted-foreground">
                Supports images, videos, PDFs, and documents
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
