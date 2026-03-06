import type { Entity, Pack } from "./types";

export const loadPackEntities = async (packId: string): Promise<Entity[]> => {
  const response = await fetch(`./data/pack-entities/${packId}.entities.json`);
  if (!response.ok) {
    throw new Error(`Failed to load pack entities for ${packId}`);
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
