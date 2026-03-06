import type { Entity, Pack } from "./types";

const normalizeName = (value: string): string =>
  value
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

export const loadPackEntities = async (packId: string): Promise<Entity[]> => {
  const response = await fetch(`./data/pack-entities/${packId}.entities.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load pack entities for ${packId}`);
  }

  const entities = (await response.json()) as Entity[];
  if (packId === "usa_states") {
    return withUsStatePolygons(entities);
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
