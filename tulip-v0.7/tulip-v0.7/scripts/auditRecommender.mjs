#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SAMPLE_SIZE = 120;
const DEFAULT_LIMIT = 4;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_SEED = 42;

const repoRoot = process.cwd();
const localCatalogPath = path.join(repoRoot, 'src', 'data', 'tulipProducts.json');
const recommenderEnvPath = path.join(repoRoot, 'ml-recommendation-service', '.env');

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];

    if (!raw.startsWith('--')) {
      continue;
    }

    const [key, inlineValue] = raw.split('=', 2);
    const nextValue = inlineValue ?? argv[index + 1];
    const consumesNext = inlineValue === undefined;

    if (key === '--sample' && nextValue) {
      options.sampleSize = toPositiveInt(nextValue, DEFAULT_SAMPLE_SIZE);
      if (consumesNext) index += 1;
    } else if (key === '--limit' && nextValue) {
      options.limit = toPositiveInt(nextValue, DEFAULT_LIMIT);
      if (consumesNext) index += 1;
    } else if (key === '--timeout-ms' && nextValue) {
      options.timeoutMs = toPositiveInt(nextValue, DEFAULT_TIMEOUT_MS);
      if (consumesNext) index += 1;
    } else if (key === '--concurrency' && nextValue) {
      options.concurrency = toPositiveInt(nextValue, DEFAULT_CONCURRENCY);
      if (consumesNext) index += 1;
    } else if (key === '--seed' && nextValue) {
      options.seed = toPositiveInt(nextValue, DEFAULT_SEED);
      if (consumesNext) index += 1;
    } else if (key === '--base-url' && nextValue) {
      options.baseUrl = String(nextValue).trim();
      if (consumesNext) index += 1;
    } else if (key === '--user-id' && nextValue) {
      options.userId = String(nextValue).trim();
      if (consumesNext) index += 1;
    }
  }

  return options;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeProductId(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
  return '';
}

async function loadEnvFile(filePath) {
  try {
    const raw = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
    const output = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex < 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key) continue;

      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      output[key] = value;
    }

    return output;
  } catch {
    return {};
  }
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const { signal, done } = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal,
    });

    const text = await response.text().catch(() => '');
    let json = null;

    if (text.trim()) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
      text,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    done();
  }
}

