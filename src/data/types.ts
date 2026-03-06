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
  | "region";

export type GeometryType = "point" | "line" | "polygon";
export type Difficulty = "easy" | "medium" | "hard";
export type AgeBand = "6-8" | "9-12" | "13+";

export type Entity = {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  facts?: string[];
  didYouKnow?: string;
  hintTokens?: string[];
  difficulty?: Difficulty;
  ageBand?: AgeBand;
  pronunciation?: string;
  mnemonic?: string;
  tags?: string[];
  media?: {
    imageUrl?: string;
    credit?: string;
  };
  learningObjective?: string;
  geometryType: GeometryType;
  geometry?: Geometry;
  labelPoint: [number, number];
  bbox?: [number, number, number, number];
  packIds: string[];
};

export type Pack = {
  id: string;
  name: string;
  types: EntityType[];
  defaultViewport: {
    center: [number, number];
    zoom: number;
  };
};
