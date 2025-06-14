
import React from 'react';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { useRazorpay } from '@/hooks/useRazorpay';
import { UserProfile } from '@/hooks/useUserProfile';

interface UpgradeButtonProps {
  userProfile: UserProfile | null;
  onUpgradeComplete: () => void;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({ userProfile, onUpgradeComplete }) => {
  const { initializePayment, loading } = useRazorpay();

  const handleUpgrade = () => {
    initializePayment(99, onUpgradeComplete);
  };

  if (userProfile?.plan_type === 'premium') {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <Crown className="h-5 w-5" />
        <span className="font-medium">Premium Plan Active</span>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleUpgrade} 
      disabled={loading}
      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
    >
      <Crown className="h-4 w-4 mr-2" />
      {loading ? 'Processing...' : 'Upgrade to Premium - ₹99'}
    </Button>
  );
};

export default UpgradeButton;
