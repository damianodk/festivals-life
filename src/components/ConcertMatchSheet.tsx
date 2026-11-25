import React from "react";
import type { Concert } from "../types";
import { BottomSheet } from "./ui/BottomSheet";

export interface MatchData {
  nameA: string;
  listA: Partial<Concert>[];
  nameB: string;
  listB: Partial<Concert>[];
}

interface ConcertMatchSheetProps {
  data: MatchData | null;
  onClose: () => void;
}

export const ConcertMatchSheet: React.FC<ConcertMatchSheetProps> = ({ data, onClose }) => {
  if (!data) return null;
  const norm = (s?: string | null) => String(s || "").trim().toLowerCase();
  const artA = new Map<string, string>();
  const artB = new Map<string, string>();
  data.listA.forEach((c) => { if (c.artysta) artA.set(norm(c.artysta), c.artysta.trim()); });
  data.listB.forEach((c) => { if (c.artysta) artB.set(norm(c.artysta), c.artysta.trim()); });

  const sharedArtists = [...artA.keys()].filter((k) => artB.has(k)).map((k) => artA.get(k)!).sort();
  const denom = Math.min(artA.size || 1, artB.size || 1);
  const score = Math.min(100, Math.round((sharedArtists.length / denom) * 100));

  const evA = new Set(data.listA.map((c) => `${norm(c.event)}|${c.rok || ""}`));
  const sharedEvents = [
    ...new Set(
      data.listB
        .filter((c) => evA.has(`${norm(c.event)}|${c.rok || ""}`))
        .map((c) => `${c.event} (${c.rok})`)
    )
  ].sort();

  return (
    <BottomSheet
      open={!!data}
      onOpenChange={(o) => !o && onClose()}
      title={`Concert Match: ${data.nameA} × ${data.nameB}`}
      description="Porównanie wspólnych artystów i festiwali 1v1"
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-24 w-24 place-items-center rounded-full bg-[var(--accent)] font-display text-3xl font-extrabold text-[var(--accent-ink)]">
            {score}%
          </div>
          <p className="mt-2.5 text-xs text-[var(--text-muted)]">
            Wspólni artyści: <strong className="text-[var(--text)]">{sharedArtists.length}</strong> • Wspólne eventy:{" "}
            <strong className="text-[var(--text)]">{sharedEvents.length}</strong>
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-center">
          <div>
            <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">{data.nameA}</div>
            <div className="font-display text-2xl font-extrabold tabular-nums">{data.listA.length}</div>
            <div className="text-[11px] text-[var(--text-muted)]">koncertów</div>
          </div>
          <div className="font-mono text-xs font-bold text-[var(--accent)]">VS</div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">{data.nameB}</div>
            <div className="font-display text-2xl font-extrabold tabular-nums">{data.listB.length}</div>
            <div className="text-[11px] text-[var(--text-muted)]">koncertów</div>
          </div>
        </div>

        <div>
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            Wspólni Artyści ({sharedArtists.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sharedArtists.length ? (
              sharedArtists.slice(0, 35).map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold"
                >
                  {a}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Brak wspólnych artystów</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            Wspólne Eventy ({sharedEvents.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sharedEvents.length ? (
              sharedEvents.slice(0, 20).map((e) => (
                <span
                  key={e}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs"
                >
                  {e}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Brak wspólnych festiwali</span>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};
