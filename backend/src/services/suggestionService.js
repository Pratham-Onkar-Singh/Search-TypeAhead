const pool = require('../db');
const cacheManager = require('../cache/cacheManager');
const trendingService = require('./trendingService');
const config = require('../config');

async function getSuggestions(prefix, useRecency = true) {
  if (!prefix || prefix.trim().length === 0) {
    return [];
  }

  prefix = prefix.toLowerCase().trim();

  const cached = await cacheManager.get(prefix);
  if (cached.hit) {
    return cached.data;
  }

  const result = await pool.query(
    `SELECT query, count FROM search_queries
     WHERE LOWER(query) LIKE $1
     ORDER BY count DESC
     LIMIT 20`,
    [prefix + '%']
  );

  let suggestions = result.rows;

  if (useRecency && suggestions.length > 0) {
    suggestions = await trendingService.rankWithRecency(suggestions);
    suggestions = suggestions.slice(0, 10);
  } else {
    suggestions = suggestions.slice(0, 10);
  }

  await cacheManager.set(prefix, suggestions);

  return suggestions;
}

module.exports = { getSuggestions };
