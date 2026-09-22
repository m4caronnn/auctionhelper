// Vercel Serverless Function: GET /api/get-share?id=xxx
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'Missing short ID' });
  }

  try {
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
      return res.status(500).json({ error: 'Vercel Database environment variables not found' });
    }

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

    // Try POST array format first
    let storedData = null;
    try {
      let kvRes = await fetch(restUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', `share:${id}`])
      });
      if (kvRes.ok) {
        const json = await kvRes.json();
        storedData = json && json.result;
      }
    } catch (e) {}

    // Fallback to GET endpoint format
    if (!storedData) {
      const getEndpoint = `${restUrl}/get/share:${id}`;
      const resGet = await fetch(getEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resGet.ok) {
        const json = await resGet.json();
        storedData = json && json.result;
      }
    }

    if (!storedData) {
      return res.status(404).json({ error: 'Share ID not found or expired' });
    }

    return res.status(200).json({ data: storedData });
  } catch (err) {
    console.error('Get share handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
