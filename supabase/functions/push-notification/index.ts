import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to validate subscription structure
const isValidSubscription = (sub: any): boolean => {
  const isValid = sub && 
    typeof sub.endpoint === 'string' &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string';
  
  if (!isValid) {
    console.error('❌ Invalid subscription structure:', JSON.stringify(sub, null, 2));
  }
  
  return isValid;
};

// Helper to convert subscription object to separate fields
const subscriptionToFields = (subscription: any) => {
  if (!isValidSubscription(subscription)) {
    throw new Error('Invalid subscription format');
  }
  return {
    endpoint: subscription.endpoint,
    p256dh_key: subscription.keys.p256dh,
    auth_key: subscription.keys.auth
  };
};

// Helper to convert separate fields back to subscription object
const fieldsToSubscription = (fields: any) => {
  return {
    endpoint: fields.endpoint,
    keys: {
      p256dh: fields.p256dh_key,
      auth: fields.auth_key
    }
  };
};

// Helper to send push notification using Web Push Protocol
async function sendWebPushNotification(
  subscription: any,
  payload: string,
  vapidDetails: { publicKey: string; privateKey: string; subject: string }
): Promise<Response> {
  console.log('📤 Preparando envio de push notification...');
  
  // Import web-push-deno library
  const webpush = await import('https://deno.land/x/web_push@0.0.6/mod.ts');
  
  console.log('🔐 Configurando VAPID...');
  webpush.setVapidDetails(
    vapidDetails.subject,
    vapidDetails.publicKey,
    vapidDetails.privateKey
  );
  
  console.log('📨 Enviando notificação...');
  try {
    await webpush.sendNotification(subscription, payload);
    console.log('✅ Notificação enviada com sucesso');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('❌ Erro ao enviar push:', error);
    
    // Check if subscription is invalid
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log('🔕 Subscription inválida, precisa ser removida');
      throw new Error('INVALID_SUBSCRIPTION');
    }
    
    throw error;
  }
}

serve(async (req) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // POST /register - Register/update push subscription
    if (path === 'register' && req.method === 'POST') {
      const body = await req.json();
      const { userId, subscription } = body;
      
      console.log('📥 Registrando subscription para user:', userId);
      console.log('📋 Dados recebidos:', {
        userId,
        hasSubscription: !!subscription,
        endpoint: subscription?.endpoint?.substring(0, 50) + '...',
        hasKeys: !!subscription?.keys
      });

      if (!userId || !subscription) {
        console.error('❌ Dados incompletos:', { userId: !!userId, subscription: !!subscription });
        return new Response(
          JSON.stringify({ error: 'userId and subscription are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate and convert subscription
      let fields;
      try {
        fields = subscriptionToFields(subscription);
        console.log('✅ Subscription convertida para campos separados');
      } catch (error) {
        console.error('❌ Erro ao converter subscription:', error);
        return new Response(
          JSON.stringify({ error: 'Invalid subscription format: ' + (error as Error).message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert subscription
      console.log('💾 Salvando no banco de dados...');
      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          ...fields,
          is_active: true
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error('❌ Erro ao salvar no banco:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Subscription salva com sucesso:', data);
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /send - Send push notification
    if (path === 'send' && req.method === 'POST') {
      const { recipientId, senderName, messageContent, messageId } = await req.json();
      
      console.log('📤 Sending push to:', recipientId, 'from:', senderName);

      if (!recipientId || !senderName || !messageContent) {
        return new Response(
          JSON.stringify({ error: 'recipientId, senderName, and messageContent are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get active subscription
      const { data: subData, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', recipientId)
        .eq('is_active', true)
        .single();

      if (subError || !subData) {
        console.log('⚠️ Nenhuma subscription ativa encontrada para:', recipientId);
        return new Response(
          JSON.stringify({ error: 'No active subscription found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Subscription encontrada no banco');

      // Reconstruct subscription object
      const subscription = fieldsToSubscription(subData);

      // Get VAPID keys
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
      const vapidEmail = Deno.env.get('VAPID_EMAIL');

      if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
        console.error('❌ VAPID keys não configuradas');
        return new Response(
          JSON.stringify({ error: 'Server configuration error: VAPID keys missing' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build notification payload
      const payload = JSON.stringify({
        title: `Nova mensagem de ${senderName}`,
        body: messageContent,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        tag: messageId ? `message-${messageId}` : 'message',
        data: {
          messageId,
          url: '/chat'
        }
      });

      try {
        const response = await sendWebPushNotification(
          subscription,
          payload,
          {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
            subject: `mailto:${vapidEmail}`
          }
        );

        console.log('✅ Push enviado com sucesso para:', recipientId);
        return response;
      } catch (error: any) {
        console.error('❌ Erro ao enviar push:', error);
        
        // If subscription is invalid, mark as inactive
        if (error.message === 'INVALID_SUBSCRIPTION') {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('user_id', recipientId);
          console.log('🔕 Subscription marcada como inativa');
        }
        
        return new Response(
          JSON.stringify({ error: 'Failed to send push notification: ' + error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // POST /unregister - Deactivate subscription
    if (path === 'unregister' && req.method === 'POST') {
      const { userId } = await req.json();
      
      console.log('🔕 Unregistering subscription for user:', userId);

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error unregistering:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Subscription desativada com sucesso');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
