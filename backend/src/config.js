require('dotenv').config();

module.exports = {
  db: {
    host: process.env.DB_HOST || '/var/run/postgresql',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'typeahead',
    user: process.env.DB_USER || process.env.USER || 'postgres',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    nodeCount: parseInt(process.env.CACHE_NODE_COUNT || '3'),
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '60'),
    virtualNodes: parseInt(process.env.VIRTUAL_NODES || '150'),
  },
  batch: {
    flushInterval: parseInt(process.env.BATCH_FLUSH_INTERVAL || '5000'),
    maxBufferSize: parseInt(process.env.BATCH_MAX_SIZE || '50'),
  },
  trending: {
    windowSeconds: parseInt(process.env.TRENDING_WINDOW || '3600'),
    totalWeight: parseFloat(process.env.TRENDING_TOTAL_WEIGHT || '0.6'),
    recentWeight: parseFloat(process.env.TRENDING_RECENT_WEIGHT || '0.4'),
  },
  server: {
    port: parseInt(process.env.PORT || '5000'),
  },
};
