import type { Feature, FeatureCollection, Geometry } from "geojson";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import type { Entity, Pack } from "../data/types";
import {
  getPhysicalBasicStyle,
  getPhysicalReliefStyle,
  getPoliticalStyleUrl
} from "./layers";

const SOURCE_POLYGONS = "entities-polygons-source";
const SOURCE_LINES = "entities-lines-source";
const SOURCE_POINTS = "entities-points-source";
const SOURCE_TARGET_LINE = "entities-target-line-source";
const SOURCE_USA_STATE_BORDERS = "usa-state-borders-source";

const LAYER_POLYGONS = "entities-polygons";
const LAYER_POLYGON_OUTLINE = "entities-polygon-outline";
const LAYER_LINES = "entities-lines";
const LAYER_LINES_CASING = "entities-lines-casing";
const LAYER_POINTS = "entities-points";
const LAYER_MASTERED_BADGE = "entities-mastered-badge";
const LAYER_HIGHLIGHT_POLYGON = "entities-highlight-polygon";
const LAYER_HIGHLIGHT_POLYGON_OUTLINE = "entities-highlight-polygon-outline";
const LAYER_HIGHLIGHT_LINE = "entities-highlight-line";
const LAYER_TARGET_LINE_CASING = "entities-target-line-casing";
const LAYER_TARGET_LINE = "entities-target-line";
const LAYER_HIGHLIGHT_POINT = "entities-highlight-point";
const LAYER_HIGHLIGHT_LABEL = "entities-highlight-label";
const LAYER_USA_STATE_FILL = "usa-state-fill";
const LAYER_USA_STATE_BORDERS = "usa-state-borders";

type Mode = "learn" | "quiz";
type MapDetail = "quiz_clean" | "reference_full" | "physical_basic" | "physical_relief";

type EntityFeatureProps = {
  id: string;
  name: string;
  geometryType: "point" | "line" | "polygon";
  mastery: "not_learned" | "learning" | "mastered";
};

export class MapView {
  private readonly host: HTMLElement;
  private map: MapLibreMap | null = null;
  private mapLoaded = false;

  private pendingEntities: Entity[] = [];
  private pendingHighlightedEntityId: string | null = null;
  private pendingPack: Pack | null = null;
  private pendingMode: Mode = "learn";
  private pendingMapDetail: MapDetail = "quiz_clean";
  private pendingLowDataMode = true;
  private pendingMasteryById: Record<string, "not_learned" | "learning" | "mastered"> = {};
  private pendingFocusEntity: Entity | null = null;
  private pendingCamera:
    | {
        center: [number, number];
        zoom: number;
        bearing: number;
        pitch: number;
      }
    | null = null;
  private highlightedDotMarker: maplibregl.Marker | null = null;
  private highlightedLabelMarker: maplibregl.Marker | null = null;
  private highlightedRiverMarkers: maplibregl.Marker[] = [];
  private pointStatusMarkers: maplibregl.Marker[] = [];
  private recentlyMasteredIds = new Set<string>();
  private usaStatesGeoJson: FeatureCollection | null = null;
  private usaStatesGeoJsonRequest: Promise<void> | null = null;
  private currentStyleSignature = "political";
  private entityClickHandler: ((entityId: string) => void) | null = null;
  private styleReloadToken = 0;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  mount(): void {
    const map = new maplibregl.Map({
      container: this.host,
      style: getPoliticalStyleUrl(),
      center: [10, 30],
      zoom: 1.4
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      this.mapLoaded = true;
      this.applyBaseDetailVisibility();
      this.addEntityLayers(map);
      this.bindInteractionHandlers(map);
      this.applyPendingState();
    });

    map.on("style.load", () => {
      this.mapLoaded = true;
      this.applyBaseDetailVisibility();
      this.addEntityLayers(map);
      this.bindInteractionHandlers(map);
      this.applyPendingState();
      requestAnimationFrame(() => {
        this.applyPendingState();
      });
    });

    this.map = map;
  }

