
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 5 * 1024 * 1024, // Reduced to 5MB chunks for faster parallel processing
  MAX_CONCURRENT_UPLOADS: 6, // Increased concurrent uploads for better speed
  CONNECTION_TIMEOUT: 90000, // Reduced timeout for faster failure detection
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB max file size
  RETRY_DELAY_BASE: 500, // Reduced retry delay for faster recovery
  MAX_RETRIES: 2, // Reduced retries to avoid long waits
  ACCEPT_TYPES: {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
  }
};
