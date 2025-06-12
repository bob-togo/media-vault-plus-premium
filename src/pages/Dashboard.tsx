
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserFiles } from '@/hooks/useUserFiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import FileUpload from '@/components/FileUpload';
import FileGrid from '@/components/FileGrid';
import { useToast } from '@/hooks/use-toast';
import { LogOut, HardDrive } from 'lucide-react';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, refreshProfile } = useUserProfile();
  const { files, loading: filesLoading, fetchFiles, deleteFile } = useUserFiles();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUploadComplete = async () => {
    await Promise.all([fetchFiles(), refreshProfile()]);
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    await deleteFile(fileId, filePath);
    await refreshProfile(); // Refresh to update storage usage
  };

  if (profileLoading || filesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const storageUsed = profile?.storage_used || 0;
  const storageLimit = profile?.storage_limit || 0;
  const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Media Vault</h1>
              <p className="text-muted-foreground">Welcome back, {user?.email}</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Storage Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Usage
            </CardTitle>
            <CardDescription>
              {profile?.plan_type === 'premium' ? 'Premium Plan' : 'Free Plan'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{formatFileSize(storageUsed)} used</span>
                <span>{formatFileSize(storageLimit)} total</span>
              </div>
              <Progress value={storagePercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {(100 - storagePercentage).toFixed(1)}% available
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
          <FileUpload onUploadComplete={handleUploadComplete} userProfile={profile} />
        </div>

        {/* Files Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Files ({files.length})</h2>
          <FileGrid files={files} onDeleteFile={handleDeleteFile} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
