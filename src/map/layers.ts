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

export const getDarkQuizStyle = (lowDataMode: boolean): StyleSpecification => ({
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    dark: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: lowDataMode ? 10 : 18,
      attribution: "© OpenStreetMap contributors © CARTO"
    }
  },
  layers: [
    {
      id: "dark",
      type: "raster",
      source: "dark"
    }
  ]
});

export const getMonochromeStyle = (lowDataMode: boolean): StyleSpecification => ({
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    mono: {
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
      id: "mono",
      type: "raster",
      source: "mono",
      paint: {
        "raster-saturation": -1,
        "raster-contrast": 0.06,
        "raster-brightness-min": 0.12,
        "raster-brightness-max": 0.92
      }
    }
  ]
});

export const getSatelliteStyle = (lowDataMode: boolean): StyleSpecification => ({
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      maxzoom: lowDataMode ? 10 : 18,
      attribution: "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite"
    }
  ]
});

export const getNightLightsStyle = (lowDataMode: boolean): StyleSpecification => ({
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    night_base: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: lowDataMode ? 9 : 14,
      attribution: "© OpenStreetMap contributors © CARTO"
    },
    city_lights: {
      type: "raster",
      tiles: [
        "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg"
      ],
      tileSize: 256,
      maxzoom: 8,
      attribution: "NASA Earth Observatory/NOAA NGDC"
    }
  },
  layers: [
    {
      id: "night_base",
      type: "raster",
      source: "night_base"
    },
    {
      id: "city_lights",
      type: "raster",
      source: "city_lights",
      paint: {
        "raster-opacity": lowDataMode ? 0.78 : 0.9,
        "raster-contrast": 0.16,
        "raster-saturation": 0.28
      }
    }
  ]
});
