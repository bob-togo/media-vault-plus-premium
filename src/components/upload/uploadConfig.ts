
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 100 * 1024 * 1024, // 100MB chunks for maximum throughput
  MAX_CONCURRENT_UPLOADS: 8, // Increased parallel uploads
  CONNECTION_TIMEOUT: 60000, // 60 second timeout for large chunks
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB max file size
  RETRY_DELAY_BASE: 500, // Base retry delay in ms
  MAX_RETRIES: 2, // Reduced retries for speed
  ACCEPT_TYPES: {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
  }
};
