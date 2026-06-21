import React, { useState, useEffect } from 'react';
import { fetchTrending } from '../api/searchApi';

export default function TrendingSearches({ onTrendingClick, refreshKey }) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchTrending()
      .then((data) => {
        if (!cancelled) {
          setTrending(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load trending searches');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <div className="trending-section"><p>Loading trending...</p></div>;
  if (error) return <div className="trending-section"><p className="error">{error}</p></div>;

  return (
    <div className="trending-section">
      <h3>Trending Searches</h3>
      <div className="trending-list">
        {trending.map((item, idx) => (
          <div
            key={item.query}
            className="trending-item"
            onClick={() => onTrendingClick && onTrendingClick(item.query)}
          >
            <span className="trending-rank">#{idx + 1}</span>
            <span className="trending-query">{item.query}</span>
            <span className="trending-count">
              {Number(item.count).toLocaleString()}
            </span>
            {item.score !== undefined && (
              <span className="trending-score">score: {item.score}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
