"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FLOOR_SECTIONS,
  FLOOR_TABLES,
  tableSize,
  type FloorSectionId,
  type FloorTable,
} from "@/lib/floor-plan";

export type FloorTableState =
  | { kind: "free" }
  | { kind: "occupied"; entryId: string; name: string; partySize: number; needsCleanup: boolean };

export type FloorPlanProps = {
  tableState: Record<string, FloorTableState>;
  selectedTableId: string | null;
  pendingCalledParty: { partySize: number } | null;
  busyTableId: string | null;
  onTableClick: (table: FloorTable, state: FloorTableState) => void;
};

export function FloorPlan({
  tableState,
  selectedTableId,
  pendingCalledParty,
  busyTableId,
  onTableClick,
}: FloorPlanProps) {
  const [section, setSection] = useState<FloorSectionId>("indoor");
  const sectionTables = useMemo(
    () => FLOOR_TABLES.filter((t) => t.section === section),
    [section],
  );

  const stats = useMemo(() => {
    const all = FLOOR_TABLES.filter((t) => t.section === section);
    let free = 0;
    let occupied = 0;
    let cleanup = 0;
    for (const t of all) {
      const s = tableState[t.id] ?? { kind: "free" };
      if (s.kind === "free") free += 1;
      else {
        occupied += 1;
        if (s.needsCleanup) cleanup += 1;
      }
    }
    return { total: all.length, free, occupied, cleanup };
  }, [section, tableState]);

  return (
    <div className="space-y-3">
      {/* Tabs + stats */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {FLOOR_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition",
                section === s.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{stats.free}</span> kosong
          </span>
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{stats.occupied}</span> terisi
          </span>
          {stats.cleanup > 0 && (
            <span className="tabular-nums text-amber-700">
              <span className="font-medium">{stats.cleanup}</span> siap dibersihkan
            </span>
          )}
          <span className="tabular-nums text-muted-foreground/80">
            ({stats.total} meja)
          </span>
        </div>
      </div>

      {/* Floor plan canvas */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-border",
          "bg-[radial-gradient(circle_at_1px_1px,_theme(colors.border)_1px,_transparent_0)]",
          "[background-size:16px_16px] bg-muted/30",
          // Taller than 16:9 so 8-tops near the bottom (y + half height) stay inside the clip.
          "aspect-[4/3] min-h-[260px] sm:min-h-[340px] md:min-h-[400px]",
        )}
      >
        {sectionTables.map((table) => {
          const state = tableState[table.id] ?? { kind: "free" };
          const size = tableSize(table.seats);
          const isOccupied = state.kind === "occupied";
          const needsCleanup = isOccupied && state.needsCleanup;
          const isSelected = selectedTableId === table.id;
          const isBusy = busyTableId === table.id;
          const canSeatHere =
            !isOccupied && pendingCalledParty !== null;
          const partyTooBig =
            canSeatHere && pendingCalledParty.partySize > table.seats;

          return (
            <button
              key={table.id}
              type="button"
              disabled={isBusy}
              onClick={() => onTableClick(table, state)}
              title={
                isOccupied
                  ? `${table.label} · ${state.name} (${state.partySize} org)${needsCleanup ? " · siap dibersihkan" : ""}`
                  : `${table.label} · ${table.seats} kursi${partyTooBig ? " · kapasitas kurang dari rombongan" : ""}`
              }
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2",
                "flex flex-col items-center justify-center gap-0.5",
                "border-2 text-xs font-semibold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                table.seats === 2 ? "rounded-full" : "rounded-lg",
                // base palette
                !isOccupied &&
                  "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100",
                isOccupied && !needsCleanup &&
                  "bg-slate-200 border-slate-400 text-slate-900",
                needsCleanup &&
                  "bg-amber-100 border-amber-400 text-amber-900",
                // overrides for selected / hint
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                canSeatHere && !partyTooBig &&
                  "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background animate-pulse",
                canSeatHere && partyTooBig &&
                  "opacity-60",
                isBusy && "opacity-60 cursor-wait",
              )}
              style={{
                left: `${table.x}%`,
                top: `${table.y}%`,
                width: `${size.w}%`,
                height: `${size.h}%`,
              }}
            >
              <span className="leading-tight">{table.label}</span>
              <span className="flex items-center gap-0.5 text-[10px] opacity-80 leading-none">
                <Users className="h-3 w-3" />
                {table.seats}
              </span>
              {isOccupied && (
                <span className="px-1 max-w-full truncate text-[10px] font-medium leading-tight">
                  {state.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendDot className="bg-emerald-100 border-emerald-300" label="Kosong" />
        <LegendDot className="bg-slate-200 border-slate-400" label="Terisi" />
        <LegendDot className="bg-amber-100 border-amber-400" label="Siap dibersihkan (sudah bayar)" />
        {pendingCalledParty && (
          <span className="text-emerald-700 font-medium">
            Klik meja kosong untuk dudukkan tamu yang dipanggil.
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-3 rounded-sm border", className)} />
      {label}
    </span>
  );
}
