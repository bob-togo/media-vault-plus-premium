
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload } from 'lucide-react';
import { UserProfile } from '@/hooks/useUserProfile';
import { UPLOAD_CONFIG } from './upload/uploadConfig';
import { uploadFileInChunks } from './upload/chunkUploadUtils';
import UploadProgressComponent, { UploadProgress } from './upload/UploadProgress';
import StorageWarning from './upload/StorageWarning';

interface FileUploadProps {
  onUploadComplete: () => void;
  userProfile: UserProfile | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, userProfile }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

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
    setUploadProgress([]);

    try {
      let successCount = 0;
      
      // Process files sequentially to avoid overwhelming the system
      for (const file of acceptedFiles) {
        console.log('Processing file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');
        await uploadFileInChunks(file, user.id, setUploadProgress);
        successCount++;
      }

      toast({
        title: "Ultra-Fast Upload Complete!",
        description: `${successCount} file(s) uploaded at maximum speed.`,
      });

      onUploadComplete();
      
      // Clear progress after delay
      setTimeout(() => {
        setUploadProgress([]);
      }, 3000);

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
    accept: UPLOAD_CONFIG.ACCEPT_TYPES,
    disabled: uploading,
    maxSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
  });

  const storageUsed = userProfile?.storage_used || 0;
  const storageLimit = userProfile?.storage_limit || 0;
  const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;

  return (
    <div className="space-y-4">
      <StorageWarning storagePercentage={storagePercentage} />

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
              <UploadProgressComponent uploadProgress={uploadProgress} />
            ) : isDragActive ? (
              <p className="text-lg font-medium">Drop the files here for ultra-fast upload...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-muted-foreground">
                  Supports images, videos, PDFs, and documents (max 2GB per file)
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  ⚡ Ultra-Fast: 50MB chunks • 5 parallel uploads • Optimized for speed
                </p>
                <p className="text-xs text-muted-foreground mt-1">
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
