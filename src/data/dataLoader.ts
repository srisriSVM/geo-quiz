import type { Entity, Pack } from "./types";

export const loadEntities = async (): Promise<Entity[]> => {
  const response = await fetch("./data/entities.json");
  if (!response.ok) {
    throw new Error("Failed to load entities.json");
  }

  return (await response.json()) as Entity[];
};

export const loadPacks = async (): Promise<Pack[]> => {
  const response = await fetch("./data/packs.json");
  if (!response.ok) {
    throw new Error("Failed to load packs.json");
  }

  return (await response.json()) as Pack[];
};
