
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserFile } from '@/hooks/useUserFiles';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Trash2 } from 'lucide-react';

interface FileGridProps {
  files: UserFile[];
  onDeleteFile: (fileId: string, filePath: string) => Promise<void>;
}

const FileGrid: React.FC<FileGridProps> = ({ files, onDeleteFile }) => {
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileTypeColor = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'bg-green-100 text-green-800';
    if (fileType.startsWith('video/')) return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
  };

  const isImage = (fileType: string) => fileType.startsWith('image/');
  const isVideo = (fileType: string) => fileType.startsWith('video/');

  const getFilePathFromUrl = (fileUrl: string) => {
    // Extract the file path from the public URL
    const urlParts = fileUrl.split('/');
    const objectIndex = urlParts.findIndex(part => part === 'object');
    if (objectIndex !== -1 && objectIndex < urlParts.length - 2) {
      // Return everything after 'object/public/user-files/'
      return urlParts.slice(objectIndex + 3).join('/');
    }
    // Fallback: try to extract from the end of the URL
    return urlParts.slice(-2).join('/');
  };

  const handleDownload = async (file: UserFile) => {
    try {
      const filePath = getFilePathFromUrl(file.file_url);
      console.log('Downloading file path:', filePath);

      const { data, error } = await supabase.storage
        .from('user-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : 'Failed to download file',
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (file: UserFile) => {
    try {
      const filePath = getFilePathFromUrl(file.file_url);
      console.log('Deleting file path:', filePath);
      await onDeleteFile(file.id, filePath);
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : 'Failed to delete file',
        variant: "destructive",
      });
    }
  };

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No files uploaded yet. Start by uploading your first file!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {files.map((file) => (
        <Card key={file.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="aspect-square mb-3 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {isImage(file.file_type) ? (
                <img
                  src={file.file_url}
                  alt={file.file_name}
                  className="w-full h-full object-cover"
                />
              ) : isVideo(file.file_type) ? (
                <video
                  src={file.file_url}
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <div className="text-4xl text-muted-foreground">📄</div>
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium truncate" title={file.file_name}>
                {file.file_name}
              </h3>
              
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className={getFileTypeColor(file.file_type)}>
                  {file.file_type.split('/')[0]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.file_size)}
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Uploaded {formatDate(file.uploaded_at)}
              </p>
              
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(file)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(file)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FileGrid;
