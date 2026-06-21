const cacheManager = require('../cache/cacheManager');
const batchWriter = require('../services/batchWriter');

const latencies = [];
const MAX_LATENCY_RECORDS = 10000;

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;

    latencies.push({ path: req.originalUrl.split('?')[0], method: req.method, durationMs, timestamp: Date.now() });
    if (latencies.length > MAX_LATENCY_RECORDS) {
      latencies.splice(0, latencies.length - MAX_LATENCY_RECORDS);
    }
  });

  next();
}

function computePercentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function getMetrics() {
  const suggestLatencies = latencies
    .filter((l) => l.path === '/suggest')
    .map((l) => l.durationMs);

  const allLatencies = latencies.map((l) => l.durationMs);

  return {
    totalRequests: latencies.length,
    suggest: {
      count: suggestLatencies.length,
      p50: computePercentile(suggestLatencies, 50).toFixed(2) + 'ms',
      p95: computePercentile(suggestLatencies, 95).toFixed(2) + 'ms',
      p99: computePercentile(suggestLatencies, 99).toFixed(2) + 'ms',
    },
    overall: {
      p50: computePercentile(allLatencies, 50).toFixed(2) + 'ms',
      p95: computePercentile(allLatencies, 95).toFixed(2) + 'ms',
      p99: computePercentile(allLatencies, 99).toFixed(2) + 'ms',
    },
    cache: cacheManager.getStats(),
    batchWriter: batchWriter.getStats(),
  };
}

module.exports = { metricsMiddleware, getMetrics };
