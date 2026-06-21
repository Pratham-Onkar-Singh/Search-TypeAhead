const express = require('express');
const cors = require('cors');
const config = require('./config');
const cacheManager = require('./cache/cacheManager');
const batchWriter = require('./services/batchWriter');
const { metricsMiddleware, getMetrics } = require('./middleware/metrics');

const suggestRouter = require('./routes/suggest');
const searchRouter = require('./routes/search');
const trendingRouter = require('./routes/trending');
const cacheDebugRouter = require('./routes/cacheDebug');

const app = express();

app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

app.use('/suggest', suggestRouter);
app.use('/search', searchRouter);
app.use('/trending', trendingRouter);
app.use('/cache/debug', cacheDebugRouter);

app.get('/metrics', (req, res) => {
  res.json(getMetrics());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await cacheManager.initialize();
    batchWriter.start();

    app.listen(config.server.port, () => {
      console.log(`[Server] Running on http://localhost:${config.server.port}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await batchWriter.stop();
  await cacheManager.close();
  const trendingService = require('./services/trendingService');
  await trendingService.close();
  process.exit(0);
});

start();
