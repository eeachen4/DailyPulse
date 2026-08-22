import { CATEGORIES } from '../categories';
import { categoryIdsFor } from '../dataModel';
import { SOURCES, type FeedItem, type Source } from '../types';

export type ContentLanguage = 'auto' | 'zh' | 'original';

export interface UserPreferences {
  enabledCategories: string[];
  watchKeywords: string[];
  blockedKeywords: string[];
  sourceWeights: Record<Source, number>;
  language: ContentLanguage;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  enabledCategories: CATEGORIES.map((category) => category.id),
  watchKeywords: [],
  blockedKeywords: [],
  sourceWeights: Object.fromEntries(SOURCES.map((source) => [source, 1])) as Record<Source, number>,
  language: 'auto',
};

export function normalizeKeywords(value: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value.split(/[,，\n]/);
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))].slice(0, 50);
}

function normalizeWeight(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(2, parsed)) : 1;
}

export function parsePreferences(raw: string | null): UserPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      enabledCategories: Array.isArray(value.enabledCategories)
        ? value.enabledCategories.filter((id) => CATEGORIES.some((category) => category.id === id))
        : DEFAULT_PREFERENCES.enabledCategories,
      watchKeywords: normalizeKeywords(value.watchKeywords ?? []),
      blockedKeywords: normalizeKeywords(value.blockedKeywords ?? []),
      sourceWeights: Object.fromEntries(SOURCES.map((source) => [
        source,
        normalizeWeight(value.sourceWeights?.[source]),
      ])) as Record<Source, number>,
      language: value.language === 'zh' || value.language === 'original' ? value.language : 'auto',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function searchableText(item: FeedItem): string {
  return [
    item.title,
    item.titleZh,
    item.description,
    item.descriptionZh,
    item.developer,
    ...(item.tags ?? []),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

export function itemAllowed(item: FeedItem, preferences: UserPreferences): boolean {
  if (!categoryIdsFor(item).some((categoryId) => preferences.enabledCategories.includes(categoryId))) return false;
  if ((preferences.sourceWeights[item.source] ?? 1) <= 0) return false;
  const text = searchableText(item);
  return !preferences.blockedKeywords.some((keyword) => text.includes(keyword.toLocaleLowerCase()));
}

export function preferenceScore(item: FeedItem, preferences: UserPreferences): number {
  const text = searchableText(item);
  const keywordBoost = preferences.watchKeywords.some((keyword) => text.includes(keyword.toLocaleLowerCase())) ? 20 : 0;
  return ((item.heatScore ?? 0) + keywordBoost) * (preferences.sourceWeights[item.source] ?? 1);
}

export function displayTitle(item: FeedItem, language: ContentLanguage): string {
  if (language === 'original') return item.title;
  return item.titleZh ?? item.title;
}

export function displayDescription(item: FeedItem, language: ContentLanguage): string | undefined {
  if (language === 'original') return item.description;
  return item.descriptionZh ?? item.description;
}
