export type Zone = 'B' | 'C';
export type Table = { id: string; zone: Zone; no: number };

const zone = (z: Zone, count: number): Table[] =>
  Array.from({ length: count }, (_, i) => ({ id: `${z}${i + 1}`, zone: z, no: i + 1 }));

/** 座位固定：B 區 20 桌、C 區 9 桌（規格 §1） */
export const TABLES: Table[] = [...zone('B', 20), ...zone('C', 9)];