  setMode(mode: Mode): void {
    this.pendingMode = mode;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const showAll = mode === "learn";
    const hasPolygonEntities = this.pendingEntities.some((entity) => entity.geometryType === "polygon");
    const showPolygonContext = showAll || hasPolygonEntities;

    this.setLayerVisibility(LAYER_POLYGONS, showPolygonContext ? "visible" : "none");
    this.setLayerVisibility(LAYER_POLYGON_OUTLINE, showPolygonContext ? "visible" : "none");
    this.setLayerPaint(LAYER_POLYGONS, "fill-opacity", showAll ? 0.33 : 0.14);
    this.setLayerPaint(LAYER_POLYGON_OUTLINE, "line-opacity", showAll ? 1 : 0.88);
    this.setLayerVisibility(LAYER_LINES_CASING, showAll ? "visible" : "none");
    this.setLayerVisibility(LAYER_LINES, showAll ? "visible" : "none");
    this.setLayerVisibility(LAYER_TARGET_LINE_CASING, "visible");
    this.setLayerVisibility(LAYER_TARGET_LINE, "visible");
    this.setLayerVisibility(LAYER_POINTS, showAll ? "visible" : "none");
    this.setLayerVisibility(LAYER_MASTERED_BADGE, showAll ? "visible" : "none");
    this.setLayerVisibility(LAYER_HIGHLIGHT_LABEL, showAll ? "visible" : "none");
    this.renderPointStatusMarkers();
    this.renderHighlightedMarkers();
  }

  setMapDetail(mapDetail: MapDetail): void {
    this.pendingMapDetail = mapDetail;
    if (!this.map) {
      return;
    }

    if (this.applyStyleIfNeeded()) {
      return;
    }

    if (!this.mapLoaded) {
      return;
    }

    this.applyBaseDetailVisibility();
    this.applyUsStateOverlayVisibility();
    this.renderHighlightedMarkers();
  }

  setLowDataMode(enabled: boolean): void {
    this.pendingLowDataMode = enabled;
    if (!this.map) {
      return;
    }

    this.applyStyleIfNeeded();
  }

  setEntityClickHandler(handler: (entityId: string) => void): void {
    this.entityClickHandler = handler;
  }

  setMasteryById(masteryById: Record<string, "not_learned" | "learning" | "mastered">): void {
    this.recentlyMasteredIds.clear();
    for (const [entityId, mastery] of Object.entries(masteryById)) {
      if (mastery === "mastered" && this.pendingMasteryById[entityId] !== "mastered") {
        this.recentlyMasteredIds.add(entityId);
      }
    }
    this.pendingMasteryById = masteryById;
    this.setEntities(this.pendingEntities);
    this.renderPointStatusMarkers();
  }

  setEntities(entities: Entity[]): void {
    this.pendingEntities = entities;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const polygonSource = this.map.getSource(SOURCE_POLYGONS) as maplibregl.GeoJSONSource | undefined;
    const lineSource = this.map.getSource(SOURCE_LINES) as maplibregl.GeoJSONSource | undefined;
    const pointSource = this.map.getSource(SOURCE_POINTS) as maplibregl.GeoJSONSource | undefined;
    if (!polygonSource || !lineSource || !pointSource) {
      return;
    }

    const polygonFeatures: Feature[] = [];
    const lineFeatures: Feature[] = [];
    const pointFeatures: Feature[] = [];

    for (const entity of entities) {
      if (entity.geometryType === "point") {
        const pointFeature = this.toPointFeature(entity);
        pointFeatures.push(pointFeature);
      }

      if (entity.geometryType === "polygon" && entity.geometry) {
        polygonFeatures.push(this.toGeometryFeature(entity));
      }
      if (entity.geometryType === "line" && entity.geometry) {
        lineFeatures.push(this.toGeometryFeature(entity));
      }
    }

    polygonSource.setData({ type: "FeatureCollection", features: polygonFeatures } as FeatureCollection);
    lineSource.setData({ type: "FeatureCollection", features: lineFeatures } as FeatureCollection);
    pointSource.setData({ type: "FeatureCollection", features: pointFeatures } as FeatureCollection);
    this.renderPointStatusMarkers();
    this.renderHighlightedMarkers();
  }

