import React from 'react';

export default function SearchResult({ result, query }) {
  if (!result) return null;

  return (
    <div className="search-result">
      {result.error ? (
        <p className="error">{result.error}</p>
      ) : (
        <div className="result-success">
          <p>
            <strong>Query:</strong> {query}
          </p>
          <p>
            <strong>Response:</strong> {result.message}
          </p>
        </div>
      )}
    </div>
  );
}
