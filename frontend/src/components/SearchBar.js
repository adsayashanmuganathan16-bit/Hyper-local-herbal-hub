import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX } from 'react-icons/fi';

export default function SearchBar({ compact }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="searchbar-compact">
        <FiSearch size={16} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search herbs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`searchbar ${focused ? 'focused' : ''}`}>
      <FiSearch size={20} className="searchbar-icon" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search for herbal medicines, supplements, oils..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        className="searchbar-input"
      />
      {query && (
        <button type="button" className="searchbar-clear" onClick={handleClear}>
          <FiX size={16} />
        </button>
      )}
      <button type="submit" className="searchbar-btn">Search</button>
    </form>
  );
}