// Hardcoded floor plan for v1 of the host visualization.
// Coordinates are in percent of the floor-plan container (0-100).
// (x, y) is the centre of the table. Width/height auto-scale by capacity.

export type FloorSectionId = "indoor" | "outdoor";

export type FloorTable = {
  id: string;
  label: string;
  section: FloorSectionId;
  seats: 2 | 4 | 8;
  x: number;
  y: number;
};

export type FloorSection = {
  id: FloorSectionId;
  label: string;
};

export const FLOOR_SECTIONS: FloorSection[] = [
  { id: "indoor", label: "Indoor" },
  { id: "outdoor", label: "Outdoor" },
];

export const FLOOR_TABLES: FloorTable[] = [
  // Indoor — 4 two-tops, 4 four-tops, 2 eight-tops
  { id: "I-1", label: "I-1", section: "indoor", seats: 2, x: 10, y: 18 },
  { id: "I-2", label: "I-2", section: "indoor", seats: 2, x: 10, y: 40 },
  { id: "I-3", label: "I-3", section: "indoor", seats: 2, x: 10, y: 62 },
  { id: "I-4", label: "I-4", section: "indoor", seats: 2, x: 10, y: 84 },
  { id: "I-5", label: "I-5", section: "indoor", seats: 4, x: 36, y: 24 },
  { id: "I-6", label: "I-6", section: "indoor", seats: 4, x: 36, y: 60 },
  { id: "I-7", label: "I-7", section: "indoor", seats: 4, x: 60, y: 24 },
  { id: "I-8", label: "I-8", section: "indoor", seats: 4, x: 60, y: 60 },
  { id: "I-9", label: "I-9", section: "indoor", seats: 8, x: 86, y: 28 },
  { id: "I-10", label: "I-10", section: "indoor", seats: 8, x: 86, y: 72 },

  // Outdoor — 3 two-tops, 2 four-tops, 1 eight-top
  { id: "O-1", label: "O-1", section: "outdoor", seats: 2, x: 18, y: 22 },
  { id: "O-2", label: "O-2", section: "outdoor", seats: 2, x: 50, y: 22 },
  { id: "O-3", label: "O-3", section: "outdoor", seats: 2, x: 82, y: 22 },
  { id: "O-4", label: "O-4", section: "outdoor", seats: 4, x: 28, y: 58 },
  { id: "O-5", label: "O-5", section: "outdoor", seats: 4, x: 72, y: 58 },
  // Keep centre + half height ≤ ~95% so the 8-top is not clipped (container uses overflow-hidden).
  { id: "O-6", label: "O-6", section: "outdoor", seats: 8, x: 50, y: 78 },
];

export function findFloorTable(id: string): FloorTable | undefined {
  return FLOOR_TABLES.find((t) => t.id === id);
}

// Visual sizing helpers — width × height in % of container.
// Tuned so eight-tops feel meaningfully bigger than two-tops.
export function tableSize(seats: FloorTable["seats"]): { w: number; h: number } {
  switch (seats) {
    case 2:
      return { w: 9, h: 12 };
    case 4:
      return { w: 13, h: 17 };
    case 8:
      return { w: 14, h: 30 };
  }
}
