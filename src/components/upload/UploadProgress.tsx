
import React from 'react';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  speed?: string;
}

interface UploadProgressProps {
  uploadProgress: UploadProgress[];
}

const UploadProgressComponent: React.FC<UploadProgressProps> = ({ uploadProgress }) => {
  return (
    <div className="space-y-4">
      <p className="text-lg font-medium text-blue-600">🚀 MAXIMUM SPEED UPLOAD IN PROGRESS...</p>
      {uploadProgress.map((progress, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="truncate max-w-xs font-medium">{progress.fileName}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                {progress.speed}
              </span>
              <span className={`font-bold text-sm ${
                progress.status === 'complete' ? 'text-green-600' : 
                progress.status === 'error' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {progress.status === 'complete' ? '✅ Complete' : 
                 progress.status === 'error' ? '❌ Error' : `⚡ ${Math.round(progress.progress)}%`}
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className={`h-4 rounded-full transition-all duration-300 ${
                progress.status === 'complete' ? 'bg-gradient-to-r from-green-500 to-green-600' : 
                progress.status === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                'bg-gradient-to-r from-blue-500 to-blue-600 animate-pulse'
              }`}
              style={{ width: `${progress.progress}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UploadProgressComponent;
