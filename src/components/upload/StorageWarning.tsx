
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface StorageWarningProps {
  storagePercentage: number;
}

const StorageWarning: React.FC<StorageWarningProps> = ({ storagePercentage }) => {
  const isNearLimit = storagePercentage > 90;

  if (!isNearLimit) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Storage Warning</span>
        </div>
        <p className="text-sm text-orange-600 mt-1">
          You're running low on storage space. Consider upgrading to Premium for 10GB storage.
        </p>
      </CardContent>
    </Card>
  );
};

export default StorageWarning;
