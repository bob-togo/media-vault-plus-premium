
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const useRazorpay = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const initializePayment = async (amount: number, onSuccess: () => void) => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const res = await loadRazorpay();
      if (!res) {
        throw new Error('Razorpay SDK failed to load');
      }

      const options = {
        key: 'rzp_test_kzeVYqRFHs9nyo', // Your Razorpay test key ID
        amount: amount * 100, // Amount in paise
        currency: 'INR',
        name: 'MediaVault',
        description: 'Premium Plan Upgrade',
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        handler: async (response: any) => {
          try {
            // Call edge function to verify payment and upgrade user
            const { data, error } = await supabase.functions.invoke('verify-payment', {
              body: {
                razorpay_payment_id: response.razorpay_payment_id,
                user_id: user.id,
              },
            });

            if (error) throw error;

            toast({
              title: "Payment Successful!",
              description: "Your account has been upgraded to Premium.",
            });

            onSuccess();
          } catch (error) {
            console.error('Payment verification failed:', error);
            toast({
              title: "Payment Verification Failed",
              description: "Please contact support if money was deducted.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#3B82F6',
        },
        modal: {
          ondismiss: () => {
            toast({
              title: "Payment Cancelled",
              description: "You can upgrade anytime from your dashboard.",
            });
          },
        },
        notes: {
          purpose: 'Premium Plan Upgrade',
          user_id: user.id,
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment initialization failed:', error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : 'Unable to initialize payment',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { initializePayment, loading };
};
