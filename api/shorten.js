// Vercel Serverless Function: POST /api/shorten
import Redis from 'ioredis';

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

    // Read Redis URL from environment variables
    const redisUrl = process.env.REDIS_URL 
      || process.env.STORAGE_URL 
      || process.env.KV_URL 
      || process.env.KV_REST_API_URL;

    if (!redisUrl) {
      return res.status(500).json({ error: 'REDIS_URL environment variable is missing on Vercel' });
    }

    // Generate 6-character random alphanumeric ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let shortId = '';
    for (let i = 0; i < 6; i++) {
      shortId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Connect to Redis Cloud using ioredis TCP socket
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined
    });

    // Save key in Redis with 90-day TTL (7,776,000 seconds)
    await redis.set(`share:${shortId}`, data, 'EX', 7776000);
    await redis.quit();

    return res.status(200).json({ shortId });
  } catch (err) {
    console.error('Redis shorten error:', err);
    return res.status(500).json({ error: err.message || 'Failed to write to Redis database' });
  }
}
