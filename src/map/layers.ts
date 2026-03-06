import type { StyleSpecification } from "maplibre-gl";

export const getPoliticalStyleUrl = (): string => "https://demotiles.maplibre.org/style.json";

export const getPhysicalBasicStyle = (lowDataMode: boolean): StyleSpecification => ({
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    basic: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: lowDataMode ? 10 : 17,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "basic",
      type: "raster",
      source: "basic"
    }
  ]
});

export const getPhysicalReliefStyle = (lowDataMode: boolean): StyleSpecification => ({
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    relief: {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: lowDataMode ? 10 : 17,
      attribution:
        "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)"
    }
  },
  layers: [
    {
      id: "relief",
      type: "raster",
      source: "relief"
    }
  ]
});
