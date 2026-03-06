import type { Entity, Pack } from "./types";

const normalizeName = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const wrapLongitude = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

const normalizeGeometry = (geometry: Entity["geometry"]): Entity["geometry"] => {
  if (!geometry || !("coordinates" in geometry)) {
    return geometry;
  }

  const normalizeCoords = (node: unknown): unknown => {
    if (!Array.isArray(node)) {
      return node;
    }
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      return [wrapLongitude(node[0]), node[1]];
    }
    return node.map((child) => normalizeCoords(child));
  };

  return {
    ...geometry,
    coordinates: normalizeCoords(geometry.coordinates) as Entity["geometry"] extends { coordinates: infer C } ? C : never
  } as Entity["geometry"];
};

const withUsStatePolygons = async (entities: Entity[]): Promise<Entity[]> => {
  const hasPolygon = entities.some((entity) => entity.geometryType === "polygon" && entity.geometry);
  if (hasPolygon) {
    return entities;
  }

  const response = await fetch("./data/source/us-states.geojson", { cache: "no-store" });
  if (!response.ok) {
    return entities;
  }

  const geo = (await response.json()) as {
    features?: Array<{ properties?: { name?: string }; geometry?: Entity["geometry"] }>;
  };
  const byName = new Map<string, Entity["geometry"]>();
  for (const feature of geo.features ?? []) {
    const name = feature?.properties?.name;
    const geometry = feature?.geometry;
    if (!name || !geometry) {
      continue;
    }
    byName.set(normalizeName(name), geometry);
  }

  return entities.map((entity) => {
    if (entity.type !== "state" || entity.geometryType !== "point") {
      return entity;
    }
    const geometry = byName.get(normalizeName(entity.name));
    if (!geometry) {
      return entity;
    }
    return {
      ...entity,
      geometryType: "polygon",
      geometry: normalizeGeometry(geometry)
    };
  });
};

const INDIA_NAME_ALIASES = new Map<string, string>([
  ["odisha", "orissa"],
  ["orissa", "odisha"],
  ["uttarakhand", "uttaranchal"],
  ["uttaranchal", "uttarakhand"]
]);

const withIndiaStatePolygons = async (entities: Entity[]): Promise<Entity[]> => {
  const hasPolygon = entities.some((entity) => entity.geometryType === "polygon" && entity.geometry);
  if (hasPolygon) {
    return entities;
  }

  const response = await fetch("./data/source/india-states.geojson", { cache: "no-store" });
  if (!response.ok) {
    return entities;
  }

  const geo = (await response.json()) as {
    features?: Array<{ properties?: Record<string, unknown>; geometry?: Entity["geometry"] }>;
  };
  const byName = new Map<string, Entity["geometry"]>();
  for (const feature of geo.features ?? []) {
    const properties = feature?.properties ?? {};
    const name = String(
      properties.shapeName ?? properties.NAME_1 ?? properties.name ?? properties.st_nm ?? ""
    ).trim();
    const geometry = feature?.geometry;
    if (!name || !geometry) {
      continue;
    }
    byName.set(normalizeName(name), geometry);
  }

  return entities.map((entity) => {
    if (entity.type !== "state" || entity.geometryType !== "point") {
      return entity;
    }
    const normalized = normalizeName(entity.name);
    const geometry = byName.get(normalized) ?? byName.get(INDIA_NAME_ALIASES.get(normalized) ?? "");
    if (!geometry) {
      return entity;
    }
    return {
      ...entity,
      geometryType: "polygon",
      geometry: normalizeGeometry(geometry)
    };
  });
};

const withCanadaProvincePolygons = async (entities: Entity[]): Promise<Entity[]> => {
  const hasPolygon = entities.some((entity) => entity.geometryType === "polygon" && entity.geometry);
  if (hasPolygon) {
    return entities;
  }

  const response = await fetch("./data/source/canada-provinces.geojson", { cache: "no-store" });
  if (!response.ok) {
    return entities;
  }

  const geo = (await response.json()) as {
    features?: Array<{ properties?: Record<string, unknown>; geometry?: Entity["geometry"] }>;
  };
  const byName = new Map<string, Entity["geometry"]>();
  for (const feature of geo.features ?? []) {
    const properties = feature?.properties ?? {};
    const name = String(
      properties.shapeName ?? properties.NAME_1 ?? properties.name ?? properties.st_nm ?? ""
    ).trim();
    const geometry = feature?.geometry;
    if (!name || !geometry) {
      continue;
    }
    byName.set(normalizeName(name), geometry);
  }

  return entities.map((entity) => {
    if (entity.type !== "state" || entity.geometryType !== "point") {
      return entity;
    }
    const geometry = byName.get(normalizeName(entity.name));
    if (!geometry) {
      return entity;
    }
    return {
      ...entity,
      geometryType: "polygon",
      geometry: normalizeGeometry(geometry)
    };
  });
};

export const loadPackEntities = async (packId: string): Promise<Entity[]> => {
  const response = await fetch(`./data/pack-entities/${packId}.entities.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load pack entities for ${packId}`);
  }

  const entities = (await response.json()) as Entity[];
  if (packId === "usa_states") {
    return withUsStatePolygons(entities);
  }
  if (packId === "india_states_capitals") {
    return withIndiaStatePolygons(entities);
  }
  if (packId === "canada_provinces_territories") {
    return withCanadaProvincePolygons(entities);
  }
  return entities;
};

export const loadPacks = async (): Promise<Pack[]> => {
  const response = await fetch("./data/packs.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load packs.json");
  }

  return (await response.json()) as Pack[];
};
