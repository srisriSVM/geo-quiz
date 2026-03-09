import type { Entity, Pack, PackEntityMeta } from "./types";

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

const COUNTRY_NAME_ALIASES = new Map<string, string>([
  ["united states", "united states of america"],
  ["russia", "russian federation"],
  ["czech republic", "czechia"],
  ["swaziland", "eswatini"],
  ["north macedonia", "macedonia"],
  ["myanmar", "burma"],
  ["cape verde", "cabo verde"],
  ["ivory coast", "cote d ivoire"],
  ["east timor", "timor leste"],
  ["vatican city", "vatican"],
  ["laos", "lao pdr"],
  ["syria", "syrian arab republic"],
  ["moldova", "moldova republic of"],
  ["bolivia", "bolivia plurinational state of"],
  ["venezuela", "venezuela bolivarian republic of"],
  ["tanzania", "tanzania united republic of"],
  ["dr congo", "democratic republic of the congo"]
]);
const COUNTRY_FORCE_POINT = new Set<string>(["antarctica"]);

let worldCountryGeometryByNamePromise: Promise<Map<string, Entity["geometry"][]>> | null = null;
let allEntitiesByIdPromise: Promise<Map<string, Entity>> | null = null;
let packIndexPromise: Promise<Record<string, string[]>> | null = null;
let geometryIndexPromise: Promise<Record<string, string>> | null = null;
let packEntityMetaPromise: Promise<Record<string, Record<string, PackEntityMeta>>> | null = null;
const geometryShardPromises = new Map<string, Promise<Record<string, Entity["geometry"]>>>();

const loadWorldCountryGeometryByName = async (): Promise<Map<string, Entity["geometry"][]>> => {
  if (worldCountryGeometryByNamePromise) {
    return worldCountryGeometryByNamePromise;
  }

  worldCountryGeometryByNamePromise = fetch("./data/source/world-countries.geojson", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load world-countries.geojson");
      }
      const geo = (await response.json()) as {
        features?: Array<{ properties?: Record<string, unknown>; geometry?: Entity["geometry"] }>;
      };
      const byName = new Map<string, Entity["geometry"][]>();
      for (const feature of geo.features ?? []) {
        const props = feature?.properties ?? {};
        const geometry = feature?.geometry;
        if (!geometry) {
          continue;
        }
        const names = [
          props.NAME,
          props.NAME_LONG,
          props.ADMIN,
          props.SOVEREIGNT,
          props.GEOUNIT,
          props.SUBUNIT,
          props.BRK_NAME,
          props.BRNAME
        ]
          .map((name) => String(name ?? "").trim())
          .filter(Boolean);
        for (const name of names) {
          const key = normalizeName(name);
          const existing = byName.get(key);
          if (existing) {
            existing.push(geometry);
          } else {
            byName.set(key, [geometry]);
          }
        }
      }
      return byName;
    })
    .catch((error) => {
      console.error(error);
      return new Map<string, Entity["geometry"][]>();
    });

  return worldCountryGeometryByNamePromise;
};

const loadAllEntitiesById = async (): Promise<Map<string, Entity>> => {
  if (allEntitiesByIdPromise) {
    return allEntitiesByIdPromise;
  }

  allEntitiesByIdPromise = fetch("./data/entities-core.json", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load entities-core.json");
      }
      const entities = (await response.json()) as Entity[];
      return new Map(entities.map((entity) => [entity.id, entity]));
    })
    .catch((error) => {
      allEntitiesByIdPromise = null;
      throw error;
    });

  return allEntitiesByIdPromise;
};

const loadGeometryIndex = async (): Promise<Record<string, string>> => {
  if (geometryIndexPromise) {
    return geometryIndexPromise;
  }

  geometryIndexPromise = fetch("./data/entity-geometry-index.json", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load entity-geometry-index.json");
      }
      return (await response.json()) as Record<string, string>;
    })
    .catch((error) => {
      geometryIndexPromise = null;
      throw error;
    });

  return geometryIndexPromise;
};

