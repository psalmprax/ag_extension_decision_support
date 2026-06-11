/* Patched re-embed: dotenv stripped, initializeDatabase() called, DATABASE_HOST fixed.
 * Run from inside ag-dashboard-backend:  node /tmp/reembed.js
 */
process.chdir('/app');

// Container has conflicting DATABASE_HOST=127.0.0.1 / DATABASE_PORT=7501 that the
// config module reads BEFORE DATABASE_URL. Force them to the actual app-db.
process.env.DATABASE_HOST = 'app-db';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@app-db:5432/ag_extension?schema=public';

const { VectorService } = require('/app/dist/services/vectorService');
const dbModule = require('/app/dist/services/databaseService');
const { query } = dbModule;
const initFn = dbModule.initializeDatabase || dbModule.init || dbModule.connect || dbModule.initialize;

async function main() {
  if (initFn) {
    console.log('[reembed] calling initializeDatabase()...');
    await initFn();
    console.log('[reembed] database initialized');
  } else {
    console.log('[reembed] no init fn found on databaseService, exports:', Object.keys(dbModule));
  }

  console.log('[reembed] AI_EMBEDDINGS_PROVIDER=' + process.env.AI_EMBEDDINGS_PROVIDER);
  console.log('[reembed] AI_EMBEDDINGS_MODEL=' + process.env.AI_EMBEDDINGS_MODEL);
  console.log('[reembed] OLLAMA_HOST=' + process.env.OLLAMA_HOST);

  const before = await query('SELECT COUNT(*)::int AS n FROM knowledge_articles WHERE embedding IS NOT NULL');
  console.log('[reembed] before: ' + before.rows[0].n + '/15 articles have embeddings');

  const articles = await query(`
    SELECT id, title, content, category, tags, crops, regions, source, source_url, content_type
    FROM knowledge_articles
    ORDER BY title
  `);
  console.log('[reembed] found ' + articles.rows.length + ' articles to process');

  let ok = 0, failed = 0;
  for (const a of articles.rows) {
    const crops = a.crops || [];
    const regions = a.regions || [];
    const tags = a.tags || [];
    try {
      await VectorService.upsertDocument(
        a.id,
        a.content,
        {
          title: a.title,
          category: a.category,
          tags,
          crops,
          regions,
          source: a.source || 'AG Extension Tropical Agronomy Seed',
          sourceUrl: a.source_url || null,
          contentType: a.content_type || 'text'
        }
      );
      ok++;
      console.log('[reembed] [' + ok + '/' + articles.rows.length + '] OK: ' + a.title);
    } catch (err) {
      failed++;
      console.error('[reembed] [' + (ok + failed) + '/' + articles.rows.length + '] FAIL: ' + a.title + ' -> ' + (err && err.message));
    }
  }

  const after = await query('SELECT COUNT(*)::int AS n FROM knowledge_articles WHERE embedding IS NOT NULL');
  process.stdout.write(JSON.stringify({
    ok: true,
    processed: articles.rows.length,
    succeeded: ok,
    failed,
    embeddingsBefore: before.rows[0].n,
    embeddingsAfter: after.rows[0].n
  }) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[reembed] fatal:', err && err.stack || err);
  process.exit(2);
});
