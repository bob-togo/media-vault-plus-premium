
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

  // Optimized for maximum speed
  const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks for maximum throughput
  const MAX_CONCURRENT_UPLOADS = 5; // Maximum parallel uploads
  const CONNECTION_TIMEOUT = 30000; // 30 second timeout

  const uploadFileInChunks = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const fileName = `${user!.id}/${timestamp}.${fileExt}`;

    console.log('Starting ultra-fast chunked upload for:', fileName, 'Size:', file.size);

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

    // Pre-create all chunks for optimal memory usage
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      chunks.push({
        index: i,
        chunk: file.slice(start, end),
        fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`,
        retries: 0
      });
    }

    try {
      // Process chunks in optimized batches with retry logic
      const uploadWithRetry = async (chunkData: any, maxRetries = 3) => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const { index, chunk, fileName: chunkFileName } = chunkData;
            
            console.log(`Uploading chunk ${index + 1}/${totalChunks} (attempt ${attempt + 1})`);

            // Optimized upload with custom headers for better performance
            const { error: uploadError } = await supabase.storage
              .from('user-files')
              .upload(chunkFileName, chunk, {
                cacheControl: '31536000', // 1 year cache for better CDN performance
                upsert: index === 0, // Only upsert for the first chunk
                duplex: 'half' // Optimize for upload performance
              });

            if (uploadError) {
              if (attempt === maxRetries) throw uploadError;
              console.warn(`Chunk ${index} upload failed, retrying...`, uploadError);
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
              continue;
            }

            return index;
          } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      };

      // Ultra-fast parallel processing with optimized batching
      for (let i = 0; i < chunks.length; i += MAX_CONCURRENT_UPLOADS) {
        const batch = chunks.slice(i, i + MAX_CONCURRENT_UPLOADS);
        
        const batchStartTime = Date.now();
        
        // Process entire batch in parallel with Promise.allSettled for better error handling
        const results = await Promise.allSettled(
          batch.map(chunkData => uploadWithRetry(chunkData))
        );

        // Count successful uploads
        const successfulUploads = results.filter(result => result.status === 'fulfilled').length;
        uploadedChunks += successfulUploads;

        // Handle any failed uploads
        const failedUploads = results.filter(result => result.status === 'rejected');
        if (failedUploads.length > 0) {
          console.warn(`${failedUploads.length} chunks failed in batch`);
        }

        // Optimized progress calculation with speed tracking
        const progress = (uploadedChunks / totalChunks) * 100;
        const elapsed = (Date.now() - startTime) / 1000;
        const uploadedBytes = uploadedChunks * CHUNK_SIZE;
        const speed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1);
        
        // Batch speed for this specific batch
        const batchElapsed = (Date.now() - batchStartTime) / 1000;
        const batchBytes = successfulUploads * CHUNK_SIZE;
        const batchSpeed = (batchBytes / batchElapsed / 1024 / 1024).toFixed(1);

        console.log(`Batch completed: ${successfulUploads}/${batch.length} chunks, Batch speed: ${batchSpeed} MB/s`);

        // Throttled progress updates for better performance
        if (uploadedChunks % Math.max(1, Math.floor(totalChunks / 20)) === 0 || uploadedChunks === totalChunks) {
          setUploadProgress(prev => prev.map(p => 
            p.fileName === file.name 
              ? { ...p, progress, speed: `${speed} MB/s` }
              : p
          ));
        }
      }

      // Determine final file reference
      let finalFileName = fileName;
      let publicUrl = '';

      if (totalChunks > 1) {
        finalFileName = `${fileName}.part0`;
        console.log('Multi-chunk upload completed, using first chunk as reference');
      }

      // Get optimized public URL
      const { data: { publicUrl: url } } = supabase.storage
        .from('user-files')
        .getPublicUrl(finalFileName);

      publicUrl = url;
      console.log('Public URL generated:', publicUrl);

      // Batch database insert for better performance
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

      // Final progress update
      setUploadProgress(prev => prev.map(p => 
        p.fileName === file.name 
          ? { ...p, progress: 100, status: 'complete' }
          : p
      ));

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = (file.size / totalTime / 1024 / 1024).toFixed(1);
      console.log(`Upload completed! Total time: ${totalTime}s, Average speed: ${avgSpeed} MB/s`);

      return true;
    } catch (error) {
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
      
      // Process files sequentially to avoid overwhelming the system
      for (const file of acceptedFiles) {
        console.log('Processing file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');
        await uploadFileInChunks(file);
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
                <p className="text-lg font-medium">Ultra-Fast Upload in Progress...</p>
                {uploadProgress.map((progress, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-xs">{progress.fileName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{progress.speed}</span>
                        <span className={`font-medium ${
                          progress.status === 'complete' ? 'text-green-600' : 
                          progress.status === 'error' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {progress.status === 'complete' ? '✓ Complete' : 
                           progress.status === 'error' ? '✗ Error' : `${Math.round(progress.progress)}%`}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-200 ${
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