  setHighlightedEntity(entityId: string | null): void {
    this.pendingHighlightedEntityId = entityId;
    if (!this.map || !this.mapLoaded) {
      return;
    }
    this.applyHighlightFilter(entityId);
    this.updateTargetLineData(entityId);
    this.renderHighlightedMarkers();
  }

  focusEntity(entity: Entity): void {
    this.pendingFocusEntity = entity;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    if (entity.bbox) {
      const lonSpan = Math.abs(entity.bbox[2] - entity.bbox[0]);
      const latSpan = Math.abs(entity.bbox[3] - entity.bbox[1]);
      const span = Math.max(lonSpan, latSpan);
      const contextMaxZoom = span < 1 ? 4.4 : span < 3 ? 4.0 : 3.6;
      this.map.fitBounds(
        [
          [entity.bbox[0], entity.bbox[1]],
          [entity.bbox[2], entity.bbox[3]]
        ],
        { padding: 120, maxZoom: contextMaxZoom, duration: 500 }
      );
      return;
    }

    this.map.flyTo({ center: entity.labelPoint, zoom: 3.8, duration: 500 });
  }

  flyToPack(pack: Pack): void {
    this.pendingPack = pack;
    if (!this.map || !this.mapLoaded) {
      return;
    }

    this.applyPackBounds(pack);
    this.applyUsStateOverlayVisibility();
    this.map.flyTo({ center: pack.defaultViewport.center, zoom: pack.defaultViewport.zoom, duration: 600 });
  }

  private applyPendingState(): void {
    if (this.applyStyleIfNeeded()) {
      return;
    }

    this.syncUsaStateOverlaySource();
    this.setEntities(this.pendingEntities);
    this.setMode(this.pendingMode);
    this.applyBaseDetailVisibility();
    this.applyHighlightFilter(this.pendingHighlightedEntityId);
    this.updateTargetLineData(this.pendingHighlightedEntityId);
    this.renderHighlightedMarkers();

    if (this.pendingPack && this.map) {
      this.applyPackBounds(this.pendingPack);
      this.applyUsStateOverlayVisibility();
      if (!this.pendingCamera) {
        this.map.jumpTo({ center: this.pendingPack.defaultViewport.center, zoom: this.pendingPack.defaultViewport.zoom });
      }
    }

    if (this.pendingCamera && this.map) {
      this.map.jumpTo({
        center: this.pendingCamera.center,
        zoom: this.pendingCamera.zoom,
        bearing: this.pendingCamera.bearing,
        pitch: this.pendingCamera.pitch
      });
      this.pendingCamera = null;
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
    this.setLayerFilter(LAYER_HIGHLIGHT_POLYGON, idFilter as never);
    this.setLayerFilter(LAYER_HIGHLIGHT_POLYGON_OUTLINE, idFilter as never);
    this.setLayerFilter(LAYER_HIGHLIGHT_LINE, idFilter as never);
    this.setLayerFilter(LAYER_HIGHLIGHT_POINT, idFilter as never);
    this.setLayerFilter(LAYER_HIGHLIGHT_LABEL, idFilter as never);
  }

  private applyBaseDetailVisibility(): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const showLabels = this.pendingMapDetail === "reference_full";
    const styleLayers = this.map.getStyle().layers ?? [];
    for (const layer of styleLayers) {
      if (layer.id.startsWith("entities-")) {
        continue;
      }
      if (layer.type === "symbol") {
        this.map.setLayoutProperty(layer.id, "visibility", showLabels ? "visible" : "none");
      }
    }
  }

