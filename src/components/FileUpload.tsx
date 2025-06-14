
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

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  speed?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, userProfile }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for faster uploads
  const MAX_CONCURRENT_UPLOADS = 3; // Parallel uploads

  const uploadFileInChunks = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${user!.id}/${timestamp}.${fileExt}`;

    console.log('Starting parallel chunked upload for:', fileName, 'Size:', file.size);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;
    const startTime = Date.now();

    // Initialize progress tracking
    setUploadProgress(prev => [...prev, {
      fileName: file.name,
      progress: 0,
      status: 'uploading',
      speed: '0 MB/s'
    }]);

    // Create chunks array
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      chunks.push({
        index: i,
        chunk: file.slice(start, end),
        fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`
      });
    }

    try {
      // Upload chunks in parallel batches
      for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = chunks.slice(i, i + MAX_CONCURRENT_UPLOADS);
        
        const uploadPromises = batch.map(async ({ index, chunk, fileName: chunkFileName }) => {
          console.log(`Uploading chunk ${index + 1}/${totalChunks} for ${file.name}`);

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(chunkFileName, chunk, {
              cacheControl: '3600',
              upsert: index === 0 // Only upsert for the first chunk
            });

          if (uploadError) {
            console.error('Chunk upload error:', uploadError);
            throw uploadError;
          }

          return index;
        });

        // Wait for current batch to complete
        await Promise.all(uploadPromises);
        uploadedChunks += batch.length;

        // Calculate progress and speed
        const progress = (uploadedChunks / totalChunks) * 100;
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const uploadedBytes = uploadedChunks * CHUNK_SIZE;
        const speed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1); // MB/s

        // Update progress
        setUploadProgress(prev => prev.map(p => 
          p.fileName === file.name 
            ? { ...p, progress, speed: `${speed} MB/s` }
            : p
        ));
      }

      // If file was uploaded in multiple chunks, use the first chunk as reference
      let finalFileName = fileName;
      let publicUrl = '';

      if (totalChunks > 1) {
        finalFileName = `${fileName}.part0`;
        console.log('Multi-chunk upload completed, using first chunk as reference');
      }

      // Get public URL
      const { data: { publicUrl: url } } = supabase.storage
        .from('user-files')
        .getPublicUrl(finalFileName);

      publicUrl = url;
      console.log('Public URL:', publicUrl);

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('user_files')
        .insert({
          user_id: user!.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      // Update progress to complete
      setUploadProgress(prev => prev.map(p => 
        p.fileName === file.name 
          ? { ...p, progress: 100, status: 'complete' }
          : p
      ));

      return true;
    } catch (error) {
      // Update progress to error
      setUploadProgress(prev => prev.map(p => 
        p.fileName === file.name 
          ? { ...p, status: 'error' }
          : p
      ));
      throw error;
    }
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

    try {
      let successCount = 0;
      
      for (const file of acceptedFiles) {
        console.log('Processing file:', file.name, 'Size:', file.size);
        await uploadFileInChunks(file);
        successCount++;
      }

      toast({
        title: "Upload Successful!",
        description: `${successCount} file(s) uploaded successfully.`,
      });

      onUploadComplete();
      
      // Clear progress after a delay
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
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    disabled: uploading,
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB max file size
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
              <div className="space-y-4">
                <p className="text-lg font-medium">Uploading files...</p>
                {uploadProgress.map((progress, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-xs">{progress.fileName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{progress.speed}</span>
                        <span className={`font-medium ${
                          progress.status === 'complete' ? 'text-green-600' : 
                          progress.status === 'error' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {progress.status === 'complete' ? 'Complete' : 
                           progress.status === 'error' ? 'Error' : `${Math.round(progress.progress)}%`}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          progress.status === 'complete' ? 'bg-green-600' : 
                          progress.status === 'error' ? 'bg-red-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progress.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isDragActive ? (
              <p className="text-lg font-medium">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop files here, or click to select</p>
                <p className="text-sm text-muted-foreground">
                  Supports images, videos, PDFs, and documents (max 2GB per file)
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Optimized for large files with parallel chunk uploads
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
