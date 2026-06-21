const express = require('express');
const trendingService = require('../services/trendingService');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const trending = await trendingService.getTrending(10);
    res.json({ trending });
  } catch (err) {
    console.error('[Trending] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending searches' });
  }
});

module.exports = router;
