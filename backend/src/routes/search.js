const express = require('express');
const batchWriter = require('../services/batchWriter');
const trendingService = require('../services/trendingService');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const normalized = query.toLowerCase().trim();

    await batchWriter.add(normalized);
    await trendingService.recordRecentSearch(normalized);

    res.json({ message: 'Searched' });
  } catch (err) {
    console.error('[Search] Error:', err.message);
    res.status(500).json({ error: 'Failed to process search' });
  }
});

module.exports = router;
