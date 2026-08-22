import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'node:http';
import { buildIntelligence } from '../intelligence';
import { applySourceHealth } from '../sourceHealth';
import type { FeedData, FeedItem, FetchRun } from '../types';
import { itemAllowed, parsePreferences, preferenceScore, searchableText } from '../web/preferences';
import { translateFeedItems } from '../translation';

function item(partial: Partial<FeedItem> & Pick<FeedItem, 'id' | 'source' | 'title'>): FeedItem {
  return {
    url: `https://example.com/${encodeURIComponent(partial.id)}`,
    categoryId: 'ai',
    categoryIds: ['ai'],
    ...partial,
  };
}

test('semantic clustering groups matching titles across sources and builds a daily brief', () => {
  const items = [
    item({ id: 'github:a', source: 'github', title: 'Acme releases local AI coding agent', heatScore: 92 }),
    item({ id: 'hackernews:b', source: 'hackernews', title: 'Acme local AI coding agent released', heatScore: 80 }),
    item({ id: 'arxiv:c', source: 'arxiv', title: 'A benchmark for sparse retrieval systems', heatScore: 70 }),
  ];
  const result = buildIntelligence(items, '2026-08-22T00:00:00.000Z');
  const cluster = result.topics.find((topic) => topic.sources.length === 2);
  assert.ok(cluster);
  assert.deepEqual(new Set(cluster.sources), new Set(['github', 'hackernews']));
  assert.equal(cluster.itemIds.length, 2);
  assert.equal(result.brief.highlights[0].topicId, cluster.id);
  assert.equal(result.items.filter((entry) => entry.topicId === cluster.id).length, 2);
  assert.equal(new Set(result.topics.map((topic) => topic.id)).size, result.topics.length);
});

test('preferences support bilingual search, blocking, category switches and source weights', () => {
  const target = item({
    id: 'github:mcp',
    source: 'github',
    title: 'Model Context Protocol tools',
    titleZh: '模型上下文协议工具',
    tags: ['MCP'],
    heatScore: 50,
  });
  const preferences = parsePreferences(JSON.stringify({
    enabledCategories: ['ai'],
    watchKeywords: ['MCP'],
    blockedKeywords: ['crypto'],
    sourceWeights: { github: 1.5 },
    language: 'zh',
  }));
  assert.match(searchableText(target), /模型上下文/);
  assert.equal(itemAllowed(target, preferences), true);
  assert.equal(preferenceScore(target, preferences), 105);
  assert.equal(itemAllowed({ ...target, title: 'crypto MCP', titleZh: undefined }, preferences), false);
});

test('health fallback keeps fresh category data and only fills a failed category from recent history', async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dailypulse-health-'));
  try {
    process.chdir(tempDir);
    await mkdir(path.join(tempDir, 'data/history'), { recursive: true });
    const previous: FeedData = {
      schemaVersion: 2,
      fetchedAt: '2026-08-21T00:00:00.000Z',
      items: [
        item({ id: 'appstore:fresh', source: 'appstore', title: 'Fresh AI', sourceItemId: 'fresh', categoryId: 'ai', categoryIds: ['ai'] }),
        item({ id: 'appstore:tools-old', source: 'appstore', title: 'Archived Tool', sourceItemId: 'tools-old', categoryId: 'tools', categoryIds: ['tools'] }),
      ],
      runs: [],
    };
    await writeFile(path.join(tempDir, 'data/daily.json'), JSON.stringify(previous));
    await writeFile(path.join(tempDir, 'data/history/index.json'), '[]');
    const current = item({ id: 'appstore:fresh', source: 'appstore', title: 'Fresh AI v2', sourceItemId: 'fresh', categoryId: 'ai', categoryIds: ['ai'] });
    const runs: FetchRun[] = [
      { source: 'appstore', categoryId: 'ai', fetchedAt: '2026-08-22T00:00:00.000Z', status: 'success', count: 5 },
      { source: 'appstore', categoryId: 'tools', fetchedAt: '2026-08-22T00:00:00.000Z', status: 'failed', count: 0, error: 'limited' },
    ];
    const result = await applySourceHealth([current], runs, '2026-08-22T00:00:00.000Z');
    assert.equal(result.currentItems.some((entry) => entry.title === 'Fresh AI v2'), true);
    assert.equal(result.fallbackItems.some((entry) => entry.title === 'Archived Tool' && entry.stale), true);
    const appStore = result.health.find((entry) => entry.source === 'appstore');
    assert.equal(appStore?.categories?.find((entry) => entry.categoryId === 'tools')?.status, 'stale');
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('health fallback expires data older than the source stale limit', async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dailypulse-stale-'));
  try {
    process.chdir(tempDir);
    await mkdir(path.join(tempDir, 'data/history'), { recursive: true });
    const previous: FeedData = {
      schemaVersion: 2,
      fetchedAt: '2026-08-01T00:00:00.000Z',
      items: [item({ id: 'appstore:old', source: 'appstore', title: 'Too old', sourceItemId: 'old' })],
    };
    await writeFile(path.join(tempDir, 'data/daily.json'), JSON.stringify(previous));
    await writeFile(path.join(tempDir, 'data/history/index.json'), '[]');
    const result = await applySourceHealth([], [], '2026-08-22T00:00:00.000Z');
    assert.equal(result.fallbackItems.some((entry) => entry.id === 'appstore:old'), false);
  } finally {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('translation pipeline accepts a LibreTranslate-compatible endpoint and caches bilingual fields', async () => {
  const originalCwd = process.cwd();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dailypulse-translation-'));
  const server = createServer((request, response) => {
    let body = '';
    request.setEncoding('utf-8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body) as { q: string | string[] };
      const values = Array.isArray(payload.q) ? payload.q : [payload.q];
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ translatedText: values.map((value) => `中译：${value}`) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    process.chdir(tempDir);
    process.env.TRANSLATION_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.TRANSLATION_MAX_ITEMS_PER_RUN = '1';
    const translated = await translateFeedItems([
      item({ id: 'github:translate', source: 'github', title: 'Local coding agent', description: 'Runs on your machine.' }),
    ]);
    assert.equal(translated[0].titleZh, '中译：Local coding agent');
    assert.equal(translated[0].descriptionZh, '中译：Runs on your machine.');
  } finally {
    delete process.env.TRANSLATION_API_URL;
    delete process.env.TRANSLATION_MAX_ITEMS_PER_RUN;
    process.chdir(originalCwd);
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});
