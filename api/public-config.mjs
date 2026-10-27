export default function handler(_request, response) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

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
