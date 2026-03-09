import type { Geometry } from "geojson";

export type EntityType =
  | "country"
  | "state"
  | "city"
  | "capital"
  | "river"
  | "sea"
  | "lake"
  | "mountain"
  | "region"
  | "desert"
  | "plateau"
  | "plain"
  | "canal"
  | "strait"
  | "island"
  | "peninsula"
  | "basin"
  | "park"
  | "biome"
  | "timezone";

export type GeometryType = "point" | "line" | "polygon";
export type Difficulty = "easy" | "medium" | "hard";
export type AgeBand = "6-8" | "9-12" | "13+";
export type FactCard = {
  title: string;
  value: string;
  icon?: string;
};

export type MediaItem = {
  imageUrl: string;
  sourceUrl?: string;
  alt?: string;
  credit?: string;
};

export type AdminRef = {
  id: string;
  name: string;
  type: "country" | "state" | "province";
};

export type PackEntityMeta = {
  rank?: number;
  metricValue?: number;
  metricUnit?: string;
  metricLabel?: string;
  asOf?: string;
  source?: string;
};

export type Entity = {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  facts?: string[];
  factCards?: FactCard[];
  didYouKnow?: string;
  hintTokens?: string[];
  difficulty?: Difficulty;
  ageBand?: AgeBand;
  pronunciation?: string;
  mnemonic?: string;
  tags?: string[];
  media?: MediaItem & {
    images?: MediaItem[];
  };
  adminOf?: AdminRef;
  capitalIds?: string[];
  learningObjective?: string;
  geometryType: GeometryType;
  geometry?: Geometry;
  labelPoint: [number, number];
  bbox?: [number, number, number, number];
  packIds: string[];
  packMeta?: PackEntityMeta;
};

export type Pack = {
  id: string;
  name: string;
  group?: string;
  types: EntityType[];
  defaultViewport: {
    center: [number, number];
    zoom: number;
  };
};
