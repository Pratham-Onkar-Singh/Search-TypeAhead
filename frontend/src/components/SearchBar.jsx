import React, { useState, useEffect, useRef } from 'react';
import useDebounce from '../hooks/useDebounce';
import { fetchSuggestions, submitSearch } from '../api/searchApi';
import SuggestionDropdown from './SuggestionDropdown';

export default function SearchBar({ onSearchResult, onSearchSubmit, prefill, onPrefillConsumed }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (prefill) {
      setQuery(prefill);
      onPrefillConsumed && onPrefillConsumed();
      inputRef.current && inputRef.current.focus();
    }
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchSuggestions(debouncedQuery)
      .then((data) => {
        if (!cancelled) {
          setSuggestions(data);
          setShowDropdown(data.length > 0);
          setSelectedIndex(-1);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(searchQuery) {
    const q = (searchQuery || query).trim();
    if (!q) return;

    setShowDropdown(false);
    try {
      const result = await submitSearch(q);
      onSearchResult && onSearchResult(result, q);
      onSearchSubmit && onSearchSubmit();
    } catch {
      onSearchResult && onSearchResult({ error: 'Failed to submit search' }, q);
    }
  }

  function handleKeyDown(e) {
    if (!showDropdown) {
      if (e.key === 'Enter') handleSubmit();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          const selected = suggestions[selectedIndex].query;
          setQuery(selected);
          handleSubmit(selected);
        } else {
          handleSubmit();
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
      default:
        break;
    }
  }

  function handleSuggestionClick(suggestion) {
    setQuery(suggestion.query);
    handleSubmit(suggestion.query);
  }

  return (
    <div className="search-container" ref={containerRef}>
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          autoComplete="off"
        />
        <button className="search-button" onClick={() => handleSubmit()}>
          Search
        </button>
        {loading && <span className="search-loading">Loading...</span>}
      </div>

      {showDropdown && (
        <SuggestionDropdown
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={handleSuggestionClick}
        />
      )}
    </div>
  );
}
