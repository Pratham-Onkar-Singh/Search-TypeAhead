import React, { useState } from 'react';
import { fetchCacheDebug } from '../api/searchApi';

export default function CacheDebug() {
  const [prefix, setPrefix] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLookup() {
    const q = prefix.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const data = await fetchCacheDebug(q);
      setDebugInfo(data);
    } catch {
      setError('Failed to fetch cache debug info');
      setDebugInfo(null);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLookup();
  }

  return (
    <div className="cache-debug-section">
      <h3>Cache Debug</h3>
      <p className="cache-debug-subtitle">See which Redis node handles a prefix</p>

      <div className="cache-debug-input-wrapper">
        <input
          type="text"
          className="cache-debug-input"
          placeholder="Enter a prefix (e.g. iph)"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="cache-debug-button" onClick={handleLookup} disabled={loading}>
          {loading ? 'Looking up...' : 'Lookup'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {debugInfo && (
        <div className="cache-debug-result">
          <div className="cache-debug-grid">
            <div className="cache-debug-item">
              <span className="cache-debug-label">Prefix</span>
              <span className="cache-debug-value">{debugInfo.prefix}</span>
            </div>
            <div className="cache-debug-item">
              <span className="cache-debug-label">Hash Value</span>
              <span className="cache-debug-value mono">{debugInfo.hashValue}</span>
            </div>
            <div className="cache-debug-item">
              <span className="cache-debug-label">Assigned Node</span>
              <span className="cache-debug-value">{debugInfo.assignedNode}</span>
            </div>
            <div className="cache-debug-item">
              <span className="cache-debug-label">Redis DB</span>
              <span className="cache-debug-value">{debugInfo.redisDb}</span>
            </div>
            <div className="cache-debug-item">
              <span className="cache-debug-label">Cache Status</span>
              <span className={`cache-debug-value cache-${debugInfo.cacheHit ? 'hit' : 'miss'}`}>
                {debugInfo.cacheHit ? 'HIT' : 'MISS'}
              </span>
            </div>
            <div className="cache-debug-item">
              <span className="cache-debug-label">Total Nodes</span>
              <span className="cache-debug-value">{debugInfo.totalNodes?.join(', ')}</span>
            </div>
          </div>

          <div className="cache-debug-ring">
            <span className="cache-debug-label">Hash Ring Routing</span>
            <div className="cache-debug-nodes">
              {debugInfo.totalNodes?.map((node) => (
                <span
                  key={node}
                  className={`cache-node-badge ${node === debugInfo.assignedNode ? 'active' : ''}`}
                >
                  {node}
                  {node === debugInfo.assignedNode && ' (assigned)'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
