// netlify/functions/referral-check.js
// Securely checks whether a referrer has reached 10 completed referrals,
// and if so, grants them a 30-day Pro reward. Uses the service-role key
// because referral_reward_until is locked down from direct browser writes
// (see the REVOKE UPDATE ... FROM authenticated in the schema) — this is
// the only path allowed to write that column.
//
// IMPORTANT: this never trusts a count sent by the browser. It always
// recomputes the real count itself from the referrals table, so a
// tampered client request can't fake a reward.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const REFERRALS_REQUIRED = 10;
const REWARD_DAYS = 30;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let referrerId;
  try {
    ({ referrerId } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, body: 'Invalid request body' };
  }
  if (!referrerId) {
    return { statusCode: 400, body: 'Missing referrerId' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Recompute the real count ourselves — never trust a client-supplied number.
    const { count, error: countError } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .eq('completed_conversion', true);

    if (countError) throw countError;

    if (count < REFERRALS_REQUIRED) {
      return { statusCode: 200, body: JSON.stringify({ rewarded: false, count }) };
    }

    // Don't re-grant on every subsequent call once already rewarded for
    // reaching 10 (no stacking/repeat rewards in this version).
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_reward_until')
      .eq('id', referrerId)
      .single();

    if (profileError) throw profileError;

    const alreadyActive = profile.referral_reward_until && new Date(profile.referral_reward_until) > new Date();
    if (alreadyActive) {
      return { statusCode: 200, body: JSON.stringify({ rewarded: false, alreadyActive: true, count }) };
    }

    const rewardUntil = new Date();
    rewardUntil.setDate(rewardUntil.getDate() + REWARD_DAYS);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referral_reward_until: rewardUntil.toISOString() })
      .eq('id', referrerId);

    if (updateError) throw updateError;

    // Fetch the email via the admin API (not assuming profiles stores it) to notify them.
    const { data: userData } = await supabase.auth.admin.getUserById(referrerId);
    if (userData?.user?.email) {
      await sendRewardEmail(userData.user.email, rewardUntil);
    }

    return { statusCode: 200, body: JSON.stringify({ rewarded: true, until: rewardUntil.toISOString() }) };
  } catch (err) {
    console.error('Referral check error:', err);
    return { statusCode: 500, body: 'Internal server error: ' + err.message };
  }
};

async function sendRewardEmail(email, until) {
  if (!RESEND_API_KEY) {
    console.log('No RESEND_API_KEY set, skipping email');
    return;
  }
  const untilStr = until.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'hello@5iles.com',
      to: email,
      subject: '🎉 You unlocked a free month of 5iles Pro!',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#f0f0f8;padding:40px;border-radius:16px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="background:linear-gradient(135deg,#6c63ff,#ff6584);width:60px;height:60px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:900;color:#fff;">5</div>
            <h1 style="color:#f0f0f8;margin-top:16px;">You did it! 🎉</h1>
          </div>
          <p style="color:#9090b0;font-size:1rem;line-height:1.7;">10 people joined 5iles through your referral link — your free month of <strong style="color:#43e97b;">Pro</strong> is now active until <strong style="color:#f0f0f8;">${untilStr}</strong>.</p>
          <div style="text-align:center;margin-top:32px;">
            <a href="https://5iles.com" style="background:linear-gradient(135deg,#6c63ff,#8b7fff);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;">
              Start using 5iles Pro →
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
    console.error('Reward email send failed:', await res.text());
  }
}