  private applyStyleIfNeeded(): boolean {
    if (!this.map) {
      return false;
    }

    const desiredStyleSignature = this.getStyleSignature(this.pendingMapDetail, this.pendingLowDataMode);
    if (desiredStyleSignature === this.currentStyleSignature) {
      return false;
    }

    this.pendingCamera = {
      center: [this.map.getCenter().lng, this.map.getCenter().lat],
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch()
    };
    const reloadToken = ++this.styleReloadToken;
    const recoverAfterStyleSwitch = (): void => {
      if (!this.map || reloadToken !== this.styleReloadToken) {
        return;
      }
      this.mapLoaded = true;
      this.applyBaseDetailVisibility();
      this.addEntityLayers(this.map);
      this.bindInteractionHandlers(this.map);
      this.applyPendingState();
    };
    this.currentStyleSignature = desiredStyleSignature;
    this.mapLoaded = false;
    this.map.setStyle(this.getStyleForDetail(this.pendingMapDetail, this.pendingLowDataMode));
    this.map.once("style.load", recoverAfterStyleSwitch);
    this.map.once("idle", recoverAfterStyleSwitch);
    window.setTimeout(recoverAfterStyleSwitch, 1200);
    return true;
  }

  private getStyleSignature(mapDetail: MapDetail, lowDataMode: boolean): string {
    if (mapDetail === "physical_basic") {
      return lowDataMode ? "physical_basic_low" : "physical_basic_full";
    }
    if (mapDetail === "physical_relief") {
      return lowDataMode ? "physical_relief_low" : "physical_relief_full";
    }
    return "political";
  }

  private getStyleForDetail(
    mapDetail: MapDetail,
    lowDataMode: boolean
  ): string | maplibregl.StyleSpecification {
    if (mapDetail === "physical_basic") {
      return getPhysicalBasicStyle(lowDataMode);
    }
    if (mapDetail === "physical_relief") {
      return getPhysicalReliefStyle(lowDataMode);
    }
    return getPoliticalStyleUrl();
  }

