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
    const longUrl = body && body.longUrl;

    if (!data && !longUrl) {
      return res.status(400).json({ error: 'Missing data or longUrl payload' });
    }

    // Find REST URL & Token if Vercel KV / Upstash REST API is configured
    let rawUrl = process.env.KV_REST_API_URL 
      || process.env.STORAGE_REST_API_URL 
      || process.env.UPSTASH_REDIS_REST_URL 
      || process.env.REDIS_REST_API_URL;

    let token = process.env.KV_REST_API_TOKEN 
      || process.env.STORAGE_REST_API_TOKEN 
      || process.env.UPSTASH_REDIS_REST_TOKEN 
      || process.env.REDIS_REST_API_TOKEN;

    // 1. Try Vercel KV / Upstash REST API if available
    if (rawUrl && token && data) {
      let restUrl = rawUrl.trim();
      if (!restUrl.startsWith('http://') && !restUrl.startsWith('https://')) {
        restUrl = `https://${restUrl}`;
      }
      restUrl = restUrl.replace(/\/+$/, '');

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let shortId = '';
      for (let i = 0; i < 6; i++) {
        shortId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      try {
        let kvRes = await fetch(restUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(['SET', `share:${shortId}`, data, 'EX', 7776000])
        });

        if (kvRes.ok) {
          return res.status(200).json({ shortId });
        }
      } catch (e) {
        console.warn('Vercel KV REST write failed, fallback to TinyURL:', e);
      }
    }

    // 2. Fallback: Use TinyURL API to shorten longUrl
    if (longUrl) {
      try {
        const tinyRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (tinyRes.ok) {
          const shortUrlText = await tinyRes.text();
          if (shortUrlText && shortUrlText.startsWith('http')) {
            return res.status(200).json({ shortUrl: shortUrlText.trim() });
          }
        }
      } catch (e) {
        console.warn('TinyURL API error:', e);
      }
    }

    return res.status(500).json({ error: 'Could not shorten URL' });
  } catch (err) {
    console.error('Shorten handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
