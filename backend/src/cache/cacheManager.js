const { createClient } = require('redis');
const ConsistentHashRing = require('./consistentHash');
const config = require('../config');

class CacheManager {
  constructor() {
    this.clients = new Map();
    this.ring = null;
    this.stats = { hits: 0, misses: 0 };
  }

  async initialize() {
    const nodeNames = [];
    for (let i = 0; i < config.redis.nodeCount; i++) {
      const nodeName = `node-${i}`;
      nodeNames.push(nodeName);

      const client = createClient({
        socket: { host: config.redis.host, port: config.redis.port },
        database: i,
      });

      client.on('error', (err) => {
        console.error(`[Cache] Redis ${nodeName} error:`, err.message);
      });

      await client.connect();
      this.clients.set(nodeName, client);
      console.log(`[Cache] Connected to Redis ${nodeName} (db ${i})`);
    }

    this.ring = new ConsistentHashRing(nodeNames, config.cache.virtualNodes);
    console.log(`[Cache] Consistent hash ring initialized with ${nodeNames.length} nodes, ${config.cache.virtualNodes} virtual nodes each`);
  }

  _getClientForKey(key) {
    const { node, hashValue } = this.ring.getNode(key);
    const client = this.clients.get(node);
    return { client, node, hashValue };
  }

  async get(prefix) {
    const { client, node, hashValue } = this._getClientForKey(prefix);
    const cacheKey = `suggest:${prefix}`;
    const data = await client.get(cacheKey);

    if (data) {
      this.stats.hits++;
      console.log(`[Cache] prefix="${prefix}" → hash=${hashValue} → ${node} → HIT`);
      return { data: JSON.parse(data), node, hashValue, hit: true };
    }

    this.stats.misses++;
    console.log(`[Cache] prefix="${prefix}" → hash=${hashValue} → ${node} → MISS`);
    return { data: null, node, hashValue, hit: false };
  }

  async set(prefix, data) {
    const { client } = this._getClientForKey(prefix);
    const cacheKey = `suggest:${prefix}`;
    await client.set(cacheKey, JSON.stringify(data), { EX: config.cache.ttl });
  }

  async invalidate(prefix) {
    const { client, node } = this._getClientForKey(prefix);
    const cacheKey = `suggest:${prefix}`;
    await client.del(cacheKey);
    console.log(`[Cache] Invalidated prefix="${prefix}" on ${node}`);
  }

  async invalidatePrefixes(query) {
    for (let i = 1; i <= query.length; i++) {
      const prefix = query.substring(0, i);
      await this.invalidate(prefix);
    }
  }

  async debugPrefix(prefix) {
    const { client, node, hashValue } = this._getClientForKey(prefix);
    const cacheKey = `suggest:${prefix}`;
    const data = await client.get(cacheKey);

    return {
      prefix,
      hashValue,
      assignedNode: node,
      redisDb: parseInt(node.split('-')[1]),
      cacheHit: data !== null,
      cachedData: data ? JSON.parse(data) : null,
      totalNodes: this.ring.getNodeList(),
    };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
    };
  }

  async getRecentSearchClient() {
    return this.clients.get('node-0');
  }

  async close() {
    for (const [name, client] of this.clients) {
      await client.quit();
      console.log(`[Cache] Disconnected ${name}`);
    }
  }
}

module.exports = new CacheManager();
