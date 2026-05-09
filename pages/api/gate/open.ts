// Vercel Serverless Function — POST /api/gate/open
// This is a Vercel edge/serverless function that runs server-side.
// It uses the SUPABASE_SERVICE_ROLE_KEY which must be set in Vercel env vars.
// The client-side OpenDoorButton also calls Supabase directly (using anon key + RLS)
// as a fallback for local development where this serverless function isn't available.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      success: false,
      message: 'Server misconfiguration: missing Supabase credentials',
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await supabaseAdmin
      .from('gym_settings')
      .update({ pending_door_open: true })
      .eq('id', 1);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Door opening in ~5 seconds',
    });
  } catch (err: any) {
    console.error('Door open error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Unknown error',
    });
  }
}
