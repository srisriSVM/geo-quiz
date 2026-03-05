import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = resolve(process.cwd(), "public/data/sample-entities.json");
const outputPath = resolve(process.cwd(), "public/data/entities.json");

const source = JSON.parse(readFileSync(inputPath, "utf-8"));

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
  .map((entity) => ({
    ...entity,
    bbox: toBbox(entity)
  }));

writeFileSync(outputPath, JSON.stringify(entities, null, 2) + "\n");
console.log(`Generated ${entities.length} entities at ${outputPath}`);
