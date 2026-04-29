// netlify/functions/paypal-webhook.js
// Handles PayPal webhook events and updates Supabase + sends email

const { createClient } = require('@supabase/supabase-js');

// Environment variables (set in Netlify dashboard)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service role key (not public)
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'live'; // 'sandbox' or 'live'

const PAYPAL_API = PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Plan mapping
const PLAN_MAP = {
  'P-41N09220EC076120XNHY6LVI': 'team',   // Team plan ID
  '94Y2Y49X9PKHL': 'pro',                  // Pro plan ID
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const eventType = body.event_type;

    console.log('PayPal webhook received:', eventType);

    // Verify webhook signature with PayPal
    const isValid = await verifyWebhook(event.headers, event.body);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return { statusCode: 400, body: 'Invalid webhook signature' };
    }

    // Handle subscription activated
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' ||
        eventType === 'PAYMENT.SALE.COMPLETED') {

      const resource = body.resource;
      const subscriptionId = resource.id || resource.billing_agreement_id;
      const planId = resource.plan_id || '';
      const subscriberEmail = resource.subscriber?.email_address ||
                              resource.payer?.payer_info?.email;

      if (!subscriberEmail) {
        console.error('No subscriber email found in webhook');
        return { statusCode: 400, body: 'No subscriber email' };
      }

      // Determine plan
      const plan = PLAN_MAP[planId] || 'pro';

      // Update user in Supabase
      await upgradeUserInSupabase(subscriberEmail, plan, subscriptionId);

      // Send welcome email
      await sendWelcomeEmail(subscriberEmail, plan);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: `User ${subscriberEmail} upgraded to ${plan}` })
      };
    }

    // Handle subscription cancelled
    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
        eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const resource = body.resource;
      const subscriberEmail = resource.subscriber?.email_address;
      if (subscriberEmail) {
        await downgradeUserInSupabase(subscriberEmail);
      }
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // Other events — just acknowledge
    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 500, body: 'Internal server error: ' + err.message };
  }
};

// ===================== VERIFY PAYPAL WEBHOOK =====================
async function verifyWebhook(headers, rawBody) {
  try {
    // Get PayPal access token
    const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Verify signature
    const verifyRes = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody)
      })
    });

    const verifyData = await verifyRes.json();
    return verifyData.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('Webhook verification error:', err);
    // In development, skip verification
    return process.env.NODE_ENV === 'development';
  }
}

// ===================== UPGRADE USER IN SUPABASE =====================
async function upgradeUserInSupabase(email, plan, subscriptionId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Update user metadata with plan info
  const { data: users, error: fetchError } = await supabase
    .from('auth.users')
    .select('id')
    .eq('email', email)
    .single();

  if (fetchError) {
    // Try using admin API to find user by email
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const user = data.users.find(u => u.email === email);
    if (!user) {
      console.error('User not found:', email);
      return;
    }

    // Update user metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        plan: plan,
        plan_activated_at: new Date().toISOString(),
        subscription_id: subscriptionId,
        is_pro: true
      }
    });

    if (updateError) throw updateError;
    console.log(`✅ User ${email} upgraded to ${plan}`);
  }
}

// ===================== DOWNGRADE USER IN SUPABASE =====================
async function downgradeUserInSupabase(email) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;

  const user = data.users.find(u => u.email === email);
  if (!user) return;

  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      plan: 'free',
      is_pro: false,
      plan_cancelled_at: new Date().toISOString()
    }
  });

  console.log(`User ${email} downgraded to free`);
}

// ===================== SEND WELCOME EMAIL =====================
async function sendWelcomeEmail(email, plan) {
  if (!RESEND_API_KEY) {
    console.log('No RESEND_API_KEY set, skipping email');
    return;
  }

  const planName = plan === 'team' ? 'Team' : 'Pro';
  const planFeatures = plan === 'team'
    ? ['Everything in Pro', '5+ team users', 'Shared workspace', 'Admin dashboard', 'API access']
    : ['Unlimited tasks', 'Files up to 1 GB', 'All AI-powered tools', 'Batch processing', 'Priority support'];

  const featuresHtml = planFeatures.map(f => `<li style="margin:8px 0;">✅ ${f}</li>`).join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'hello@5iles.com',
      to: email,
      subject: `🎉 Welcome to 5iles ${planName}!`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#f0f0f8;padding:40px;border-radius:16px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="background:linear-gradient(135deg,#6c63ff,#ff6584);width:60px;height:60px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:900;color:#fff;">5</div>
            <h1 style="color:#f0f0f8;margin-top:16px;">Welcome to 5iles ${planName}! 🎉</h1>
          </div>
          <p style="color:#9090b0;font-size:1rem;line-height:1.7;">Your subscription is now <strong style="color:#43e97b;">active</strong>. Here's what you now have access to:</p>
          <ul style="list-style:none;padding:0;background:#13131a;border-radius:12px;padding:20px;margin:24px 0;">
            ${featuresHtml}
          </ul>
          <div style="text-align:center;margin-top:32px;">
            <a href="https://5iles.com" style="background:linear-gradient(135deg,#6c63ff,#8b7fff);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;">
              Start using 5iles ${planName} →
            </a>
          </div>
          <p style="color:#5a5a7a;font-size:0.8rem;text-align:center;margin-top:32px;">
            Questions? Reply to this email or contact us at hello@5iles.com
          </p>
        </div>
      `
    })
  });

  if (!res.ok) {
    console.error('Email send failed:', await res.text());
  } else {
    console.log(`✅ Welcome email sent to ${email}`);
  }
}
