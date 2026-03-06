import type { Entity } from "./types";

type EntityEnrichment = Partial<
  Pick<Entity, "facts" | "didYouKnow" | "learningObjective" | "factCards" | "media">
>;

type WikiSummary = {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
};

const memoryCache = new Map<string, EntityEnrichment>();
const ENRICH_CACHE_PREFIX = "geo-enrich-v1:";

const sentenceSplit = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const toTitleCandidates = (entity: Entity): string[] => {
  const list = new Set<string>();
  list.add(entity.name);
  if (entity.name.includes("(")) {
    list.add(entity.name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim());
  }
  if (entity.type === "capital" && entity.adminOf) {
    list.add(`${entity.name}, ${entity.adminOf.name}`);
    list.add(`${entity.name} city`);
  }
  if (entity.type === "mountain") {
    list.add(`${entity.name} mountain`);
    list.add(`${entity.name} range`);
  }
  if (entity.type === "river") {
    list.add(`${entity.name} river`);
  }
  for (const alias of entity.aliases ?? []) {
    list.add(alias);
  }
  return [...list].filter(Boolean);
};

const fromStorage = (entityId: string): EntityEnrichment | null => {
  try {
    const raw = localStorage.getItem(`${ENRICH_CACHE_PREFIX}${entityId}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as EntityEnrichment;
  } catch {
    return null;
  }
};

const toStorage = (entityId: string, payload: EntityEnrichment): void => {
  try {
    localStorage.setItem(`${ENRICH_CACHE_PREFIX}${entityId}`, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
};

const fetchSummary = async (title: string): Promise<WikiSummary | null> => {
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!response.ok) {
    return null;
  }
  const summary = (await response.json()) as WikiSummary;
  if (summary.type === "disambiguation") {
    return null;
  }
  return summary;
};

const buildEnrichment = (entity: Entity, summary: WikiSummary): EntityEnrichment => {
  const extract = (summary.extract ?? "").trim();
  const sentences = sentenceSplit(extract);
  const factSentences = sentences.slice(0, 2);
  const description = (summary.description ?? "").trim();
  const pageUrl = summary.content_urls?.desktop?.page;
  const imageUrl = summary.originalimage?.source ?? summary.thumbnail?.source;

  const factCards = [...(entity.factCards ?? [])];
  if (description) {
    factCards.push({ title: "Wikipedia", value: description, icon: "globe" });
  }

  const enrichment: EntityEnrichment = {
    facts: factSentences.length > 0 ? factSentences : undefined,
    didYouKnow: sentences[2] ?? undefined,
    learningObjective:
      entity.learningObjective ??
      `Locate ${entity.name} on the map and connect it to nearby ${entity.type === "river" ? "regions" : "places"}.`,
    factCards: factCards.length > 0 ? factCards.slice(0, 5) : undefined
  };

  if (imageUrl) {
    enrichment.media = {
      imageUrl,
      sourceUrl: pageUrl,
      alt: `${entity.name} image`,
      credit: "Wikipedia"
    };
  }
  return enrichment;
};

export const enrichEntity = async (entity: Entity): Promise<EntityEnrichment> => {
  if (memoryCache.has(entity.id)) {
    return memoryCache.get(entity.id) ?? {};
  }

  const cached = fromStorage(entity.id);
  if (cached) {
    memoryCache.set(entity.id, cached);
    return cached;
  }

  const candidates = toTitleCandidates(entity);
  for (const candidate of candidates) {
    try {
      const summary = await fetchSummary(candidate);
      if (!summary) {
        continue;
      }
      const enrichment = buildEnrichment(entity, summary);
      memoryCache.set(entity.id, enrichment);
      toStorage(entity.id, enrichment);
      return enrichment;
    } catch {
      // try next candidate
    }
  }

  const fallback: EntityEnrichment = {};
  memoryCache.set(entity.id, fallback);
  toStorage(entity.id, fallback);
  return fallback;
};

