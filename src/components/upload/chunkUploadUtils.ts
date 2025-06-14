
import { supabase } from '@/integrations/supabase/client';
import { UPLOAD_CONFIG } from './uploadConfig';
import { UploadProgress } from './UploadProgress';

interface ChunkData {
  index: number;
  chunk: Blob;
  fileName: string;
  size: number;
  mimeType: string;
}

interface CancellationToken {
  cancelled: boolean;
}

export const uploadFileInChunks = async (
  file: File,
  userId: string,
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgress[]>>,
  cancellationToken: CancellationToken
) => {
  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const fileName = `${userId}/${timestamp}.${fileExt}`;

  console.log('Starting upload for:', fileName, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');

  const totalChunks = Math.ceil(file.size / UPLOAD_CONFIG.CHUNK_SIZE);
  let uploadedChunks = 0;
  const startTime = performance.now();

  // Initialize progress tracking
  setUploadProgress(prev => [...prev, {
    fileName: file.name,
    progress: 0,
    status: 'uploading',
    speed: '0 MB/s'
  }]);

  // Create chunks
  const chunks: ChunkData[] = [];
  console.log(`Creating ${totalChunks} chunks of ~${(UPLOAD_CONFIG.CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB each`);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_CONFIG.CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end, file.type);
    
    chunks.push({
      index: i,
      chunk: chunk,
      fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`,
      size: chunk.size,
      mimeType: file.type || 'application/octet-stream'
    });
  }

  try {
    // Upload function
    const uploadChunk = async (chunkData: ChunkData) => {
      const { index, chunk, fileName: chunkFileName, size, mimeType } = chunkData;
      const chunkStartTime = performance.now();
      
      console.log(`Uploading chunk ${index + 1}/${totalChunks} (${(size / 1024 / 1024).toFixed(1)}MB)`);
      
      for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        if (cancellationToken.cancelled) {
          console.log(`Upload cancelled for chunk ${index + 1}`);
          throw new Error('Upload cancelled by user');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPLOAD_CONFIG.CONNECTION_TIMEOUT);

        try {
          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(chunkFileName, chunk, {
              cacheControl: '31536000',
              upsert: index === 0,
              contentType: mimeType
            });

          clearTimeout(timeoutId);

          if (uploadError) {
            console.error(`Upload error for chunk ${index + 1}:`, uploadError);
            if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw uploadError;
            
            const delay = UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          const chunkTime = (performance.now() - chunkStartTime) / 1000;
          const chunkSpeed = (size / chunkTime / 1024 / 1024).toFixed(1);
          console.log(`Chunk ${index + 1} uploaded in ${chunkTime.toFixed(2)}s at ${chunkSpeed} MB/s`);
          
          // Update progress
          uploadedChunks++;
          const currentProgress = (uploadedChunks / totalChunks) * 100;
          const elapsed = (performance.now() - startTime) / 1000;
          const uploadedBytes = uploadedChunks * UPLOAD_CONFIG.CHUNK_SIZE;
          const overallSpeed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1);
          
          setUploadProgress(prev => prev.map(p => 
            p.fileName === file.name 
              ? { 
                  ...p, 
                  progress: Math.round(currentProgress), 
                  speed: `${overallSpeed} MB/s` 
                }
              : p
          ));
          
          return { index, uploadTime: chunkTime, size };
        } catch (error) {
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            console.error(`Chunk ${index + 1} upload timed out (attempt ${attempt + 1})`);
          } else {
            console.error(`Chunk ${index + 1} upload error (attempt ${attempt + 1}):`, error);
          }
          
          if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw error;
          
          const delay = UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    // Sequential upload
    console.log(`Starting sequential upload`);
    
    for (const chunk of chunks) {
      if (cancellationToken.cancelled) {
        console.log(`Upload cancelled`);
        throw new Error('Upload cancelled by user');
      }
      await uploadChunk(chunk);
    }

    // Determine final file reference
    let finalFileName = fileName;
    if (totalChunks > 1) {
      finalFileName = `${fileName}.part0`;
      console.log('Multi-chunk upload completed, using first chunk as reference');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-files')
      .getPublicUrl(finalFileName);

    console.log('Public URL generated:', publicUrl);

    // Database insert
    const { error: dbError } = await supabase
      .from('user_files')
      .insert({
        user_id: userId,
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

    const totalTime = (performance.now() - startTime) / 1000;
    const avgSpeed = (file.size / totalTime / 1024 / 1024).toFixed(1);
    console.log(`Upload complete! Total: ${totalTime.toFixed(2)}s, Average: ${avgSpeed} MB/s`);

    return true;
  } catch (error) {
    console.error('Upload failed:', error);
    
    // Update progress based on error type
    const status = error.message.includes('cancelled') ? 'cancelled' : 'error';
    setUploadProgress(prev => prev.map(p => 
      p.fileName === file.name 
        ? { ...p, status }
        : p
    ));
    throw error;
  }
};
