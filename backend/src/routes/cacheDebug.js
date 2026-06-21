const express = require('express');
const cacheManager = require('../cache/cacheManager');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const prefix = req.query.prefix || '';

    if (!prefix) {
      return res.status(400).json({ error: 'prefix query parameter is required' });
    }

    const debugInfo = await cacheManager.debugPrefix(prefix.toLowerCase().trim());
    res.json(debugInfo);
  } catch (err) {
    console.error('[CacheDebug] Error:', err.message);
    res.status(500).json({ error: 'Failed to debug cache' });
  }
});

module.exports = router;