  private addEntityLayers(map: MapLibreMap): void {
    if (map.getLayer(LAYER_HIGHLIGHT_LABEL)) {
      return;
    }

    const emptyData: FeatureCollection = { type: "FeatureCollection", features: [] };

    if (!map.getSource(SOURCE_POLYGONS)) {
      map.addSource(SOURCE_POLYGONS, { type: "geojson", data: emptyData });
    }
    if (!map.getSource(SOURCE_LINES)) {
      map.addSource(SOURCE_LINES, { type: "geojson", data: emptyData });
    }
    if (!map.getSource(SOURCE_POINTS)) {
      map.addSource(SOURCE_POINTS, { type: "geojson", data: emptyData });
    }
    if (!map.getSource(SOURCE_TARGET_LINE)) {
      map.addSource(SOURCE_TARGET_LINE, { type: "geojson", data: emptyData });
    }
    if (!map.getSource(SOURCE_USA_STATE_BORDERS)) {
      map.addSource(SOURCE_USA_STATE_BORDERS, {
        type: "geojson",
        data: this.usaStatesGeoJson ?? emptyData
      });
    }
    void this.ensureUsaStateOverlayData();

    this.addLayerSafe({
      id: LAYER_POLYGONS,
      type: "fill",
      source: SOURCE_POLYGONS,
      paint: {
        "fill-color": [
          "match",
          ["get", "mastery"],
          "mastered", "#34d399",
          "learning", "#facc15",
          "not_learned", "#f87171",
          "#14b8a6"
        ],
        "fill-opacity": 0.33
      }
    });

    this.addLayerSafe({
      id: LAYER_POLYGON_OUTLINE,
      type: "line",
      source: SOURCE_POLYGONS,
      paint: { "line-color": "#0b5560", "line-width": 2.5 }
    });

    this.addLayerSafe({
      id: LAYER_POINTS,
      type: "circle",
      source: SOURCE_POINTS,
      paint: {
        "circle-color": [
          "match",
          ["get", "mastery"],
          "mastered", "#16a34a",
          "learning", "#d97706",
          "not_learned", "#dc2626",
          "#0f766e"
        ],
        "circle-radius": [
          "match",
          ["get", "mastery"],
          "mastered", 9,
          "learning", 7,
          5
        ],
        "circle-stroke-color": [
          "match",
          ["get", "mastery"],
          "mastered", "#14532d",
          "learning", "#7c2d12",
          "not_learned", "#7f1d1d",
          "#ffffff"
        ],
        "circle-stroke-width": 1.5
      }
    });

    if (this.canUseTextLayers()) {
      this.addLayerSafe({
        id: LAYER_MASTERED_BADGE,
        type: "symbol",
        source: SOURCE_POINTS,
        filter: ["==", "mastery", "mastered"],
        layout: {
          "text-field": "✓",
          "text-size": 12,
          "text-anchor": "center"
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#14532d",
          "text-halo-width": 1.2
        }
      });
    }

    this.addLayerSafe({
      id: LAYER_LINES_CASING,
      type: "line",
      source: SOURCE_LINES,
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.9,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 4,
          3, 6,
          5, 10
        ]
      }
    });

    this.addLayerSafe({
      id: LAYER_LINES,
      type: "line",
      source: SOURCE_LINES,
      paint: {
        "line-color": [
          "match",
          ["get", "mastery"],
          "mastered", "#16a34a",
          "learning", "#d97706",
          "not_learned", "#dc2626",
          "#0057ff"
        ],
        "line-opacity": 0.95,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 2.5,
          3, 4,
          5, 7
        ]
      }
    });

    this.addLayerSafe({
      id: LAYER_HIGHLIGHT_POLYGON,
      type: "fill",
      source: SOURCE_POLYGONS,
      filter: ["==", "id", ""],
      paint: { "fill-color": "#f59e0b", "fill-opacity": 0.56 }
    });

    this.addLayerSafe({
      id: LAYER_HIGHLIGHT_POLYGON_OUTLINE,
      type: "line",
      source: SOURCE_POLYGONS,
      filter: ["==", "id", ""],
      paint: { "line-color": "#7c2d12", "line-width": 4 }
    });

    this.addLayerSafe({
      id: LAYER_HIGHLIGHT_LINE,
      type: "line",
      source: SOURCE_LINES,
      filter: ["==", "id", ""],
      paint: {
        "line-color": "#ff7a00",
        "line-opacity": 1,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 6,
          3, 8,
          5, 12
        ]
      }
    });

    this.addLayerSafe({
      id: LAYER_TARGET_LINE_CASING,
      type: "line",
      source: SOURCE_TARGET_LINE,
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 1,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 14,
          3, 18,
          5, 24
        ]
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    });

    this.addLayerSafe({
      id: LAYER_TARGET_LINE,
      type: "line",
      source: SOURCE_TARGET_LINE,
      paint: {
        "line-color": "#ff7a00",
        "line-opacity": 1,
        "line-blur": 0,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1, 9,
          3, 12,
          5, 16
        ]
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    });

    this.addLayerSafe({
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

    if (this.canUseTextLayers()) {
      this.addLayerSafe({
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

    this.addLayerSafe({
      id: LAYER_USA_STATE_FILL,
      type: "fill",
      source: SOURCE_USA_STATE_BORDERS,
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": 0.06
      },
      layout: { visibility: "none" }
    });

    this.addLayerSafe({
      id: LAYER_USA_STATE_BORDERS,
      type: "line",
      source: SOURCE_USA_STATE_BORDERS,
      paint: {
        "line-color": "#f8fafc",
        "line-opacity": 1,
        "line-width": 1.8
      },
      layout: { visibility: "none" }
    });

    // Ensure target river highlight is drawn above all quiz overlays while debugging visibility.
    map.moveLayer(LAYER_TARGET_LINE_CASING);
    map.moveLayer(LAYER_TARGET_LINE);
  }

  private applyUsStateOverlayVisibility(): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }
    const isUsaStatesPack = this.pendingPack?.id === "usa_states";
    const isPhysical = this.pendingMapDetail === "physical_basic" || this.pendingMapDetail === "physical_relief";
    this.syncUsaStateOverlaySource();
    this.setLayerVisibility(LAYER_USA_STATE_FILL, isUsaStatesPack ? "visible" : "none");
    this.setLayerVisibility(LAYER_USA_STATE_BORDERS, isUsaStatesPack ? "visible" : "none");
    this.setLayerPaint(LAYER_USA_STATE_FILL, "fill-opacity", isPhysical ? 0.04 : 0.06);
    this.setLayerPaint(LAYER_USA_STATE_BORDERS, "line-color", isPhysical ? "#0f3d8f" : "#f8fafc");
    this.setLayerPaint(LAYER_USA_STATE_BORDERS, "line-width", isPhysical ? 2.2 : 1.8);
    this.setLayerPaint(LAYER_POLYGON_OUTLINE, "line-color", "#0b5560");
    this.setLayerPaint(LAYER_POLYGON_OUTLINE, "line-width", 2.5);
  }

  private ensureUsaStateOverlayData(): Promise<void> {
    if (this.usaStatesGeoJson) {
      this.syncUsaStateOverlaySource();
      return Promise.resolve();
    }
    if (this.usaStatesGeoJsonRequest) {
      return this.usaStatesGeoJsonRequest;
    }

    this.usaStatesGeoJsonRequest = fetch("./data/source/us-states.geojson", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load us-states overlay (${response.status})`);
        }
        const raw = (await response.json()) as FeatureCollection;
        const normalized = this.normalizeFeatureCollectionLongitudes(raw);
        this.usaStatesGeoJson = normalized;
        if (!this.map || !this.mapLoaded) {
          return;
        }
        const source = this.map.getSource(SOURCE_USA_STATE_BORDERS) as maplibregl.GeoJSONSource | undefined;
        source?.setData(this.usaStatesGeoJson);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.usaStatesGeoJsonRequest = null;
      });

    return this.usaStatesGeoJsonRequest;
  }

  private syncUsaStateOverlaySource(): void {
    if (!this.map || !this.mapLoaded || !this.usaStatesGeoJson) {
      return;
    }
    const source = this.map.getSource(SOURCE_USA_STATE_BORDERS) as maplibregl.GeoJSONSource | undefined;
    source?.setData(this.usaStatesGeoJson);
  }

  private canUseTextLayers(): boolean {
    return Boolean(this.map?.getStyle()?.glyphs);
  }

  private addLayerSafe(layer: { id: string } & Record<string, unknown>): void {
    if (!this.map || this.map.getLayer(layer.id)) {
      return;
    }
    try {
      this.map.addLayer(layer as never);
    } catch (error) {
      console.error(`Failed adding layer ${layer.id}`, error);
    }
  }

  private normalizeFeatureCollectionLongitudes(data: FeatureCollection): FeatureCollection {
    const wrapLongitude = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;
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
      ...data,
      features: (data.features ?? []).map((feature) => ({
        ...feature,
        geometry: feature.geometry
          ? {
              ...feature.geometry,
              coordinates: normalizeCoords((feature.geometry as { coordinates: unknown }).coordinates) as never
            }
          : feature.geometry
      }))
    };
  }

  private bindInteractionHandlers(map: MapLibreMap): void {
    map.off("click", this.handleMapClick);
    map.on("click", this.handleMapClick);
  }

  private setLayerVisibility(layerId: string, visibility: "visible" | "none"): void {
    if (!this.map?.getLayer(layerId)) {
      return;
    }
    this.map.setLayoutProperty(layerId, "visibility", visibility);
  }

  private setLayerPaint(layerId: string, property: string, value: unknown): void {
    if (!this.map?.getLayer(layerId)) {
      return;
    }
    this.map.setPaintProperty(layerId, property, value as never);
  }

  private setLayerFilter(layerId: string, filter: unknown): void {
    if (!this.map?.getLayer(layerId)) {
      return;
    }
    this.map.setFilter(layerId, filter as never);
  }

  private handleMapClick = (event: maplibregl.MapMouseEvent): void => {
    if (!this.entityClickHandler || !this.mapLoaded || !this.map || this.pendingMode !== "learn") {
      return;
    }

    const features = this.map.queryRenderedFeatures(event.point, {
      layers: [LAYER_HIGHLIGHT_POINT, LAYER_POINTS, LAYER_HIGHLIGHT_LINE, LAYER_LINES, LAYER_POLYGONS]
    });
    const first = features[0];
    const id = first?.properties?.id as string | undefined;
    if (!id) {
      return;
    }

    this.entityClickHandler(id);
  };

  private toPointFeature(entity: Entity): Feature {
    return {
      type: "Feature",
      id: entity.id,
      geometry: { type: "Point", coordinates: entity.labelPoint },
      properties: {
        id: entity.id,
        name: entity.name,
        geometryType: "point",
        mastery: this.pendingMasteryById[entity.id] ?? "not_learned"
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
        geometryType: entity.geometryType,
        mastery: this.pendingMasteryById[entity.id] ?? "not_learned"
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

  private renderPointStatusMarkers(): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    for (const marker of this.pointStatusMarkers) {
      marker.remove();
    }
    this.pointStatusMarkers = [];

    for (const entity of this.pendingEntities) {
      // Polygon entities are visible/clickable directly on the map; skip point dots to avoid visual clutter.
      if (entity.geometryType === "polygon") {
        continue;
      }
      const mastery = this.pendingMasteryById[entity.id] ?? "not_learned";
      const color = mastery === "mastered" ? "#16a34a" : mastery === "learning" ? "#d97706" : "#dc2626";
      const border = mastery === "mastered" ? "#14532d" : mastery === "learning" ? "#7c2d12" : "#7f1d1d";
      const size = mastery === "mastered" ? 18 : mastery === "learning" ? 14 : 11;

      const el = document.createElement("div");
      el.className = "status-marker";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = entity.geometryType === "line" ? "5px" : "999px";
      el.style.background = color;
      el.style.border = `2px solid ${border}`;
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.25)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "#fff";
      el.style.fontSize = "11px";
      el.style.fontWeight = "700";
      el.style.cursor = "pointer";
      if (mastery === "mastered") {
        el.classList.add("status-marker--mastered");
        el.textContent = "✓";
      } else if (entity.geometryType === "line") {
        el.textContent = "≈";
      }
      if (this.recentlyMasteredIds.has(entity.id)) {
        el.classList.add("status-marker--pulse");
      }
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        if (this.pendingMode === "learn" && this.entityClickHandler) {
          this.entityClickHandler(entity.id);
        }
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat(entity.labelPoint).addTo(this.map);
      this.pointStatusMarkers.push(marker);
    }
    this.recentlyMasteredIds.clear();
  }

  private renderHighlightedMarkers(): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    this.highlightedDotMarker?.remove();
    this.highlightedDotMarker = null;
    this.highlightedLabelMarker?.remove();
    this.highlightedLabelMarker = null;
    for (const marker of this.highlightedRiverMarkers) {
      marker.remove();
    }
    this.highlightedRiverMarkers = [];

    if (!this.pendingHighlightedEntityId) {
      return;
    }

    const target = this.pendingEntities.find((entity) => entity.id === this.pendingHighlightedEntityId);
    if (!target) {
      return;
    }

    if (target.geometryType === "point" || target.geometryType === "polygon") {
      const dot = document.createElement("div");
      dot.className = this.pendingMode === "quiz" ? "target-dot target-dot--quiz" : "target-dot target-dot--learn";
      dot.innerHTML = '<span class="target-dot-ping"></span><span class="target-dot-core"></span>';
      this.highlightedDotMarker = new maplibregl.Marker({ element: dot }).setLngLat(target.labelPoint).addTo(this.map);
    }
    if (target.geometryType === "line" && target.geometry?.type === "LineString") {
      const anchors = this.sampleLineAnchors(target.geometry.coordinates as [number, number][], 12);
      for (const anchor of anchors) {
        const markerRoot = document.createElement("div");
        markerRoot.style.width = "0";
        markerRoot.style.height = "0";

        const arrowWrap = document.createElement("div");
        arrowWrap.style.width = "0";
        arrowWrap.style.height = "0";
        arrowWrap.style.marginLeft = "-7px";
        arrowWrap.style.marginTop = "-7px";
        arrowWrap.style.transformOrigin = "center";
        arrowWrap.style.transform = `rotate(${anchor.angleDeg}deg)`;
        arrowWrap.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.25))";

        const back = document.createElement("div");
        back.style.position = "absolute";
        back.style.left = "0";
        back.style.top = "0";
        back.style.width = "0";
        back.style.height = "0";
        back.style.borderTop = "6px solid transparent";
        back.style.borderBottom = "6px solid transparent";
        back.style.borderLeft = "12px solid #ffffff";

        const front = document.createElement("div");
        front.style.position = "absolute";
        front.style.left = "1px";
        front.style.top = "1px";
        front.style.width = "0";
        front.style.height = "0";
        front.style.borderTop = "5px solid transparent";
        front.style.borderBottom = "5px solid transparent";
        front.style.borderLeft = "10px solid #ff7a00";

        arrowWrap.append(back, front);
        markerRoot.append(arrowWrap);

        const marker = new maplibregl.Marker({ element: markerRoot }).setLngLat(anchor.point).addTo(this.map);
        this.highlightedRiverMarkers.push(marker);
      }
    }
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
      this.highlightedLabelMarker = new maplibregl.Marker({ element: label, offset: [0, -48] })
        .setLngLat(target.labelPoint)
        .addTo(this.map);
    }
  }

  private updateTargetLineData(entityId: string | null): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    const targetLineSource = this.map.getSource(SOURCE_TARGET_LINE) as maplibregl.GeoJSONSource | undefined;
    if (!targetLineSource) {
      return;
    }

    const target = entityId
      ? this.pendingEntities.find((entity) => entity.id === entityId && entity.geometryType === "line" && entity.geometry)
      : null;

    if (!target) {
      targetLineSource.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    targetLineSource.setData({
      type: "FeatureCollection",
      features: [this.toGeometryFeature(target)]
    } as FeatureCollection);
  }

  private sampleLineAnchors(
    coords: [number, number][],
    maxPoints: number
  ): Array<{ point: [number, number]; angleDeg: number }> {
    if (coords.length <= 1) {
      return coords.map((point) => ({ point, angleDeg: 0 }));
    }

    const dense: Array<{ point: [number, number]; angleDeg: number }> = [];
    for (let i = 0; i < coords.length - 1; i += 1) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      for (let step = 0; step < 8; step += 1) {
        const t = step / 8;
        dense.push({
          point: [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t],
          angleDeg
        });
      }
    }
    dense.push({ point: coords[coords.length - 1], angleDeg: 0 });

    if (dense.length <= maxPoints) {
      return dense;
    }

    const sampled: Array<{ point: [number, number]; angleDeg: number }> = [];
    const stride = (dense.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i += 1) {
      sampled.push(dense[Math.round(i * stride)]);
    }
    return sampled;
  }

}
