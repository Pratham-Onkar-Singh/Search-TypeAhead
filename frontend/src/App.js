import React, { useState, useCallback, useRef } from 'react';
import SearchBar from './components/SearchBar';
import SearchResult from './components/SearchResult';
import TrendingSearches from './components/TrendingSearches';
import CacheDebug from './components/CacheDebug';
import './App.css';

function App() {
  const [searchResult, setSearchResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingRefreshKey, setTrendingRefreshKey] = useState(0);
  const [prefill, setPrefill] = useState('');
  const refreshTimerRef = useRef(null);

  const handleSearchResult = useCallback((result, query) => {
    setSearchResult(result);
    setSearchQuery(query);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      setTrendingRefreshKey((k) => k + 1);
      refreshTimerRef.current = null;
    }, 6000);
  }, []);

  const handleTrendingClick = useCallback((q) => {
    setPrefill(q);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Search Typeahead</h1>
        <p className="app-subtitle">Start typing to see suggestions</p>
      </header>

      <main className="app-main">
        <SearchBar
          onSearchResult={handleSearchResult}
          onSearchSubmit={handleSearchSubmit}
          prefill={prefill}
          onPrefillConsumed={() => setPrefill('')}
        />

        <SearchResult result={searchResult} query={searchQuery} />

        <TrendingSearches
          refreshKey={trendingRefreshKey}
          onTrendingClick={handleTrendingClick}
        />

        <CacheDebug />
      </main>
    </div>
  );
}

export default App;
