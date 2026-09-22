// Vercel Serverless Function: POST /api/shorten
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    const data = body && body.data;
    if (!data) {
      return res.status(400).json({ error: 'Missing data payload' });
    }

    // Generate 6-character random alphanumeric ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let shortId = '';
    for (let i = 0; i < 6; i++) {
      shortId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
      return res.status(500).json({ error: 'Vercel KV Database environment variables not configured' });
    }

    // Store data in Vercel KV with 90-day TTL (7,776,000 seconds)
    const kvEndpoint = `${kvUrl}/set/share:${shortId}/${encodeURIComponent(data)}?EX=7776000`;
    const kvRes = await fetch(kvEndpoint, {
      headers: {
        Authorization: `Bearer ${kvToken}`
      }
    });

    if (!kvRes.ok) {
      const errText = await kvRes.text();
      console.error('KV SET failed:', errText);
      return res.status(500).json({ error: 'Failed to save to Vercel KV' });
    }

    return res.status(200).json({ shortId });
  } catch (err) {
    console.error('Shorten handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
