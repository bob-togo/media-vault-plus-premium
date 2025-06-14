
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  MAX_CONCURRENT_UPLOADS: 3,
  CONNECTION_TIMEOUT: 30000,
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB max file size
  RETRY_DELAY_BASE: 1000,
  MAX_RETRIES: 3,
  ACCEPT_TYPES: {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
  }
};
