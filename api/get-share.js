// Vercel Serverless Function: GET /api/get-share?id=xxx
import Redis from 'ioredis';

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
    const redisUrl = process.env.REDIS_URL 
      || process.env.STORAGE_URL 
      || process.env.KV_URL 
      || process.env.KV_REST_API_URL;

    if (!redisUrl) {
      return res.status(500).json({ error: 'REDIS_URL environment variable is missing on Vercel' });
    }

    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    });

    const storedData = await redis.get(`share:${id}`);
    await redis.quit();

    if (!storedData) {
      return res.status(404).json({ error: 'Share ID not found or expired' });
    }

    return res.status(200).json({ data: storedData });
  } catch (err) {
    console.error('Redis get-share error:', err);
    return res.status(500).json({ error: err.message || 'Failed to read from Redis database' });
  }
}
