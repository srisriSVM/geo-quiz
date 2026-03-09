import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve(process.cwd(), "public/data/sample-entities.json");
const packEntityMetaSourcePath = resolve(process.cwd(), "public/data/pack-entity-meta.source.json");
const entitiesCoreOutputPath = resolve(process.cwd(), "public/data/entities-core.json");
const legacyEntitiesOutputPath = resolve(process.cwd(), "public/data/entities.json");
const packIndexOutputPath = resolve(process.cwd(), "public/data/pack-index.json");
const geometryIndexOutputPath = resolve(process.cwd(), "public/data/entity-geometry-index.json");
const geometryShardDir = resolve(process.cwd(), "public/data/entity-geometry-shards");
const packEntityMetaOutputPath = resolve(process.cwd(), "public/data/pack-entity-meta.json");
const indexOutputPath = resolve(process.cwd(), "public/data/entities-index.json");
const legacyPackOutputDir = resolve(process.cwd(), "public/data/pack-entities");
const usStatesPath = resolve(process.cwd(), "public/data/source/us-states.geojson");
const indiaStatesPath = resolve(process.cwd(), "public/data/source/india-states.geojson");
const canadaProvincesPath = resolve(process.cwd(), "public/data/source/canada-provinces.geojson");
const worldRiversPath = resolve(process.cwd(), "public/data/source/world-rivers-hires.geojson");
const worldMountainRangesPath = resolve(process.cwd(), "public/data/source/world-mountain-ranges-hires.geojson");

