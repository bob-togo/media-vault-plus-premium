
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserFiles } from '@/hooks/useUserFiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import FileUpload from '@/components/FileUpload';
import FileGrid from '@/components/FileGrid';
import UpgradeButton from '@/components/UpgradeButton';
import { useToast } from '@/hooks/use-toast';
import { LogOut, HardDrive, Crown, Cloud } from 'lucide-react';

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

  const handleUpgradeComplete = async () => {
    await refreshProfile();
    toast({
      title: "Welcome to Premium!",
      description: "Your storage limit has been increased to 10GB.",
    });
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
  const isPremium = profile?.plan_type === 'premium';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Cloud className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold">MediaVault</h1>
                <p className="text-muted-foreground">Welcome back, {user?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UpgradeButton userProfile={profile} onUpgradeComplete={handleUpgradeComplete} />
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Plan Status & Storage Usage */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className={isPremium ? "border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isPremium ? <Crown className="h-5 w-5 text-purple-600" /> : <HardDrive className="h-5 w-5" />}
                Current Plan
              </CardTitle>
              <CardDescription>
                {isPremium ? 'Premium Plan - Enjoy enhanced features' : 'Free Plan - Upgrade for more storage'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">
                    {isPremium ? 'Premium' : 'Free'}
                  </span>
                  {isPremium && (
                    <div className="flex items-center gap-1 text-purple-600">
                      <Crown className="h-4 w-4" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isPremium ? '10GB storage with premium features' : '2GB storage included'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Usage
              </CardTitle>
              <CardDescription>
                Track your current storage consumption
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>{formatFileSize(storageUsed)} used</span>
                  <span>{formatFileSize(storageLimit)} total</span>
                </div>
                <Progress 
                  value={storagePercentage} 
                  className={`h-3 ${storagePercentage > 90 ? 'bg-red-100' : storagePercentage > 75 ? 'bg-yellow-100' : 'bg-green-100'}`}
                />
                <p className="text-xs text-muted-foreground">
                  {(100 - storagePercentage).toFixed(1)}% available
                  {storagePercentage > 90 && (
                    <span className="text-red-600 ml-2">⚠️ Storage almost full</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* File Upload */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
          <FileUpload onUploadComplete={handleUploadComplete} userProfile={profile} />
        </div>

        {/* Files Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Files ({files.length})</h2>
            {files.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Total size: {formatFileSize(files.reduce((sum, file) => sum + file.file_size, 0))}
              </p>
            )}
          </div>
          <FileGrid files={files} onDeleteFile={handleDeleteFile} />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