function mulberry32(seed) {
  let state = seed >>> 0;

  return function random() {
    state += 0x6D2B79F5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(values, seed) {
  const random = mulberry32(seed);
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function safeRate(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;

      if (current >= items.length) {
        break;
      }

      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = await loadEnvFile(recommenderEnvPath);

  const baseUrl = (options.baseUrl
    || process.env.RECOMMENDER_AUDIT_BASE_URL
    || process.env.VITE_RECOMMENDER_DIRECT_URL
    || 'http://127.0.0.1:8010'
  ).replace(/\/+$/, '');

  const apiKey = (
    process.env.RECOMMENDER_API_KEY
    || env.RECOMMENDER_API_KEY
    || ''
  ).trim();

  const userId = (
    options.userId
    || process.env.RECOMMENDER_AUDIT_USER_ID
    || ''
  ).trim();

  const sampleSize = toPositiveInt(options.sampleSize ?? DEFAULT_SAMPLE_SIZE, DEFAULT_SAMPLE_SIZE);
  const limit = toPositiveInt(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);
  const timeoutMs = toPositiveInt(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const concurrency = toPositiveInt(options.concurrency ?? DEFAULT_CONCURRENCY, DEFAULT_CONCURRENCY);
  const seed = toPositiveInt(options.seed ?? DEFAULT_SEED, DEFAULT_SEED);

  if (!apiKey) {
    console.error('✖ Missing RECOMMENDER_API_KEY. Set env var or add it to ml-recommendation-service/.env');
    process.exit(1);
  }

  const catalogRaw = JSON.parse(await fs.readFile(localCatalogPath, 'utf8'));
  if (!Array.isArray(catalogRaw)) {
    console.error('✖ src/data/tulipProducts.json must be an array.');
    process.exit(1);
  }

  const localIds = Array.from(new Set(
    catalogRaw
      .map((item) => (item && typeof item === 'object' ? normalizeProductId(item.id) : ''))
      .filter(Boolean),
  ));

  if (localIds.length === 0) {
    console.error('✖ Local catalog has no product IDs.');
    process.exit(1);
  }

  const sampledIds = seededShuffle(localIds, seed).slice(0, Math.min(sampleSize, localIds.length));

  console.log('=== Tulip Recommender Accuracy Audit ===');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Local catalog IDs: ${localIds.length}`);
  console.log(`Sample size: ${sampledIds.length}`);
  console.log(`Timeout: ${timeoutMs}ms | Concurrency: ${concurrency}`);

  const health = await requestJson(`${baseUrl}/health`, { timeoutMs });
  const healthOk = health.ok && health.status === 200 && health.json?.status === 'ok';
  console.log(`Health: ${healthOk ? 'OK' : `FAIL (status ${health.status || 'ERR'})`}`);

  const trending = await requestJson(`${baseUrl}/recommendations/trending`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-recommender-api-key': apiKey,
    },
    body: JSON.stringify({ limit }),
    timeoutMs,
  });

  const trendingItems = Array.isArray(trending.json?.items) ? trending.json.items.length : 0;
  const trendingOk = trending.ok && trending.status === 200 && trendingItems > 0;
  console.log(`Trending probe: ${trendingOk ? `OK (${trendingItems} items)` : `FAIL (status ${trending.status || 'ERR'})`}`);

  const similarResults = await runWithConcurrency(sampledIds, concurrency, async (productId) => {
    const response = await requestJson(`${baseUrl}/recommendations/similar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-recommender-api-key': apiKey,
      },
      body: JSON.stringify({ product_id: productId, limit }),
      timeoutMs,
    });

    const itemCount = Array.isArray(response.json?.items) ? response.json.items.length : 0;
    return {
      productId,
      status: response.status,
      ok: response.ok,
      itemCount,
      error: response.error,
      detail: response.json?.detail || response.json?.error || '',
    };
  });

  const similarOk = similarResults.filter((result) => result.status === 200);
  const similarOkWithItems = similarOk.filter((result) => result.itemCount > 0);
  const similarNotFound = similarResults.filter((result) => result.status === 404);
  const similarOtherFail = similarResults.filter((result) => result.status !== 200 && result.status !== 404);

  const similarSuccessRate = safeRate(similarOk.length, similarResults.length);
  const similarNonEmptyRate = safeRate(similarOkWithItems.length, similarResults.length);
  const similar404Rate = safeRate(similarNotFound.length, similarResults.length);

  console.log('\n--- Similar Endpoint Sample Metrics ---');
  console.log(`200 success rate: ${formatPercent(similarSuccessRate)} (${similarOk.length}/${similarResults.length})`);
  console.log(`non-empty response rate: ${formatPercent(similarNonEmptyRate)} (${similarOkWithItems.length}/${similarResults.length})`);
  console.log(`404 rate: ${formatPercent(similar404Rate)} (${similarNotFound.length}/${similarResults.length})`);
  console.log(`other failures: ${similarOtherFail.length}`);

  if (similarOtherFail.length > 0) {
    const examples = similarOtherFail.slice(0, 5);
    console.log('Sample failure rows:', examples);
  }

  if (userId) {
    const personalizedChecks = [
      { endpoint: '/recommendations/for-you', body: { user_id: userId, limit }, name: 'for-you' },
      { endpoint: '/recommendations/wishlist-inspired', body: { user_id: userId, limit }, name: 'wishlist-inspired' },
    ];

    console.log('\n--- Personalized Probe (optional) ---');
    for (const check of personalizedChecks) {
      const response = await requestJson(`${baseUrl}${check.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-recommender-api-key': apiKey,
        },
        body: JSON.stringify(check.body),
        timeoutMs,
      });

      const count = Array.isArray(response.json?.items) ? response.json.items.length : 0;
      const status = response.status || 'ERR';
      console.log(`${check.name}: status=${status}, items=${count}`);
    }
  } else {
    console.log('\nPersonalized probe skipped (set RECOMMENDER_AUDIT_USER_ID or pass --user-id).');
  }

  const hasCriticalError = (
    !healthOk
    || !trendingOk
    || similar404Rate > 0.10
    || similarNonEmptyRate < 0.80
  );

  console.log('\n--- Audit Verdict ---');
  if (hasCriticalError) {
    console.log('FAIL: Connectivity or recommendation quality thresholds were not met.');
    process.exit(1);
  }

  console.log('PASS: Recommender is connected and sampled quality thresholds are healthy.');
}

main().catch((error) => {
  console.error('✖ Audit crashed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
