const express = require('express');
const { getSuggestions } = require('../services/suggestionService');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const prefix = req.query.q || '';
    const suggestions = await getSuggestions(prefix);
    res.json({ suggestions });
  } catch (err) {
    console.error('[Suggest] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

module.exports = router;
