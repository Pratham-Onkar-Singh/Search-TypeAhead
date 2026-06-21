# Search Typeahead System

A full-stack search typeahead application with distributed caching (consistent hashing), trending searches with recency-aware ranking, and batch writes for write optimization.

## Architecture

```
┌─────────────┐       ┌──────────────────────────────────────────┐
│  React UI   │──────▶│  Express API Server                      │
│  (port 3000)│◀──────│  (port 5000)                             │
└─────────────┘       │                                          │
                      │  GET  /suggest?q=<prefix>                │
                      │  POST /search                            │
                      │  GET  /trending                          │
                      │  GET  /cache/debug?prefix=<prefix>       │
                      │  GET  /metrics                           │
                      │                                          │
                      │  ┌──────────────────────┐                │
                      │  │  Batch Write Buffer   │                │
                      │  │  (in-memory, flushes  │                │
                      │  │   every 5s or 50 items)│               │
                      │  └──────────┬───────────┘                │
                      └─────────────┼────────────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
          ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
          │ Redis Node 0│   │ Redis Node 1│   │ Redis Node 2│
          │ (db 0)      │   │ (db 1)      │   │ (db 2)      │
          └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
                 │     Consistent Hashing Ring       │
                 └──────────────────┬────────────────┘
                                    │ cache miss
                           ┌────────▼────────┐
                           │   PostgreSQL    │
                           │  search_queries │
                           └─────────────────┘
```

## Tech Stack

- **Frontend:** React
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (with `text_pattern_ops` index for prefix queries)
- **Cache:** Redis (3 logical nodes via separate databases)
- **Hashing:** MD5-based consistent hashing with 150 virtual nodes per physical node

## Prerequisites

- Node.js v18+
- PostgreSQL 14+
- Redis 6+
- (Or just Docker + Docker Compose)

## Setup & Running

### Option A: Docker (Recommended)

```bash
# Start all services (PostgreSQL, Redis, Backend, Frontend)
docker compose up --build

# In another terminal, load the dataset into PostgreSQL
# First, place your AOL dataset files in data/aol-search/
docker compose exec backend node src/scripts/loadDataset.js
```

Open `http://localhost:3000` — everything is running.

To stop:
```bash
docker compose down          # stop containers (keeps data)
docker compose down -v       # stop and delete database volume
```

### Option B: Manual Setup

#### 1. Database Setup

```bash
sudo -u postgres psql -c "CREATE ROLE \"$(whoami)\" WITH LOGIN SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE typeahead OWNER \"$(whoami)\";"
```

#### 2. Start Redis

```bash
sudo systemctl start redis-server
```

#### 3. Backend Setup

```bash
cd backend
npm install
npm run load-data    # Loads AOL dataset into PostgreSQL
npm start            # Starts API server on port 5000
```

#### 4. Frontend Setup

```bash
cd frontend
npm install
npm start            # Starts React dev server on port 3000
```

#### 5. Open the App

Navigate to `http://localhost:3000`

## Dataset

- **Source:** Synthetically generated from common search patterns across categories (tech, food, travel, programming, etc.)
- **Size:** 120,000 unique queries with realistic count distributions
- **Format:** CSV with columns `query,count`
- **Location:** `data/dataset.csv` (auto-generated on first `npm run load-data`)

The count distribution follows a power law: ~1% of queries have 100K+ searches, ~10% have 10K-100K, and the rest have 100-10K, mimicking real-world search query distributions.

## API Documentation

### GET /suggest?q=\<prefix\>

Returns up to 10 prefix-matching suggestions, sorted by a blended score (total count + recency).

**Request:** `GET /suggest?q=iphone`

**Response:**
```json
{
  "suggestions": [
    { "query": "iphone coupon", "count": "605638", "score": 0.6, "recentCount": 0 },
    { "query": "iphone setup", "count": "93923", "score": 0.093, "recentCount": 0 }
  ]
}
```

### POST /search

Submits a search query. Returns a dummy response and records the query for count updates.

**Request:** `POST /search` with body `{ "query": "iphone 15 pro" }`

**Response:**
```json
{ "message": "Searched" }
```

### GET /trending

Returns top 10 trending searches with recency-aware ranking.

**Response:**
```json
{
  "trending": [
    { "query": "review red", "count": "977153", "score": 0.6, "recentCount": 0 }
  ]
}
```

### GET /cache/debug?prefix=\<prefix\>

Shows which cache node is responsible for a prefix and whether it's a hit or miss.

**Response:**
```json
{
  "prefix": "iphone",
  "hashValue": "b3f45b2",
  "assignedNode": "node-1",
  "redisDb": 1,
  "cacheHit": true,
  "totalNodes": ["node-0", "node-1", "node-2"]
}
```

### GET /metrics

Returns performance metrics: latency percentiles, cache hit rate, and batch writer stats.

