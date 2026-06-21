const pool = require('../db');
const config = require('../config');
const cacheManager = require('../cache/cacheManager');

class BatchWriter {
  constructor() {
    this.buffer = new Map();
    this.totalSubmissions = 0;
    this.totalFlushes = 0;
    this.totalDbWrites = 0;
    this.totalWritesSaved = 0;
    this.flushTimer = null;
  }

  start() {
    this.flushTimer = setInterval(() => {
      if (this.buffer.size > 0) {
        this.flush().catch((err) => console.error('[BatchWriter] Timer flush error:', err));
      }
    }, config.batch.flushInterval);

    console.log(`[BatchWriter] Started (flushInterval=${config.batch.flushInterval}ms, maxSize=${config.batch.maxBufferSize})`);
  }

  async add(query) {
    this.totalSubmissions++;
    const current = this.buffer.get(query) || 0;
    this.buffer.set(query, current + 1);

    if (this.buffer.size >= config.batch.maxBufferSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.buffer.size === 0) return;

    const entries = Array.from(this.buffer.entries());
    const batchSize = entries.length;
    const totalInBatch = entries.reduce((sum, [, count]) => sum + count, 0);

    this.buffer.clear();

    const values = [];
    const placeholders = [];
    let paramIdx = 1;

    for (const [query, count] of entries) {
      placeholders.push(`($${paramIdx}, $${paramIdx + 1}, NOW())`);
      values.push(query, count);
      paramIdx += 2;
    }

    const sql = `
      INSERT INTO search_queries (query, count, last_searched_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (query)
      DO UPDATE SET count = search_queries.count + EXCLUDED.count,
                   last_searched_at = NOW()
    `;

    try {
      await pool.query(sql, values);
      this.totalFlushes++;
      this.totalDbWrites += batchSize;
      this.totalWritesSaved += (totalInBatch - batchSize);

      console.log(`[BatchWriter] Flush #${this.totalFlushes}: ${totalInBatch} submissions aggregated to ${batchSize} unique queries. DB writes saved: ${totalInBatch - batchSize}`);

      for (const [query] of entries) {
        await cacheManager.invalidatePrefixes(query).catch(() => {});
      }
    } catch (err) {
      console.error('[BatchWriter] Flush error:', err.message);
      for (const [query, count] of entries) {
        const current = this.buffer.get(query) || 0;
        this.buffer.set(query, current + count);
      }
    }
  }

  getStats() {
    return {
      bufferSize: this.buffer.size,
      totalSubmissions: this.totalSubmissions,
      totalFlushes: this.totalFlushes,
      totalDbWrites: this.totalDbWrites,
      totalWritesSaved: this.totalWritesSaved,
      writeReduction: this.totalSubmissions > 0
        ? ((this.totalWritesSaved / this.totalSubmissions) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  async stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    console.log('[BatchWriter] Stopped and flushed remaining buffer');
  }
}

module.exports = new BatchWriter();
