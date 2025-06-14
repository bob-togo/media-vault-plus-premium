
import { supabase } from '@/integrations/supabase/client';
import { UPLOAD_CONFIG } from './uploadConfig';
import { UploadProgress } from './UploadProgress';

interface ChunkData {
  index: number;
  chunk: Blob;
  fileName: string;
  size: number;
}

export const uploadFileInChunks = async (
  file: File,
  userId: string,
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgress[]>>
) => {
  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const fileName = `${userId}/${timestamp}.${fileExt}`;

  console.log('🚀 Starting MAXIMUM SPEED upload for:', fileName, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');

  const totalChunks = Math.ceil(file.size / UPLOAD_CONFIG.CHUNK_SIZE);
  let uploadedChunks = 0;
  const startTime = performance.now();

  // Initialize progress tracking with immediate update
  setUploadProgress(prev => [...prev, {
    fileName: file.name,
    progress: 0,
    status: 'uploading',
    speed: '0 MB/s'
  }]);

  // Pre-create all chunks with optimized slicing
  const chunks: ChunkData[] = [];
  console.log(`📦 Creating ${totalChunks} chunks of ${(UPLOAD_CONFIG.CHUNK_SIZE / 1024 / 1024).toFixed(0)}MB each`);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_CONFIG.CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size);
    const chunkSize = end - start;
    
    chunks.push({
      index: i,
      chunk: file.slice(start, end),
      fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`,
      size: chunkSize
    });
  }

  try {
    // Ultra-fast upload with aggressive optimization
    const uploadWithMaxSpeed = async (chunkData: ChunkData) => {
      const { index, chunk, fileName: chunkFileName, size } = chunkData;
      const chunkStartTime = performance.now();
      
      for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        try {
          console.log(`⚡ Uploading chunk ${index + 1}/${totalChunks} (${(size / 1024 / 1024).toFixed(1)}MB)`);

          // Maximum speed upload with optimized settings
          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(chunkFileName, chunk, {
              cacheControl: '31536000',
              upsert: index === 0,
              duplex: 'half',
              contentType: file.type || 'application/octet-stream'
            });

          if (uploadError) {
            if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw uploadError;
            console.warn(`🔄 Retry chunk ${index + 1}, attempt ${attempt + 2}`);
            await new Promise(resolve => setTimeout(resolve, UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(1.5, attempt)));
            continue;
          }

          const chunkTime = (performance.now() - chunkStartTime) / 1000;
          const chunkSpeed = (size / chunkTime / 1024 / 1024).toFixed(1);
          console.log(`✅ Chunk ${index + 1} uploaded in ${chunkTime.toFixed(2)}s at ${chunkSpeed} MB/s`);
          
          // Immediate progress update after each chunk
          uploadedChunks++;
          const currentProgress = (uploadedChunks / totalChunks) * 100;
          const elapsed = (performance.now() - startTime) / 1000;
          const uploadedBytes = uploadedChunks * UPLOAD_CONFIG.CHUNK_SIZE;
          const overallSpeed = (uploadedBytes / elapsed / 1024 / 1024).toFixed(1);
          
          console.log(`📊 Progress: ${currentProgress.toFixed(1)}% (${uploadedChunks}/${totalChunks} chunks) - Speed: ${overallSpeed} MB/s`);
          
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
          if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(1.5, attempt)));
        }
      }
    };

    // Process all chunks with maximum concurrency in smaller batches for better progress tracking
    const batchSize = Math.min(UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS, 4); // Smaller batches for more frequent updates
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchStartTime = performance.now();
      
      console.log(`🔥 Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} chunks`);
      
      // Execute batch with Promise.allSettled for fault tolerance
      const batchResults = await Promise.allSettled(
        batch.map(chunkData => uploadWithMaxSpeed(chunkData))
      );

      // Process results
      const successfulUploads = batchResults.filter(result => result.status === 'fulfilled');
      const failedUploads = batchResults.filter(result => result.status === 'rejected');
      
      if (failedUploads.length > 0) {
        console.error(`❌ ${failedUploads.length} chunks failed in batch`);
        failedUploads.forEach((failure, idx) => {
          console.error(`Failed chunk ${batch[idx].index + 1}:`, failure.reason);
        });
      }

      const batchTime = (performance.now() - batchStartTime) / 1000;
      const batchBytes = successfulUploads.reduce((sum, result: any) => sum + result.value.size, 0);
      const batchSpeed = (batchBytes / batchTime / 1024 / 1024).toFixed(1);

      console.log(`📊 Batch completed: ${successfulUploads.length}/${batch.length} chunks, Batch: ${batchSpeed} MB/s`);

      // Throw error if too many chunks failed
      if (failedUploads.length > batch.length / 2) {
        throw new Error(`Too many chunks failed: ${failedUploads.length}/${batch.length}`);
      }
    }

    // Determine final file reference
    let finalFileName = fileName;
    if (totalChunks > 1) {
      finalFileName = `${fileName}.part0`;
      console.log('📁 Multi-chunk upload completed, using first chunk as reference');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('user-files')
      .getPublicUrl(finalFileName);

    console.log('🔗 Public URL generated:', publicUrl);

    // Database insert with optimized transaction
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
      console.error('💾 Database error:', dbError);
      throw dbError;
    }

    // Final progress update - ensure 100% completion
    setUploadProgress(prev => prev.map(p => 
      p.fileName === file.name 
        ? { ...p, progress: 100, status: 'complete' }
        : p
    ));

    const totalTime = (performance.now() - startTime) / 1000;
    const avgSpeed = (file.size / totalTime / 1024 / 1024).toFixed(1);
    console.log(`🎉 MAXIMUM SPEED UPLOAD COMPLETE! Total: ${totalTime.toFixed(2)}s, Average: ${avgSpeed} MB/s`);

    return true;
  } catch (error) {
    console.error('💥 Upload failed:', error);
    setUploadProgress(prev => prev.map(p => 
      p.fileName === file.name 
        ? { ...p, status: 'error' }
        : p
    ));
    throw error;
  }
};
