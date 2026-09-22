// Vercel Serverless Function: GET /api/get-share?id=xxx
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'Missing short ID' });
  }

  try {
    const kvUrl = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL || process.env.STORAGE_URL || process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN || process.env.STORAGE_TOKEN || process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!kvUrl || !kvToken) {
      return res.status(500).json({ error: 'Vercel KV Database environment variables not configured' });
    }

    // Fetch data from Vercel KV REST API
    const kvEndpoint = `${kvUrl}/get/share:${id}`;
    const kvRes = await fetch(kvEndpoint, {
      headers: {
        Authorization: `Bearer ${kvToken}`
      }
    });

    if (!kvRes.ok) {
      return res.status(404).json({ error: 'Share ID not found' });
    }

    const json = await kvRes.json();
    const storedData = json && json.result;

    if (!storedData) {
      return res.status(404).json({ error: 'Share data expired or not found' });
    }

    return res.status(200).json({ data: storedData });
  } catch (err) {
    console.error('Get share handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
