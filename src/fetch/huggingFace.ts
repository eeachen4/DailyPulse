import axios from 'axios';
import type { CategoryDef } from '../categories';
import type { FeedItem } from '../types';

const API = 'https://huggingface.co/api/models';

interface HuggingFaceModel {
  id?: string;
  author?: string;
  pipeline_tag?: string;
  likes?: number;
  downloads?: number;
  lastModified?: string;
  tags?: string[];
  cardData?: { license?: string; language?: string[] };
}

function normalize(model: HuggingFaceModel, category: CategoryDef, query: string): FeedItem | null {
  if (!model.id) return null;
  const downloads = model.downloads ?? 0;
  const likes = model.likes ?? 0;
  const rawScore = downloads + likes * 100;
  const task = model.pipeline_tag ? ` · ${model.pipeline_tag}` : '';
  return {
    id: 'huggingface:' + model.id,
    sourceItemId: model.id,
    title: model.id,
    description: `Hugging Face 模型${task}`,
    url: `https://huggingface.co/${model.id}`,
    source: 'huggingface',
    category: category.label,
    categoryId: category.id,
    categoryIds: [category.id],
    score: rawScore,
    metrics: {
      rawScore,
      rawScoreLabel: '下载 + 点赞',
      votes: likes,
    },
    developer: model.author,
    publishedAt: model.lastModified,
    tags: [query, model.pipeline_tag, ...(model.tags ?? []), ...(model.cardData?.language ?? [])].filter((value): value is string => Boolean(value)),
    stats: [
      { label: '下载', value: String(downloads) },
      { label: '点赞', value: String(likes) },
      model.pipeline_tag ? { label: '任务', value: model.pipeline_tag } : undefined,
      model.cardData?.license ? { label: '许可证', value: model.cardData.license } : undefined,
    ].filter((value): value is { label: string; value: string } => Boolean(value)),
  };
}

export async function fetchHuggingFace(category: CategoryDef): Promise<FeedItem[]> {
  const limit = Math.min(100, Math.max(1, Number(process.env.HUGGING_FACE_LIMIT || 25)));
  const models = new Map<string, { model: HuggingFaceModel; query: string }>();
  for (const query of category.huggingFaceQueries) {
    const response = await axios.get<HuggingFaceModel[]>(API, {
      params: { search: query, sort: 'downloads', direction: '-1', limit },
      timeout: 30_000,
      headers: { Accept: 'application/json', 'User-Agent': 'DailyPulse/1.0' },
    });
    for (const model of response.data ?? []) {
      if (model.id && !models.has(model.id)) models.set(model.id, { model, query });
    }
  }

  return [...models.values()]
    .map(({ model, query }) => normalize(model, category, query))
    .filter((item): item is FeedItem => Boolean(item))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}
