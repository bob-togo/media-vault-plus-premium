
import React from 'react';
import { Progress } from '@/components/ui/progress';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error' | 'cancelled';
  speed?: string;
}

interface UploadProgressProps {
  uploadProgress: UploadProgress[];
}

const UploadProgressComponent: React.FC<UploadProgressProps> = ({ uploadProgress }) => {
  return (
    <div className="space-y-4">
      <p className="text-lg font-medium text-blue-600">Upload in progress...</p>
      {uploadProgress.map((progress, index) => (
        <div key={index} className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="truncate max-w-xs font-medium">{progress.fileName}</span>
            <div className="flex items-center gap-2">
              {progress.speed && (
                <span className="text-xs text-blue-600 font-mono bg-blue-50 px-2 py-1 rounded">
                  {progress.speed}
                </span>
              )}
              <span className={`font-bold text-sm ${
                progress.status === 'complete' ? 'text-green-600' : 
                progress.status === 'error' ? 'text-red-600' : 
                progress.status === 'cancelled' ? 'text-orange-600' :
                'text-blue-600'
              }`}>
                {progress.status === 'complete' ? '✅ Complete' : 
                 progress.status === 'error' ? '❌ Error' : 
                 progress.status === 'cancelled' ? '🛑 Cancelled' :
                 `${Math.round(progress.progress)}%`}
              </span>
            </div>
          </div>
          <Progress 
            value={progress.progress} 
            className={`h-3 ${
              progress.status === 'complete' ? 'bg-green-100' : 
              progress.status === 'error' ? 'bg-red-100' :
              progress.status === 'cancelled' ? 'bg-orange-100' :
              'bg-blue-100'
            }`}
          />
        </div>
      ))}
    </div>
  );
};

export default UploadProgressComponent;
