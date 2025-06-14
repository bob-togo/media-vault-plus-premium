
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, AlertTriangle } from 'lucide-react';
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
    if (!user || !userProfile) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload files.",
        variant: "destructive",
      });
      return;
    }

    // Check storage limit
    const totalSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
    const currentUsed = userProfile.storage_used || 0;
    const limit = userProfile.storage_limit || 0;

    if (currentUsed + totalSize > limit) {
      toast({
        title: "Storage Limit Exceeded",
        description: userProfile.plan_type === 'free' 
          ? "Upgrade to Premium for 10GB storage!" 
          : "You've reached your storage limit.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      for (const file of acceptedFiles) {
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const fileName = `${user.id}/${timestamp}.${fileExt}`;

        console.log('Uploading file:', fileName);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-files')
          .getPublicUrl(fileName);

        console.log('Public URL:', publicUrl);

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

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }
      }

      toast({
        title: "Upload Successful!",
        description: `${acceptedFiles.length} file(s) uploaded successfully.`,
      });

      onUploadComplete();
    } catch (error) {
      console.error('Upload failed:', error);
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
    maxSize: 100 * 1024 * 1024, // 100MB max file size
  });

  const storageUsed = userProfile?.storage_used || 0;
  const storageLimit = userProfile?.storage_limit || 0;
  const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;
  const isNearLimit = storagePercentage > 90;

  return (
    <div className="space-y-4">
      {isNearLimit && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Storage Warning</span>
            </div>
            <p className="text-sm text-orange-600 mt-1">
              You're running low on storage space. Consider upgrading to Premium for 10GB storage.
            </p>
          </CardContent>
        </Card>
      )}

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
              <div>
                <p className="text-lg font-medium">Uploading files...</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : isDragActive ? (
              <p className="text-lg font-medium">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-muted-foreground">
                  Supports images, videos, PDFs, and documents (max 100MB per file)
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Storage: {Math.round(storagePercentage)}% used
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileUpload;