**Response:**
```json
{
  "totalRequests": 42,
  "suggest": { "count": 20, "p50": "3.21ms", "p95": "12.45ms", "p99": "18.67ms" },
  "cache": { "hits": 15, "misses": 5, "hitRate": "75.00%" },
  "batchWriter": {
    "totalSubmissions": 47,
    "totalFlushes": 3,
    "totalDbWrites": 12,
    "totalWritesSaved": 35,
    "writeReduction": "74.47%"
  }
}
```

## Design Choices & Trade-offs

### Data Storage: PostgreSQL with `text_pattern_ops`

- `text_pattern_ops` operator class on the `query` column enables B-tree index usage for `LIKE 'prefix%'` queries without requiring full-text search
- Trade-off vs. in-memory trie: slower lookup but persistent, ACID-compliant, and handles 120K+ entries without memory pressure

### Distributed Cache: Consistent Hashing

- **Why consistent hashing over modulo:** When adding/removing a cache node, only K/N keys need to be remapped (where K = total keys, N = total nodes), instead of nearly all keys with modulo hashing
- **Virtual nodes (150 per physical node):** Prevents hotspots by distributing each physical node's responsibility across many points on the hash ring
- **TTL-based expiry (60s):** Balances freshness (stale data serves for at most 60s) vs. cache efficiency (high hit rate for repeated prefixes)
- **Simulated with Redis databases:** Each logical node uses a separate Redis DB (0, 1, 2), demonstrating the concept without requiring multiple Redis instances

### Trending Searches: Recency-Aware Ranking

- **Scoring formula:** `score = 0.6 * normalized_total_count + 0.4 * normalized_recent_count`
- **Recent activity tracking:** Redis Sorted Set with timestamps as scores; entries older than the sliding window (1 hour) are pruned
- **Why blended scoring:** Pure count-based ranking ignores temporal patterns; pure recency-based ranking is too volatile. The blend prioritizes historically popular queries while boosting recently active ones
- **Prevents over-ranking:** Short-lived spikes fade as the sliding window moves forward

### Batch Writes

- **Buffer:** In-memory `Map<query, count>` aggregates repeated queries
- **Flush triggers:** Every 5 seconds OR when 50 unique queries accumulate
- **Write reduction:** If "iphone" is searched 10 times before flush, it becomes a single `UPDATE count = count + 10` instead of 10 separate writes
- **Failure trade-off:** If the app crashes before flush, buffered writes are lost. Mitigations (not implemented): write-ahead log to disk, or using Redis as an intermediate buffer

## Performance Report

Measured via `GET /metrics` after simulating realistic traffic (114 suggestion lookups across 19 unique prefixes, 50 search submissions across 5 unique queries).

### Latency

| Metric | Suggestion API | Overall |
|--------|---------------|---------|
| p50 | 1.10ms | 1.10ms |
| p95 | 113.61ms | 112.37ms |
| p99 | 116.20ms | 116.20ms |

- p50 under 2ms indicates most requests are served from Redis cache
- p95/p99 spikes reflect cold-cache misses that hit PostgreSQL — once the cache is warm, all subsequent lookups are sub-2ms

### Cache Hit Rate

| Metric | Value |
|--------|-------|
| Hits | 95 |
| Misses | 19 |
| **Hit Rate** | **83.33%** |

- 19 misses correspond to the 19 unique prefixes on first lookup (cold cache)
- All 95 subsequent lookups for the same prefixes were served from Redis
- In steady-state (warm cache), the hit rate approaches ~100% for repeated prefixes

### Batch Write Reduction

| Metric | Value |
|--------|-------|
| Total Submissions | 50 |
| DB Writes | 5 |
| Writes Saved | 45 |
| **Write Reduction** | **90.00%** |

- 50 search submissions across 5 unique queries were aggregated into just 5 DB writes (one per unique query)
- Each write used a single multi-row `INSERT ... ON CONFLICT DO UPDATE` with the aggregated count
- Demonstrates that repeated searches for the same query are batched — e.g., 15 searches for "google chrome" become a single `count + 15` update

## Configuration

Environment variables (can be set in `backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | Backend server port |
| `DB_HOST` | /var/run/postgresql | PostgreSQL host |
| `DB_NAME` | typeahead | Database name |
| `REDIS_HOST` | 127.0.0.1 | Redis host |
| `CACHE_NODE_COUNT` | 3 | Number of logical cache nodes |
| `CACHE_TTL` | 60 | Cache entry TTL in seconds |
| `VIRTUAL_NODES` | 150 | Virtual nodes per physical node |
| `BATCH_FLUSH_INTERVAL` | 5000 | Batch flush timer in ms |
| `BATCH_MAX_SIZE` | 50 | Max buffer size before flush |
| `TRENDING_WINDOW` | 3600 | Trending recency window in seconds |
| `TRENDING_TOTAL_WEIGHT` | 0.6 | Weight for total count in score |
| `TRENDING_RECENT_WEIGHT` | 0.4 | Weight for recent count in score |
