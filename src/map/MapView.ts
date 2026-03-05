import type { Feature, FeatureCollection, Geometry } from "geojson";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type { Entity, Pack } from "../data/types";
import { getBaseStyleUrl } from "./layers";

const SOURCE_POLYGONS = "entities-polygons-source";
const SOURCE_POINTS = "entities-points-source";

const LAYER_POLYGONS = "entities-polygons";
const LAYER_POLYGON_OUTLINE = "entities-polygon-outline";
const LAYER_POINTS = "entities-points";
const LAYER_HIGHLIGHT_POLYGON = "entities-highlight-polygon";
const LAYER_HIGHLIGHT_POLYGON_OUTLINE = "entities-highlight-polygon-outline";
const LAYER_HIGHLIGHT_POINT = "entities-highlight-point";
const LAYER_HIGHLIGHT_LABEL = "entities-highlight-label";

type Mode = "learn" | "quiz";

type EntityFeatureProps = {
  id: string;
  name: string;
  geometryType: "point" | "line" | "polygon";
};

export class MapView {
  private readonly host: HTMLElement;
  private map: MapLibreMap | null = null;
  private mapLoaded = false;

  private pendingEntities: Entity[] = [];
  private pendingHighlightedEntityId: string | null = null;
  private pendingPack: Pack | null = null;
  private pendingMode: Mode = "learn";
  private pendingFocusEntity: Entity | null = null;
  private highlightedDotMarker: maplibregl.Marker | null = null;
  private highlightedLabelMarker: maplibregl.Marker | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  mount(): void {
    const map = new maplibregl.Map({
      container: this.host,
      style: getBaseStyleUrl(),
      center: [10, 30],
      zoom: 1.4
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      this.mapLoaded = true;
      const styleLayers = map.getStyle().layers ?? [];
      for (const layer of styleLayers) {
        if (layer.type === "symbol") {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }
      this.addEntityLayers(map);
      this.applyPendingState();
    });

    this.map = map;
  }

  setMode(mode: Mode): void {
    this.pendingMode = mode;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const showAll = mode === "learn";
    this.map.setLayoutProperty(LAYER_POLYGONS, "visibility", showAll ? "visible" : "none");
    this.map.setLayoutProperty(LAYER_POLYGON_OUTLINE, "visibility", showAll ? "visible" : "none");
    this.map.setLayoutProperty(LAYER_POINTS, "visibility", showAll ? "visible" : "none");
    this.map.setLayoutProperty(LAYER_HIGHLIGHT_LABEL, "visibility", showAll ? "visible" : "none");
    this.renderHighlightedMarkers();
  }

  setEntities(entities: Entity[]): void {
    this.pendingEntities = entities;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const polygonSource = this.map.getSource(SOURCE_POLYGONS) as maplibregl.GeoJSONSource | undefined;
    const pointSource = this.map.getSource(SOURCE_POINTS) as maplibregl.GeoJSONSource | undefined;
    if (!polygonSource || !pointSource) {
      return;
    }

    const polygonFeatures: Feature[] = [];
    const pointFeatures: Feature[] = [];

    for (const entity of entities) {
      const pointFeature = this.toPointFeature(entity);
      pointFeatures.push(pointFeature);

      if (entity.geometryType === "polygon" && entity.geometry) {
        polygonFeatures.push(this.toGeometryFeature(entity));
      }
    }

    polygonSource.setData({ type: "FeatureCollection", features: polygonFeatures } as FeatureCollection);
    pointSource.setData({ type: "FeatureCollection", features: pointFeatures } as FeatureCollection);
    this.renderHighlightedMarkers();
  }

  setHighlightedEntity(entityId: string | null): void {
    this.pendingHighlightedEntityId = entityId;
    if (!this.map || !this.mapLoaded) {
      return;
    }
    this.applyHighlightFilter(entityId);
    this.renderHighlightedMarkers();
  }

  focusEntity(entity: Entity): void {
    this.pendingFocusEntity = entity;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    if (entity.bbox) {
      this.map.fitBounds(
        [
          [entity.bbox[0], entity.bbox[1]],
          [entity.bbox[2], entity.bbox[3]]
        ],
        { padding: 56, maxZoom: 5.5, duration: 500 }
      );
      return;
    }

    this.map.flyTo({ center: entity.labelPoint, zoom: 5, duration: 500 });
  }

  flyToPack(pack: Pack): void {
    this.pendingPack = pack;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    this.applyPackBounds(pack);
    this.map.flyTo({ center: pack.defaultViewport.center, zoom: pack.defaultViewport.zoom, duration: 600 });
  }

  private applyPendingState(): void {
    this.setEntities(this.pendingEntities);
    this.setMode(this.pendingMode);
    this.applyHighlightFilter(this.pendingHighlightedEntityId);
    this.renderHighlightedMarkers();

    if (this.pendingPack && this.map) {
      this.applyPackBounds(this.pendingPack);
      this.map.jumpTo({ center: this.pendingPack.defaultViewport.center, zoom: this.pendingPack.defaultViewport.zoom });
    }

    if (this.pendingFocusEntity) {
      this.focusEntity(this.pendingFocusEntity);
    }
  }

  private applyHighlightFilter(entityId: string | null): void {
    if (!this.map) {
      return;
    }

    const idFilter = entityId ? ["==", "id", entityId] : ["==", "id", ""];
    this.map.setFilter(LAYER_HIGHLIGHT_POLYGON, idFilter as never);
    this.map.setFilter(LAYER_HIGHLIGHT_POLYGON_OUTLINE, idFilter as never);
    this.map.setFilter(LAYER_HIGHLIGHT_POINT, idFilter as never);
    this.map.setFilter(LAYER_HIGHLIGHT_LABEL, idFilter as never);
  }

  private addEntityLayers(map: MapLibreMap): void {
    const emptyData: FeatureCollection = { type: "FeatureCollection", features: [] };

    map.addSource(SOURCE_POLYGONS, { type: "geojson", data: emptyData });
    map.addSource(SOURCE_POINTS, { type: "geojson", data: emptyData });

    map.addLayer({
      id: LAYER_POLYGONS,
      type: "fill",
      source: SOURCE_POLYGONS,
      paint: { "fill-color": "#14b8a6", "fill-opacity": 0.33 }
    });

    map.addLayer({
      id: LAYER_POLYGON_OUTLINE,
      type: "line",
      source: SOURCE_POLYGONS,
      paint: { "line-color": "#0b5560", "line-width": 2.5 }
    });

    map.addLayer({
      id: LAYER_POINTS,
      type: "circle",
      source: SOURCE_POINTS,
      paint: {
        "circle-color": "#0f766e",
        "circle-radius": 5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5
      }
    });

    map.addLayer({
      id: LAYER_HIGHLIGHT_POLYGON,
      type: "fill",
      source: SOURCE_POLYGONS,
      filter: ["==", "id", ""],
      paint: { "fill-color": "#f59e0b", "fill-opacity": 0.56 }
    });

    map.addLayer({
      id: LAYER_HIGHLIGHT_POLYGON_OUTLINE,
      type: "line",
      source: SOURCE_POLYGONS,
      filter: ["==", "id", ""],
      paint: { "line-color": "#7c2d12", "line-width": 4 }
    });

    map.addLayer({
      id: LAYER_HIGHLIGHT_POINT,
      type: "circle",
      source: SOURCE_POINTS,
      filter: ["==", "id", ""],
      paint: {
        "circle-color": "#f59e0b",
        "circle-radius": 13,
        "circle-opacity": 0.45,
        "circle-stroke-color": "#92400e",
        "circle-stroke-width": 2.5
      }
    });

    map.addLayer({
      id: LAYER_HIGHLIGHT_LABEL,
      type: "symbol",
      source: SOURCE_POINTS,
      filter: ["==", "id", ""],
      layout: {
        "text-field": ["get", "name"],
        "text-size": 16,
        "text-font": ["Open Sans Bold"],
        "text-anchor": "top",
        "text-offset": [0, 1.1]
      },
      paint: {
        "text-color": "#102a43",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6
      }
    });
  }

  private toPointFeature(entity: Entity): Feature {
    return {
      type: "Feature",
      id: entity.id,
      geometry: { type: "Point", coordinates: entity.labelPoint },
      properties: {
        id: entity.id,
        name: entity.name,
        geometryType: "point"
      } satisfies EntityFeatureProps
    };
  }

  private toGeometryFeature(entity: Entity): Feature {
    return {
      type: "Feature",
      id: entity.id,
      geometry: entity.geometry as Geometry,
      properties: {
        id: entity.id,
        name: entity.name,
        geometryType: entity.geometryType
      } satisfies EntityFeatureProps
    };
  }

  private applyPackBounds(pack: Pack): void {
    if (!this.map) {
      return;
    }

    if (pack.id.startsWith("europe_")) {
      this.map.setMaxBounds([
        [-25, 34],
        [45, 72]
      ]);
      this.map.setMinZoom(2.8);
      return;
    }

    this.map.setMaxBounds(null);
    this.map.setMinZoom(0.5);
  }

  private renderHighlightedMarkers(): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    this.highlightedDotMarker?.remove();
    this.highlightedDotMarker = null;
    this.highlightedLabelMarker?.remove();
    this.highlightedLabelMarker = null;

    if (!this.pendingHighlightedEntityId) {
      return;
    }

    const target = this.pendingEntities.find((entity) => entity.id === this.pendingHighlightedEntityId);
    if (!target) {
      return;
    }

    const dot = document.createElement("div");
    dot.style.width = "20px";
    dot.style.height = "20px";
    dot.style.borderRadius = "999px";
    dot.style.background = "rgba(245,158,11,0.55)";
    dot.style.border = "3px solid #7c2d12";
    dot.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
    this.highlightedDotMarker = new maplibregl.Marker({ element: dot }).setLngLat(target.labelPoint).addTo(this.map);

    if (this.pendingMode === "learn") {
      const label = document.createElement("div");
      label.textContent = target.name;
      label.style.padding = "4px 8px";
      label.style.borderRadius = "8px";
      label.style.fontSize = "14px";
      label.style.fontWeight = "700";
      label.style.background = "rgba(255,255,255,0.92)";
      label.style.color = "#102a43";
      label.style.border = "1px solid rgba(16,42,67,0.25)";
      label.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
      this.highlightedLabelMarker = new maplibregl.Marker({ element: label, offset: [0, -24] })
        .setLngLat(target.labelPoint)
        .addTo(this.map);
    }
  }
}
