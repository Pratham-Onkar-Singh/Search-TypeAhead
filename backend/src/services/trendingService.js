const { createClient } = require('redis');
const pool = require('../db');
const config = require('../config');

const RECENT_SEARCHES_KEY = 'recent_searches';

let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      socket: { host: config.redis.host, port: config.redis.port },
      database: config.redis.nodeCount,
    });
    redisClient.on('error', (err) => console.error('[Trending] Redis error:', err.message));
    await redisClient.connect();
    console.log(`[Trending] Connected to Redis db ${config.redis.nodeCount} for recent searches`);
  }
  return redisClient;
}

async function recordRecentSearch(query) {
  const client = await getRedisClient();
  const now = Date.now();
  await client.zAdd(RECENT_SEARCHES_KEY, { score: now, value: query });

  const cutoff = now - config.trending.windowSeconds * 1000;
  await client.zRemRangeByScore(RECENT_SEARCHES_KEY, 0, cutoff);
}

async function getRecentCount(query) {
  const client = await getRedisClient();
  const now = Date.now();
  const cutoff = now - config.trending.windowSeconds * 1000;

  const entries = await client.zRangeByScore(RECENT_SEARCHES_KEY, cutoff, now);
  return entries.filter((q) => q === query).length;
}

async function rankWithRecency(suggestions) {
  if (suggestions.length === 0) return suggestions;

  const maxCount = Math.max(...suggestions.map((s) => s.count), 1);

  const client = await getRedisClient();
  const now = Date.now();
  const cutoff = now - config.trending.windowSeconds * 1000;
  const recentEntries = await client.zRangeByScore(RECENT_SEARCHES_KEY, cutoff, now);

  const recentCounts = new Map();
  for (const q of recentEntries) {
    recentCounts.set(q, (recentCounts.get(q) || 0) + 1);
  }

  const maxRecent = Math.max(...Array.from(recentCounts.values()), 1);

  const scored = suggestions.map((s) => {
    const normalizedTotal = s.count / maxCount;
    const recentCount = recentCounts.get(s.query) || 0;
    const normalizedRecent = recentCount / maxRecent;
    const score = config.trending.totalWeight * normalizedTotal +
                  config.trending.recentWeight * normalizedRecent;

    return { ...s, score: parseFloat(score.toFixed(4)), recentCount };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

async function getTrending(limit = 10) {
  const result = await pool.query(
    `SELECT query, count FROM search_queries ORDER BY count DESC LIMIT $1`,
    [limit * 2]
  );

  const ranked = await rankWithRecency(result.rows);
  return ranked.slice(0, limit);
}

async function close() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

module.exports = { recordRecentSearch, getRecentCount, rankWithRecency, getTrending, close };
