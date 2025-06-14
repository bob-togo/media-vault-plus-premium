
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
      <p className="text-lg font-medium">Ultra-Fast Upload in Progress...</p>
      {uploadProgress.map((progress, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="truncate max-w-xs">{progress.fileName}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">{progress.speed}</span>
              <span className={`font-medium ${
                progress.status === 'complete' ? 'text-green-600' : 
                progress.status === 'error' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {progress.status === 'complete' ? '✓ Complete' : 
                 progress.status === 'error' ? '✗ Error' : `${Math.round(progress.progress)}%`}
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-200 ${
                progress.status === 'complete' ? 'bg-green-600' : 
                progress.status === 'error' ? 'bg-red-600' : 'bg-blue-600'
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
