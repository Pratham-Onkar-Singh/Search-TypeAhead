import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: API_BASE });

export async function fetchSuggestions(prefix) {
  const res = await api.get('/suggest', { params: { q: prefix } });
  return res.data.suggestions;
}

export async function submitSearch(query) {
  const res = await api.post('/search', { query });
  return res.data;
}

export async function fetchTrending() {
  const res = await api.get('/trending');
  return res.data.trending;
}

export async function fetchCacheDebug(prefix) {
  const res = await api.get('/cache/debug', { params: { prefix } });
  return res.data;
}

export async function fetchMetrics() {
  const res = await api.get('/metrics');
  return res.data;
}
