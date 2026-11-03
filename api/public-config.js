export default function handler(_request, response) {
  const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    response.status(503).json({ error: 'Supabase public configuration is missing.' });
    return;
  }

  response
    .setHeader('Cache-Control', 'no-store')
    .setHeader('X-Content-Type-Options', 'nosniff')
    .status(200)
    .json({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY });
}
