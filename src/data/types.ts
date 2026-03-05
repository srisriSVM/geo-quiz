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

export type Entity = {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
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
