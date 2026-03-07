/* global process */
import { loadEnv } from 'vite';
import { seedCredibleSources } from '../server/pineconeCredibility.js';

function readEnvValue(env, key) {
  return process.env[key] || env[key] || '';
}

async function main() {
  const mode = process.env.NODE_ENV || 'development';
  const env = loadEnv(mode, process.cwd(), '');
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  const result = await seedCredibleSources({
    dryRun,
    force,
    pineconeApiKey: readEnvValue(env, 'PINECONE_API_KEY'),
    pineconeIndexHost: readEnvValue(env, 'PINECONE_INDEX_HOST'),
    pineconeIndexName: readEnvValue(env, 'PINECONE_INDEX_NAME'),
    pineconeNamespace: readEnvValue(env, 'PINECONE_CREDIBLE_SOURCES_NAMESPACE') || 'credible-sources',
    pineconeTextField: readEnvValue(env, 'PINECONE_TEXT_FIELD') || 'text',
    integratedEmbeddingModel: readEnvValue(env, 'PINECONE_INTEGRATED_EMBEDDING_MODEL') || 'multilingual-e5-large',
  });

  console.log('Credible source seeding summary');
  console.log(`Namespace: ${result.namespace}`);
  console.log(`Integrated model: ${result.embeddingModel}`);
  console.log(`Text field: ${result.textField}`);
  console.log(`Metric: ${result.metric}`);
  console.log(`Vector type: ${result.vectorType}`);
  console.log(`Total sources: ${result.totalSources}`);
  console.log(`Unique sources: ${result.uniqueSources}`);
  console.log(`Skipped existing: ${result.skippedExisting}`);
  console.log(`Upserted: ${result.upserted}`);
  console.log(`Failed: ${result.failed}`);

  if (result.errors.length > 0) {
    console.error('Errors:');
    result.errors.forEach((error) => {
      console.error(`- batch ${error.batchStart}: ${error.message}`);
    });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