const source = JSON.parse(readFileSync(inputPath, "utf-8"));
const packEntityMetaSource = JSON.parse(readFileSync(packEntityMetaSourcePath, "utf-8"));
const usStatesGeo = JSON.parse(readFileSync(usStatesPath, "utf-8"));
const indiaStatesGeo = JSON.parse(readFileSync(indiaStatesPath, "utf-8"));
const canadaProvincesGeo = JSON.parse(readFileSync(canadaProvincesPath, "utf-8"));
const worldRiversGeo = JSON.parse(readFileSync(worldRiversPath, "utf-8"));
const worldMountainRangesGeo = JSON.parse(readFileSync(worldMountainRangesPath, "utf-8"));
const DEFER_POLYGON_PACK_IDS = new Set([
  "usa_states",
  "us_states_capitals",
  "india_states_capitals",
  "canada_provinces_territories"
]);

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeRiverName(value) {
  return normalizeName(value)
    .replace(/\bsegment\b/g, " ")
    .replace(/\bdelta\b/g, " ")
    .replace(/\bbranch\b/g, " ")
    .replace(/\bcanal\b/g, " ")
    .replace(/\briver\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMountainRangeName(value) {
  return normalizeName(value)
    .replace(/\bmts\b/g, " ")
    .replace(/\bmt\b/g, " ")
    .replace(/\bmountains\b/g, " ")
    .replace(/\bmountain\b/g, " ")
    .replace(/\brange\b/g, " ")
    .replace(/\bhills\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapLongitude(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function normalizeGeometry(geometry) {
  if (!geometry?.coordinates) {
    return geometry;
  }

  const normalizeCoords = (node) => {
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
    coordinates: normalizeCoords(geometry.coordinates)
  };
}

const usStateGeometryByName = new Map(
  (usStatesGeo.features ?? [])
    .filter((feature) => feature?.properties?.name && feature?.geometry)
    .map((feature) => [normalizeName(feature.properties.name), normalizeGeometry(feature.geometry)])
);

const INDIA_NAME_ALIASES = new Map([
  ["odisha", "orissa"],
  ["orissa", "odisha"],
  ["uttarakhand", "uttaranchal"],
  ["uttaranchal", "uttarakhand"],
  ["dadra and nagar haveli and daman and diu", "dadra and nagar haveli"],
  ["dadra and nagar haveli and daman and diu", "daman and diu"]
]);

const indiaStateGeometryByName = new Map(
  (indiaStatesGeo.features ?? [])
    .filter((feature) => {
      const properties = feature?.properties ?? {};
      return (
        (properties.shapeName || properties.NAME_1 || properties.name || properties.st_nm) &&
        feature?.geometry
      );
    })
    .map((feature) => {
      const properties = feature.properties ?? {};
      const stateName = properties.shapeName || properties.NAME_1 || properties.name || properties.st_nm;
      return [normalizeName(stateName), normalizeGeometry(feature.geometry)];
    })
);

const canadaProvinceGeometryByName = new Map(
  (canadaProvincesGeo.features ?? [])
    .filter((feature) => {
      const properties = feature?.properties ?? {};
      return (properties.shapeName || properties.NAME_1 || properties.name || properties.st_nm) && feature?.geometry;
    })
    .map((feature) => {
      const properties = feature.properties ?? {};
      const name = properties.shapeName || properties.NAME_1 || properties.name || properties.st_nm;
      return [normalizeName(name), normalizeGeometry(feature.geometry)];
    })
);

function collectCoords(node, out) {
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
}

function geometryDistanceScore(geometry, targetPoint) {
  if (!geometry || !geometry.coordinates) {
    return Number.POSITIVE_INFINITY;
  }
  const coords = [];
  collectCoords(geometry.coordinates, coords);
  if (coords.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  let best = Number.POSITIVE_INFINITY;
  for (const [lon, lat] of coords) {
    const dx = lon - targetPoint[0];
    const dy = lat - targetPoint[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
    }
  }
  return best;
}

function toBbox(entity) {
  const coords = [];
  if (entity.geometry && entity.geometry.coordinates) {
    collectCoords(entity.geometry.coordinates, coords);
  }

  if (coords.length === 0) {
    coords.push(entity.labelPoint);
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
}

const riverFeatures = (worldRiversGeo.features ?? []).filter((feature) => {
  const geometryType = feature?.geometry?.type;
  return geometryType === "LineString" || geometryType === "MultiLineString";
});

const riverFeaturesByName = new Map();
for (const feature of riverFeatures) {
  const properties = feature?.properties ?? {};
  const names = [properties.name, properties.name_en, properties.name_alt]
    .map((value) => normalizeRiverName(value))
    .filter(Boolean);
  for (const name of names) {
    if (!riverFeaturesByName.has(name)) {
      riverFeaturesByName.set(name, []);
    }
    riverFeaturesByName.get(name).push(feature);
  }
}

const mountainRangeFeatures = (worldMountainRangesGeo.features ?? []).filter((feature) => {
  const featureClass = String(feature?.properties?.FEATURECLA ?? "").trim().toLowerCase();
  return featureClass === "range/mtn";
});

const mountainRangeFeaturesByName = new Map();
for (const feature of mountainRangeFeatures) {
  const properties = feature?.properties ?? {};
  const names = [properties.NAME, properties.NAME_EN, properties.NAMEALT]
    .map((value) => normalizeMountainRangeName(value))
    .filter(Boolean);
  for (const name of names) {
    if (!mountainRangeFeaturesByName.has(name)) {
      mountainRangeFeaturesByName.set(name, []);
    }
    mountainRangeFeaturesByName.get(name).push(feature);
  }
}

function riverNameCandidates(entityName) {
  const base = normalizeRiverName(entityName.replace(/\(.*?\)/g, " "));
  if (!base) {
    return [];
  }
  const candidates = new Set([base]);
  if (base.endsWith(" india")) {
    candidates.add(base.replace(/\s+india$/, "").trim());
  }
  if (base.includes(" yellow ")) {
    candidates.add(base.replace(/\byellow\b/g, "huang he").replace(/\s+/g, " ").trim());
  }
  if (base === "yellow") {
    candidates.add("huang he");
    candidates.add("yellow");
  }
  return [...candidates].filter(Boolean);
}

function pickHighDetailRiverGeometry(entity) {
  const nameCandidates = riverNameCandidates(entity.name);
  if (nameCandidates.length === 0) {
    return null;
  }

  const matched = [];
  for (const candidate of nameCandidates) {
    const byExact = riverFeaturesByName.get(candidate) ?? [];
    for (const feature of byExact) {
      matched.push(feature);
    }
  }

  if (matched.length === 0) {
    for (const [name, features] of riverFeaturesByName.entries()) {
      if (!nameCandidates.some((candidate) => name.includes(candidate) || candidate.includes(name))) {
        continue;
      }
      for (const feature of features) {
        matched.push(feature);
      }
    }
  }

  if (matched.length === 0) {
    return null;
  }

  let bestFeature = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const feature of matched) {
    const score = geometryDistanceScore(feature.geometry, entity.labelPoint);
    if (score < bestScore) {
      bestScore = score;
      bestFeature = feature;
    }
  }

  const chosen = bestFeature?.geometry;
  if (!chosen) {
    return null;
  }
  return normalizeGeometry(chosen);
}

function mountainRangeNameCandidates(entityName) {
  const base = normalizeMountainRangeName(entityName.replace(/\(.*?\)/g, " "));
  if (!base) {
    return [];
  }
  const candidates = new Set([base]);
  if (base === "appalachian") {
    candidates.add("appalachian");
  }
  if (base === "caucasus") {
    candidates.add("caucasus");
  }
  if (base === "carpathian") {
    candidates.add("carpathian");
  }
  if (base === "rocky") {
    candidates.add("rocky");
  }
  return [...candidates].filter(Boolean);
}

function pickHighDetailMountainRangeGeometry(entity) {
  const nameCandidates = mountainRangeNameCandidates(entity.name);
  if (nameCandidates.length === 0) {
    return null;
  }

  const matched = [];
  for (const candidate of nameCandidates) {
    const byExact = mountainRangeFeaturesByName.get(candidate) ?? [];
    for (const feature of byExact) {
      matched.push(feature);
    }
  }

  if (matched.length === 0) {
    for (const [name, features] of mountainRangeFeaturesByName.entries()) {
      if (!nameCandidates.some((candidate) => name.includes(candidate) || candidate.includes(name))) {
        continue;
      }
      for (const feature of features) {
        matched.push(feature);
      }
    }
  }

  if (matched.length === 0) {
    return null;
  }

  let bestFeature = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const feature of matched) {
    const score = geometryDistanceScore(feature.geometry, entity.labelPoint);
    if (score < bestScore) {
      bestScore = score;
      bestFeature = feature;
    }
  }

  const chosen = bestFeature?.geometry;
  if (!chosen) {
    return null;
  }
  return normalizeGeometry(chosen);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shardForEntityId(id) {
  return (hashString(id) % 16).toString(16).padStart(2, "0");
}

const entities = source
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((entity) => {
    if (entity.type === "mountain" && entity.geometryType === "line") {
      const highDetailMountainGeometry = pickHighDetailMountainRangeGeometry(entity);
      if (highDetailMountainGeometry) {
        const withGeometry = {
          ...entity,
          geometryType: "polygon",
          geometry: highDetailMountainGeometry
        };
        return {
          ...withGeometry,
          bbox: toBbox(withGeometry)
        };
      }
    }

    if (entity.type === "river" && entity.geometryType === "line") {
      const highDetailRiverGeometry = pickHighDetailRiverGeometry(entity);
      if (highDetailRiverGeometry) {
        const withGeometry = {
          ...entity,
          geometry: highDetailRiverGeometry
        };
        return {
          ...withGeometry,
          bbox: toBbox(withGeometry)
        };
      }
    }

    const shouldDeferPolygonGeometry = (entity.packIds ?? []).some((packId) => DEFER_POLYGON_PACK_IDS.has(packId));

    if (entity.type === "state" && (entity.packIds ?? []).includes("usa_states")) {
      const geometry = usStateGeometryByName.get(normalizeName(entity.name));
      if (geometry) {
        const withGeometry = {
          ...entity,
          geometryType: "polygon",
          geometry
        };
        if (shouldDeferPolygonGeometry) {
          return {
            ...entity,
            bbox: toBbox(withGeometry)
          };
        }
        return {
          ...withGeometry,
          bbox: toBbox(withGeometry)
        };
      }
    }

    if (entity.type === "state" && (entity.packIds ?? []).includes("india_states_capitals")) {
      const normalized = normalizeName(entity.name);
      const candidates = [normalized];
      const alias = INDIA_NAME_ALIASES.get(normalized);
      if (alias) {
        candidates.push(alias);
      }
      const geometry = candidates.map((name) => indiaStateGeometryByName.get(name)).find(Boolean);
      if (geometry) {
        const withGeometry = {
          ...entity,
          geometryType: "polygon",
          geometry
        };
        if (shouldDeferPolygonGeometry) {
          return {
            ...entity,
            bbox: toBbox(withGeometry)
          };
        }
        return {
          ...withGeometry,
          bbox: toBbox(withGeometry)
        };
      }
    }

    if (entity.type === "state" && (entity.packIds ?? []).includes("canada_provinces_territories")) {
      const geometry = canadaProvinceGeometryByName.get(normalizeName(entity.name));
      if (geometry) {
        const withGeometry = {
          ...entity,
          geometryType: "polygon",
          geometry
        };
        if (shouldDeferPolygonGeometry) {
          return {
            ...entity,
            bbox: toBbox(withGeometry)
          };
        }
        return {
          ...withGeometry,
          bbox: toBbox(withGeometry)
        };
      }
    }

    return {
      ...entity,
      bbox: toBbox(entity)
    };
  })
  .map((entity) => {
    const shouldDeferPolygonGeometry =
      entity.type === "state" && (entity.packIds ?? []).some((packId) => DEFER_POLYGON_PACK_IDS.has(packId));
    if (!shouldDeferPolygonGeometry) {
      return entity;
    }
    const { geometry: _geometry, ...rest } = entity;
    return {
      ...rest,
      geometryType: "point"
    };
  });

const byPack = new Map();
for (const entity of entities) {
  for (const packId of entity.packIds ?? []) {
    if (!byPack.has(packId)) {
      byPack.set(packId, []);
    }
    byPack.get(packId).push(entity.id);
  }
}

const sortedEntities = entities.slice().sort((a, b) => a.id.localeCompare(b.id));
const packIndex = Object.fromEntries(
  [...byPack.entries()]
    .map(([packId, entityIds]) => [packId, entityIds.slice().sort((a, b) => a.localeCompare(b))])
    .sort((a, b) => a[0].localeCompare(b[0]))
);

const coreEntities = [];
const geometryIndex = {};
const geometriesByShard = new Map();
for (const entity of sortedEntities) {
  const { geometry, ...core } = entity;
  coreEntities.push(core);
  if (!geometry) {
    continue;
  }
  const shardId = shardForEntityId(entity.id);
  geometryIndex[entity.id] = shardId;
  if (!geometriesByShard.has(shardId)) {
    geometriesByShard.set(shardId, {});
  }
  geometriesByShard.get(shardId)[entity.id] = geometry;
}

const allEntityIds = new Set(sortedEntities.map((entity) => entity.id));
const packEntityMeta = {};
for (const [packId, entries] of Object.entries(packEntityMetaSource ?? {})) {
  const idsInPack = new Set(packIndex[packId] ?? []);
  const validEntries = {};
  for (const [entityId, meta] of Object.entries(entries ?? {})) {
    if (!allEntityIds.has(entityId) || !idsInPack.has(entityId)) {
      continue;
    }
    validEntries[entityId] = meta;
  }
  if (Object.keys(validEntries).length > 0) {
    packEntityMeta[packId] = Object.fromEntries(
      Object.entries(validEntries).sort(([a], [b]) => a.localeCompare(b))
    );
  }
}

mkdirSync(resolve(process.cwd(), "public/data"), { recursive: true });
writeFileSync(entitiesCoreOutputPath, JSON.stringify(coreEntities, null, 2) + "\n");
writeFileSync(packIndexOutputPath, JSON.stringify(packIndex, null, 2) + "\n");
writeFileSync(geometryIndexOutputPath, JSON.stringify(geometryIndex, null, 2) + "\n");
writeFileSync(packEntityMetaOutputPath, JSON.stringify(packEntityMeta, null, 2) + "\n");
rmSync(geometryShardDir, { recursive: true, force: true });
mkdirSync(geometryShardDir, { recursive: true });
for (const [shardId, records] of [...geometriesByShard.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const outPath = resolve(geometryShardDir, `${shardId}.json`);
  writeFileSync(outPath, JSON.stringify(records, null, 2) + "\n");
}

const index = entities.map((entity) => ({
  id: entity.id,
  type: entity.type,
  name: entity.name,
  geometryType: entity.geometryType,
  labelPoint: entity.labelPoint,
  packIds: entity.packIds
}));

writeFileSync(indexOutputPath, JSON.stringify(index, null, 2) + "\n");
rmSync(legacyPackOutputDir, { recursive: true, force: true });
rmSync(legacyEntitiesOutputPath, { force: true });
console.log(
  `Generated ${entities.length} entities at ${entitiesCoreOutputPath}, pack index at ${packIndexOutputPath}, geometry index at ${geometryIndexOutputPath}, pack metadata at ${packEntityMetaOutputPath}, shards at ${geometryShardDir}, and lightweight index at ${indexOutputPath}`
);
