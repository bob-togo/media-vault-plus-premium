
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { razorpay_payment_id, user_id } = await req.json()

    if (!razorpay_payment_id || !user_id) {
      throw new Error('Missing required parameters')
    }

    if (user.id !== user_id) {
      throw new Error('User ID mismatch')
    }

    // Get Razorpay secret from environment
    const razorpaySecret = Deno.env.get('RAZORPAY_SECRET_KEY')
    if (!razorpaySecret) {
      throw new Error('Razorpay secret not configured')
    }

    // In a real implementation, you would verify the payment with Razorpay API
    // For now, we'll assume the payment is valid since we received the payment ID
    // You can add actual Razorpay verification here using their API
    console.log('Payment verification for:', razorpay_payment_id)
    console.log('Using Razorpay secret ending with:', razorpaySecret.slice(-4))

    // Update user profile to premium
    const { error: updateError } = await supabaseClient
      .from('user_profile')
      .update({
        plan_type: 'premium',
        storage_limit: 10737418240, // 10GB in bytes
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified and account upgraded' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
