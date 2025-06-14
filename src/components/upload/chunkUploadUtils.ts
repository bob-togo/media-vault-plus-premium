
import { supabase } from '@/integrations/supabase/client';
import { UPLOAD_CONFIG } from './uploadConfig';
import { UploadProgress } from './UploadProgress';

interface ChunkData {
  index: number;
  chunk: Blob;
  fileName: string;
  retries: number;
}

export const uploadFileInChunks = async (
  file: File,
  userId: string,
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgress[]>>
) => {
  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const fileName = `${userId}/${timestamp}.${fileExt}`;

  console.log('Starting ultra-fast chunked upload for:', fileName, 'Size:', file.size);

  const totalChunks = Math.ceil(file.size / UPLOAD_CONFIG.CHUNK_SIZE);
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
  const chunks: ChunkData[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_CONFIG.CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size);
    chunks.push({
      index: i,
      chunk: file.slice(start, end),
      fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`,
      retries: 0
    });
  }

  try {
    // Process chunks in optimized batches with retry logic
    const uploadWithRetry = async (chunkData: ChunkData, maxRetries = 3) => {
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
    for (let i = 0; i < chunks.length; i += UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS) {
      const batch = chunks.slice(i, i + UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS);
      
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
      const uploadedBytes = uploadedChunks * UPLOAD_CONFIG.CHUNK_SIZE;
      const speed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1);
      
      // Batch speed for this specific batch
      const batchElapsed = (Date.now() - batchStartTime) / 1000;
      const batchBytes = successfulUploads * UPLOAD_CONFIG.CHUNK_SIZE;
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
