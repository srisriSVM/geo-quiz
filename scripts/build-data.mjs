import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve(process.cwd(), "public/data/sample-entities.json");
const indexOutputPath = resolve(process.cwd(), "public/data/entities-index.json");
const packOutputDir = resolve(process.cwd(), "public/data/pack-entities");
const usStatesPath = resolve(process.cwd(), "public/data/source/us-states.geojson");
const indiaStatesPath = resolve(process.cwd(), "public/data/source/india-states.geojson");
const canadaProvincesPath = resolve(process.cwd(), "public/data/source/canada-provinces.geojson");

const source = JSON.parse(readFileSync(inputPath, "utf-8"));
const usStatesGeo = JSON.parse(readFileSync(usStatesPath, "utf-8"));
const indiaStatesGeo = JSON.parse(readFileSync(indiaStatesPath, "utf-8"));
const canadaProvincesGeo = JSON.parse(readFileSync(canadaProvincesPath, "utf-8"));

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
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

const entities = source
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((entity) => {
    if (entity.type === "state" && (entity.packIds ?? []).includes("usa_states")) {
      const geometry = usStateGeometryByName.get(normalizeName(entity.name));
      if (geometry) {
        const withGeometry = {
          ...entity,
          geometryType: "polygon",
          geometry
        };
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
  });

const byPack = new Map();
for (const entity of entities) {
  for (const packId of entity.packIds ?? []) {
    if (!byPack.has(packId)) {
      byPack.set(packId, []);
    }
    byPack.get(packId).push(entity);
  }
}

mkdirSync(packOutputDir, { recursive: true });
for (const [packId, packEntities] of byPack.entries()) {
  const outPath = resolve(packOutputDir, `${packId}.entities.json`);
  const sorted = packEntities.slice().sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(outPath, JSON.stringify(sorted, null, 2) + "\n");
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
console.log(
  `Generated ${entities.length} entities, ${byPack.size} pack files at ${packOutputDir}, and index at ${indexOutputPath}`
);
