
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 10 * 1024 * 1024, // Reduced to 10MB chunks for better reliability
  MAX_CONCURRENT_UPLOADS: 4, // Reduced concurrent uploads to avoid overwhelming connection
  CONNECTION_TIMEOUT: 120000, // Increased to 2 minutes for more reliable uploads
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB max file size
  RETRY_DELAY_BASE: 1000, // Increased base retry delay
  MAX_RETRIES: 3, // Increased retries for better reliability
  ACCEPT_TYPES: {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
  }
};