const loadGeometryShard = async (shardId: string): Promise<Record<string, Entity["geometry"]>> => {
  const existing = geometryShardPromises.get(shardId);
  if (existing) {
    return existing;
  }

  const promise = fetch(`./data/entity-geometry-shards/${shardId}.json`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load entity geometry shard ${shardId}`);
      }
      return (await response.json()) as Record<string, Entity["geometry"]>;
    })
    .catch((error) => {
      geometryShardPromises.delete(shardId);
      throw error;
    });
  geometryShardPromises.set(shardId, promise);
  return promise;
};

const loadPackEntityMeta = async (): Promise<Record<string, Record<string, PackEntityMeta>>> => {
  if (packEntityMetaPromise) {
    return packEntityMetaPromise;
  }

  packEntityMetaPromise = fetch("./data/pack-entity-meta.json", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load pack-entity-meta.json");
      }
      return (await response.json()) as Record<string, Record<string, PackEntityMeta>>;
    })
    .catch((error) => {
      packEntityMetaPromise = null;
      throw error;
    });

  return packEntityMetaPromise;
};

const loadPackIndex = async (): Promise<Record<string, string[]>> => {
  if (packIndexPromise) {
    return packIndexPromise;
  }

  packIndexPromise = fetch("./data/pack-index.json", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load pack-index.json");
      }
      return (await response.json()) as Record<string, string[]>;
    })
    .catch((error) => {
      packIndexPromise = null;
      throw error;
    });

  return packIndexPromise;
};

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

const collectCoords = (node: unknown, out: [number, number][]): void => {
  if (!Array.isArray(node)) {
    return;
  }
  if (typeof node[0] === "number" && typeof node[1] === "number") {
    out.push([node[0], node[1]]);
    return;
  }
  for (const child of node) {
    collectCoords(child, out);
  }
};

const bboxFromGeometry = (geometry: Entity["geometry"]): [number, number, number, number] | undefined => {
  if (!geometry || !("coordinates" in geometry)) {
    return undefined;
  }
  const coords: [number, number][] = [];
  collectCoords(geometry.coordinates, coords);
  if (coords.length === 0) {
    return undefined;
  }
  let minLon = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
};

const withWorldCountryPolygons = async (entities: Entity[]): Promise<Entity[]> => {
  const hasCountryPoints = entities.some((entity) => entity.type === "country" && entity.geometryType === "point");
  if (!hasCountryPoints) {
    return entities;
  }

  const byName = await loadWorldCountryGeometryByName();
  if (byName.size === 0) {
    return entities;
  }

  return entities.map((entity) => {
    if (entity.type !== "country" || entity.geometryType !== "point") {
      return entity;
    }
    const normalized = normalizeName(entity.name);
    if (COUNTRY_FORCE_POINT.has(normalized)) {
      return entity;
    }
    const alias = COUNTRY_NAME_ALIASES.get(normalized);
    const candidates = [
      ...(byName.get(normalized) ?? []),
      ...((alias ? byName.get(normalizeName(alias)) : undefined) ?? [])
    ];
    if (candidates.length === 0) {
      return entity;
    }
    const geometry = pickBestCountryGeometryForEntity(entity, candidates);
    return {
      ...entity,
      geometryType: "polygon",
      // Keep original country topology to avoid antimeridian artifacts introduced by per-point wrapping.
      geometry,
      bbox: bboxFromGeometry(geometry) ?? entity.bbox
    };
  });
};

const pickBestCountryGeometryForEntity = (entity: Entity, candidates: Entity["geometry"][]): Entity["geometry"] => {
  const [lon, lat] = entity.labelPoint;
  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const bbox = bboxFromGeometry(candidate);
    if (!bbox) {
      continue;
    }
    const contains = lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
    const centerLon = (bbox[0] + bbox[2]) / 2;
    const centerLat = (bbox[1] + bbox[3]) / 2;
    const dist = Math.hypot(lon - centerLon, lat - centerLat);
    const score = contains ? dist * 0.01 : dist + 1000;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
};

export const loadPackEntities = async (packId: string): Promise<Entity[]> => {
  const [packEntityMeta, packIndex, entitiesById, geometryIndex] = await Promise.all([
    loadPackEntityMeta().catch(
      (): Record<string, Record<string, PackEntityMeta>> => ({})
    ),
    loadPackIndex(),
    loadAllEntitiesById(),
    loadGeometryIndex()
  ]);
  const packMetaByEntityId = packEntityMeta[packId] ?? {};
  const entityIds = packIndex[packId];
  if (!entityIds) {
    throw new Error(`Failed to load pack entities for ${packId}: pack is missing from pack-index.json`);
  }

  const requiredShards = new Set<string>();
  for (const id of entityIds) {
    const shardId = geometryIndex[id];
    if (shardId) {
      requiredShards.add(shardId);
    }
  }
  const shardRecords = await Promise.all([...requiredShards].map((shardId) => loadGeometryShard(shardId)));
  const geometryById: Record<string, Entity["geometry"]> = {};
  for (const record of shardRecords) {
    Object.assign(geometryById, record);
  }

  const entities = entityIds
    .map((id) => {
      const core = entitiesById.get(id);
      if (!core) {
        return null;
      }
      const geometry = geometryById[id];
      const packMeta = packMetaByEntityId[id];
      if (geometry) {
        return packMeta ? { ...core, geometry, packMeta } : { ...core, geometry };
      }
      return packMeta ? { ...core, packMeta } : { ...core };
    })
    .filter((entity): entity is Entity => Boolean(entity));
  if (packId === "usa_states" || packId === "us_states_capitals") {
    return withUsStatePolygons(entities);
  }
  if (packId === "india_states_capitals") {
    return withIndiaStatePolygons(entities);
  }
  if (packId === "canada_provinces_territories") {
    return withCanadaProvincePolygons(entities);
  }
  return withWorldCountryPolygons(entities);
};

export const loadPacks = async (): Promise<Pack[]> => {
  const response = await fetch("./data/packs.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load packs.json");
  }

  return (await response.json()) as Pack[];
};
