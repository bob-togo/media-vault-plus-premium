
export const UPLOAD_CONFIG = {
  CHUNK_SIZE: 50 * 1024 * 1024, // 50MB chunks for maximum throughput
  MAX_CONCURRENT_UPLOADS: 5, // Maximum parallel uploads
  CONNECTION_TIMEOUT: 30000, // 30 second timeout
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB max file size
  ACCEPT_TYPES: {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
  }
};
