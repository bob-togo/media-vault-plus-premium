
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

  console.log('🚀 Starting optimized upload for:', fileName, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');

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

  // Create chunks with optimized size for better reliability
  const chunks: ChunkData[] = [];
  console.log(`📦 Creating ${totalChunks} chunks of ~${(UPLOAD_CONFIG.CHUNK_SIZE / 1024 / 1024).toFixed(1)}MB each`);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_CONFIG.CHUNK_SIZE;
    const end = Math.min(start + UPLOAD_CONFIG.CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    console.log(`📦 Chunk ${i + 1}: ${(start / 1024 / 1024).toFixed(1)}MB-${(end / 1024 / 1024).toFixed(1)}MB, size: ${(chunk.size / 1024 / 1024).toFixed(1)}MB`);
    
    chunks.push({
      index: i,
      chunk: chunk,
      fileName: totalChunks === 1 ? fileName : `${fileName}.part${i}`,
      size: chunk.size
    });
  }

  try {
    // Upload function with improved error handling and retry logic
    const uploadChunk = async (chunkData: ChunkData) => {
      const { index, chunk, fileName: chunkFileName, size } = chunkData;
      const chunkStartTime = performance.now();
      
      console.log(`⚡ Uploading chunk ${index + 1}/${totalChunks} (${(size / 1024 / 1024).toFixed(1)}MB)`);
      
      for (let attempt = 0; attempt < UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`⏰ Timeout for chunk ${index + 1}, attempt ${attempt + 1}`);
          controller.abort();
        }, UPLOAD_CONFIG.CONNECTION_TIMEOUT);

        try {
          console.log(`🔄 Upload attempt ${attempt + 1} for chunk ${index + 1}`);

          const { error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(chunkFileName, chunk, {
              cacheControl: '31536000',
              upsert: index === 0,
              contentType: file.type || 'application/octet-stream'
            });

          clearTimeout(timeoutId);

          if (uploadError) {
            console.error(`❌ Upload error for chunk ${index + 1}:`, uploadError);
            if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw uploadError;
            
            const delay = UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt);
            console.log(`⏳ Retrying chunk ${index + 1} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          const chunkTime = (performance.now() - chunkStartTime) / 1000;
          const chunkSpeed = (size / chunkTime / 1024 / 1024).toFixed(1);
          console.log(`✅ Chunk ${index + 1} uploaded in ${chunkTime.toFixed(2)}s at ${chunkSpeed} MB/s`);
          
          // Update progress
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
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            console.error(`⏰ Chunk ${index + 1} upload timed out (attempt ${attempt + 1})`);
          } else {
            console.error(`❌ Chunk ${index + 1} upload error (attempt ${attempt + 1}):`, error);
          }
          
          if (attempt === UPLOAD_CONFIG.MAX_RETRIES - 1) throw error;
          
          const delay = UPLOAD_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(`⏳ Waiting ${delay.toFixed(0)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    // Upload chunks sequentially for better reliability
    console.log(`🔥 Starting sequential upload of ${chunks.length} chunks`);
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🚀 Processing chunk ${i + 1}/${chunks.length}`);
      await uploadChunk(chunks[i]);
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
    console.log(`🎉 Upload complete! Total: ${totalTime.toFixed(2)}s, Average: ${avgSpeed} MB/s`);

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
