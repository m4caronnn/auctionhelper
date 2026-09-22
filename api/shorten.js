// Vercel Serverless Function: POST /api/shorten
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    // Find KV / Redis REST API URL & Token across all possible Vercel env var names
    let rawUrl = process.env.KV_REST_API_URL 
      || process.env.STORAGE_REST_API_URL 
      || process.env.UPSTASH_REDIS_REST_URL 
      || process.env.REDIS_REST_API_URL
      || process.env.STORAGE_URL
      || process.env.REDIS_URL
      || process.env.KV_URL;

    let token = process.env.KV_REST_API_TOKEN 
      || process.env.STORAGE_REST_API_TOKEN 
      || process.env.UPSTASH_REDIS_REST_TOKEN 
      || process.env.REDIS_REST_API_TOKEN
      || process.env.STORAGE_PASSWORD
      || process.env.REDIS_PASSWORD;

    if (!rawUrl || !token) {
      console.error('Env vars missing. Available env keys:', Object.keys(process.env).filter(k => k.includes('REST') || k.includes('STORAGE') || k.includes('REDIS') || k.includes('KV')));
      return res.status(500).json({ 
        error: 'Vercel Database environment variables not found. Please Redeploy on Vercel Dashboard.' 
      });
    }

    // Format REST URL
    let restUrl = rawUrl.trim();
    if (restUrl.startsWith('redis://') || restUrl.startsWith('rediss://')) {
      const parts = restUrl.split('@');
      if (parts.length > 1) {
        const hostPort = parts[1].split('/')[0];
        const host = hostPort.split(':')[0];
        restUrl = `https://${host}`;
      }
    }
    if (!restUrl.startsWith('http://') && !restUrl.startsWith('https://')) {
      restUrl = `https://${restUrl}`;
    }
    restUrl = restUrl.replace(/\/+$/, '');

    // Generate 6-char random alphanumeric ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let shortId = '';
    for (let i = 0; i < 6; i++) {
      shortId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Try Upstash / Redis REST POST array format first
    let kvRes = await fetch(restUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SET', `share:${shortId}`, data, 'EX', 7776000])
    });

    // Fallback to GET endpoint format if POST array format didn't match
    if (!kvRes.ok) {
      const getEndpoint = `${restUrl}/set/share:${shortId}/${encodeURIComponent(data)}?EX=7776000`;
      kvRes = await fetch(getEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    if (!kvRes.ok) {
      const errText = await kvRes.text();
      console.error('KV SET failed:', errText);
      return res.status(500).json({ error: 'Failed to write to Redis database' });
    }

    return res.status(200).json({ shortId });
  } catch (err) {
    console.error('Shorten handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
