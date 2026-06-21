import React from 'react';

export default function SuggestionDropdown({ suggestions, selectedIndex, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <ul className="suggestion-dropdown">
      {suggestions.map((item, idx) => (
        <li
          key={item.query}
          className={`suggestion-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(item)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="suggestion-query">{item.query}</span>
          <span className="suggestion-count">
            {Number(item.count).toLocaleString()} searches
          </span>
          {item.score !== undefined && (
            <span className="suggestion-score">score: {item.score}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
