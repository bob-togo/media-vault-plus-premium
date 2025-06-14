
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

  // Initialize progress tracking
  setUploadProgress(prev => [...prev, {
    fileName: file.name,
    progress: 0,
    status: 'uploading',
    speed: '0 MB/s'
  }]);

  // Pre-create all chunks with correct slicing
  const chunks: ChunkData[] = [];
  console.log(`📦 Creating ${totalChunks} chunks for ${(file.size / 1024 / 1024).toFixed(1)}MB file`);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_CONFIG.CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const actualChunkSize = chunk.size;
    
    console.log(`📦 Chunk ${i + 1}: ${start}-${end}, size: ${(actualChunkSize / 1024 / 1024).toFixed(1)}MB`);
    
    chunks.push({
      index: i,
      chunk: chunk,
      fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`,
      size: actualChunkSize
    });
  }

  try {
    // Upload function with better error handling
    const uploadWithMaxSpeed = async (chunkData: ChunkData) => {
      const { index, chunk, fileName: chunkFileName, size } = chunkData;
      const chunkStartTime = performance.now();
      
      console.log(`⚡ Uploading chunk ${index + 1}/${totalChunks} (${(size / 1024 / 1024).toFixed(1)}MB) - actual blob size: ${(chunk.size / 1024 / 1024).toFixed(1)}MB`);
      
      for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        try {
          // Verify chunk size before upload
          if (chunk.size !== size) {
            console.error(`❌ Chunk size mismatch: expected ${size}, got ${chunk.size}`);
            throw new Error(`Chunk size mismatch: expected ${size}, got ${chunk.size}`);
          }

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(chunkFileName, chunk, {
              cacheControl: '31536000',
              upsert: index === 0,
              contentType: file.type || 'application/octet-stream'
            });

          if (uploadError) {
            console.error(`❌ Upload error for chunk ${index + 1}:`, uploadError);
            if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw uploadError;
            console.warn(`🔄 Retry chunk ${index + 1}, attempt ${attempt + 2}`);
            await new Promise(resolve => setTimeout(resolve, UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt)));
            continue;
          }

          const chunkTime = (performance.now() - chunkStartTime) / 1000;
          const chunkSpeed = (size / chunkTime / 1024 / 1024).toFixed(1);
          console.log(`✅ Chunk ${index + 1} uploaded in ${chunkTime.toFixed(2)}s at ${chunkSpeed} MB/s`);
          
          // Update progress immediately after each chunk
          uploadedChunks++;
          const currentProgress = (uploadedChunks / totalChunks) * 100;
          const elapsed = (performance.now() - startTime) / 1000;
          const uploadedBytes = chunks.slice(0, uploadedChunks).reduce((sum, c) => sum + c.size, 0);
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
          console.error(`❌ Chunk ${index + 1} upload error (attempt ${attempt + 1}):`, error);
          if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt)));
        }
      }
    };

    // Process chunks sequentially to avoid overwhelming the connection
    console.log(`🔥 Starting sequential upload of ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🚀 Processing chunk ${i + 1}/${chunks.length}`);
      await uploadWithMaxSpeed(chunks[i]);
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
      console.error('💾 Database error:', dbError);
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
