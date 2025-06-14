
import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';
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
  const cancellationTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const cancelUpload = () => {
    cancellationTokenRef.current.cancelled = true;
    setUploading(false);
    toast({
      title: "Upload Cancelled",
      description: "The upload has been cancelled by the user.",
      variant: "destructive",
    });
  };

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
    cancellationTokenRef.current = { cancelled: false };

    try {
      let successCount = 0;
      const uploadStartTime = performance.now();
      
      // Process files sequentially
      for (const file of acceptedFiles) {
        if (cancellationTokenRef.current.cancelled) {
          break;
        }
        
        console.log('Processing file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');
        await uploadFileInChunks(file, user.id, setUploadProgress, cancellationTokenRef.current);
        successCount++;
      }

      if (!cancellationTokenRef.current.cancelled) {
        const totalTime = (performance.now() - uploadStartTime) / 1000;
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
        const avgSpeed = (totalSize / totalTime / 1024 / 1024).toFixed(1);

        toast({
          title: "Upload Complete!",
          description: `${successCount} file(s) uploaded (${totalSizeMB}MB) at ${avgSpeed} MB/s average speed.`,
        });

        onUploadComplete();
        
        // Clear progress after delay
        setTimeout(() => {
          setUploadProgress([]);
        }, 3000);
      }

    } catch (error) {
      if (!error.message.includes('cancelled')) {
        console.error('Upload failed:', error);
        toast({
          title: "Upload Failed",
          description: error instanceof Error ? error.message : 'An error occurred during upload',
          variant: "destructive",
        });
      }
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

      <Card className="border-2 border-dashed border-border hover:border-blue-500 transition-colors">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`cursor-pointer text-center p-8 rounded-lg transition-colors ${
              isDragActive ? 'bg-blue-50 border-blue-300' : 'hover:bg-muted/50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex justify-center mb-4">
              <Upload className="h-12 w-12 text-muted-foreground" />
            </div>
            {uploading ? (
              <div className="space-y-4">
                <UploadProgressComponent uploadProgress={uploadProgress} />
                <Button 
                  variant="destructive" 
                  onClick={cancelUpload}
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Upload
                </Button>
              </div>
            ) : isDragActive ? (
              <p className="text-lg font-medium text-blue-600">Drop files for upload...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-muted-foreground">
                  Supports images, videos, PDFs, and documents (max 2GB per file)
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
