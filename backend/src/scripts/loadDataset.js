const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.db);

async function createTable() {
  await pool.query('DROP TABLE IF EXISTS search_queries');
  await pool.query(`
    CREATE TABLE search_queries (
      query TEXT PRIMARY KEY,
      count BIGINT NOT NULL DEFAULT 0,
      last_searched_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX idx_query_prefix
    ON search_queries (query text_pattern_ops)
  `);
  console.log('[Loader] Table and index created (fresh)');
}

// ──────────────────────────────────────────────
// AOL Format Parser
// Columns: AnonID \t Query \t QueryTime \t ItemRank \t ClickURL
// We aggregate by Query → count of occurrences
// ──────────────────────────────────────────────
async function parseAOLFiles(dirPath) {
  console.log(`[Loader] Parsing AOL files from: ${dirPath}`);
  const counts = new Map();
  let totalLines = 0;

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.txt'));
  if (files.length === 0) {
    throw new Error(`No .txt files found in ${dirPath}. Make sure you extracted the AOL dataset there.`);
  }

  console.log(`[Loader] Found ${files.length} AOL data files: ${files.join(', ')}`);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    let isFirstLine = true;
    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        if (line.toLowerCase().includes('anonid') || line.toLowerCase().includes('query')) {
          continue;
        }
      }

      const parts = line.split('\t');
      if (parts.length < 2) continue;

      const query = parts[1].trim().toLowerCase();
      if (!query || query === '-') continue;

      counts.set(query, (counts.get(query) || 0) + 1);
      totalLines++;

      if (totalLines % 1000000 === 0) {
        console.log(`[Loader] Parsed ${(totalLines / 1000000).toFixed(0)}M lines, ${counts.size} unique queries so far...`);
      }
    }

    console.log(`[Loader] Finished parsing ${file}`);
  }

  console.log(`[Loader] AOL parsing complete: ${totalLines} total lines → ${counts.size} unique queries`);
  return counts;
}

// ──────────────────────────────────────────────
// CSV Format Parser (query,count)
// ──────────────────────────────────────────────
function parseCSV(filePath) {
  console.log(`[Loader] Parsing CSV: ${filePath}`);
  const counts = new Map();
  const data = fs.readFileSync(filePath, 'utf-8');
  const lines = data.split('\n').filter((l) => l.trim());

  const header = lines[0].toLowerCase();
  const startIdx = header.includes('query') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 2) continue;

    const query = parts.slice(0, -1).join(',').trim().toLowerCase();
    const count = parseInt(parts[parts.length - 1].trim());

    if (!query || isNaN(count)) continue;
    counts.set(query, (counts.get(query) || 0) + count);
  }

  console.log(`[Loader] CSV parsing complete: ${counts.size} unique queries`);
  return counts;
}

// ──────────────────────────────────────────────
// Batch insert aggregated counts into PostgreSQL
// ──────────────────────────────────────────────
async function loadCounts(counts) {
  const entries = Array.from(counts.entries());
  const BATCH_SIZE = 1000;
  let loaded = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];
    let paramIdx = 1;

    for (const [query, count] of batch) {
      if (query.length > 200) continue;
      placeholders.push(`($${paramIdx}, $${paramIdx + 1}, NOW())`);
      values.push(query, count);
      paramIdx += 2;
    }

    if (placeholders.length === 0) continue;

    await pool.query(
      `INSERT INTO search_queries (query, count, last_searched_at)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (query)
       DO UPDATE SET count = search_queries.count + EXCLUDED.count`,
      values
    );

    loaded += placeholders.length;
    if (loaded % 50000 === 0 || i + BATCH_SIZE >= entries.length) {
      console.log(`[Loader] Loaded ${loaded.toLocaleString()} / ${entries.length.toLocaleString()} rows...`);
    }
  }

  return loaded;
}


async function main() {
  const dataDir = path.join(__dirname, '..', '..', '..', 'data');

  try {
    await createTable();

    let counts;

    // Priority 1: Look for AOL directory with .txt files
    const aolDir = path.join(dataDir, 'aol-search');
    const aolAltDir = path.join(dataDir, 'AOL-user-ct-collection');

    if (fs.existsSync(aolDir) && fs.readdirSync(aolDir).some((f) => f.endsWith('.txt'))) {
      counts = await parseAOLFiles(aolDir);
    } else if (fs.existsSync(aolAltDir) && fs.readdirSync(aolAltDir).some((f) => f.endsWith('.txt'))) {
      counts = await parseAOLFiles(aolAltDir);
    } else {
      // Priority 2: Look for any .txt file directly in data/
      const txtFiles = fs.existsSync(dataDir)
        ? fs.readdirSync(dataDir).filter((f) => f.endsWith('.txt'))
        : [];

      if (txtFiles.length > 0) {
        counts = await parseAOLFiles(dataDir);
      } else {
        // Priority 3: Look for CSV
        const csvPath = path.join(dataDir, 'dataset.csv');
        if (fs.existsSync(csvPath)) {
          counts = parseCSV(csvPath);
        } else {
          console.error('\n[Loader] ERROR: No dataset found!\n');
          console.error('Please do ONE of the following:\n');
          console.error('  Option A — AOL Search Logs (recommended):');
          console.error('    1. Download from Kaggle: search "AOL search query logs"');
          console.error('    2. Extract .txt files into: data/aol-search/');
          console.error('    3. Run: npm run load-data\n');
          console.error('  Option B — Any CSV with query,count columns:');
          console.error('    1. Place your file at: data/dataset.csv');
          console.error('    2. Format: query,count (one per line)');
          console.error('    3. Run: npm run load-data\n');
          process.exit(1);
        }
      }
    }

    // Filter: skip very short or empty queries
    for (const [query] of counts) {
      if (query.length < 2) counts.delete(query);
    }

    console.log(`[Loader] ${counts.size.toLocaleString()} unique queries after filtering`);

    // Load into PostgreSQL
    const loaded = await loadCounts(counts);
    console.log(`\n[Loader] Done! Total rows loaded: ${loaded.toLocaleString()}`);

    const result = await pool.query('SELECT COUNT(*) as total FROM search_queries');
    console.log(`[Loader] Total rows in database: ${result.rows[0].total}`);

    const top10 = await pool.query('SELECT query, count FROM search_queries ORDER BY count DESC LIMIT 10');
    console.log('\n[Loader] Top 10 queries:');
    top10.rows.forEach((r, i) => console.log(`  ${i + 1}. "${r.query}" — ${Number(r.count).toLocaleString()} searches`));

  } catch (err) {
    console.error('[Loader] Error:', err);
  } finally {
    await pool.end();
  }
}

main();
