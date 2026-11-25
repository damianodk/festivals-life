import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IconPhoto,
  IconListDetails,
  IconReceipt,
  IconExternalLink,
  IconTrash,
  IconEdit,
  IconPlus,
  IconAlertTriangle
} from "@tabler/icons-react";
import type { ClashSlot, Concert, EventMeta, TripExpense, UserSettings } from "../types";
import { getCityCoords, haversineKm, setlistSearchUrl, topEntry } from "../lib/geo";
import { supabase } from "../lib/supabase";
import { BottomSheet } from "./ui/BottomSheet";
import {
  ConcertKind,
  detectConcertKind,
  loadTypeOverrides,
  saveConcertKindLocal,
} from "./StartView";

interface EventsViewProps {
  allConcerts: Concert[];
  filteredConcerts: Concert[];
  eventsMeta: Record<string, EventMeta>;
  tripExpenses: TripExpense[];
  clashSlots: ClashSlot[];
  settings: UserSettings;
  cityCoords: Record<string, [number, number]>;
  isPublicView: boolean;
  onQuickAddFromLineup: (eventKey: string, artist: string) => void;
  onUploadEventPhotos: (eventKey: string, files: File[]) => Promise<void>;
  onUploadEventPoster: (eventKey: string, file: File) => Promise<void>;
  onRemovePoster: (eventKey: string) => Promise<void>;
  onRemovePhoto: (eventKey: string, idx: number) => Promise<void>;
  onSaveLineup: (eventKey: string, lineup: string[]) => Promise<void>;
  onOpenSplitwise: (eventKey: string) => void;
  onEditConcert: (c: Concert) => void;
  onDeleteConcert: (id: number) => Promise<void>;
  onFilterByCrew: (crew: string) => void;
  onAddClashSlot: (slot: ClashSlot) => void;
  onDeleteClashSlot: (idx: number) => void;
}

function timeToMins(t: string): number | null {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

export const EventsView: React.FC<EventsViewProps> = ({
  allConcerts,
  filteredConcerts,
  eventsMeta,
  tripExpenses,
  clashSlots,
  settings,
  cityCoords,
  isPublicView,
  onQuickAddFromLineup,
  onUploadEventPhotos,
  onUploadEventPoster,
  onRemovePoster,
  onRemovePhoto,
  onSaveLineup,
  onOpenSplitwise,
  onEditConcert,
  onDeleteConcert,
  onFilterByCrew,
  onAddClashSlot,
  onDeleteClashSlot
}) => {
  const [subTab, setSubTab] = useState<"cards" | "concerts" | "crew" | "clash">("cards");
  const [expandedLineups, setExpandedLineups] = useState<Set<string>>(new Set());
  const [selectedEventKey, setSelectedEventKey] = useState<string>("");
  const [highlightedEventKey, setHighlightedEventKey] = useState<string>("");
  const [lineupEditKey, setLineupEditKey] = useState<string | null>(null);
  const [lineupText, setLineupText] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, ConcertKind>>(() =>
    loadTypeOverrides()
  );

  const [cfArtist, setCfArtist] = useState("");
  const [cfStage, setCfStage] = useState("");
  const [cfStart, setCfStart] = useState("");
  const [cfEnd, setCfEnd] = useState("");

  const activeUploadKeyRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const posterInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncTypes = () => setTypeOverrides(loadTypeOverrides());
    window.addEventListener("festlife:concert-updated", syncTypes);

    // Obsługa przejścia z karty artysty bezpośrednio do konkretnego wydarzenia
    const pendingKey = sessionStorage.getItem("festlife_focus_event");
    if (pendingKey) {
      sessionStorage.removeItem("festlife_focus_event");
      setSubTab("cards");
      setHighlightedEventKey(pendingKey);
    }

    const handleOpenEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (detail) {
        setSubTab("cards");
        setHighlightedEventKey(detail);
      }
    };
    window.addEventListener("festlife:open-event", handleOpenEvent);

    return () => {
      window.removeEventListener("festlife:concert-updated", syncTypes);
      window.removeEventListener("festlife:open-event", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!highlightedEventKey) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-event-key="${CSS.escape(highlightedEventKey)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [highlightedEventKey, subTab]);

  const handleToggleRowKind = async (c: Concert, nextKind: ConcertKind) => {
    const nextMap = saveConcertKindLocal(c, nextKind);
    setTypeOverrides(nextMap);
    if (c.id) {
      await supabase.from("concerts").update({ typ: nextKind } as any).eq("id", c.id);
    }
  };

  const eventGroups = useMemo(() => {
    const map: Record<
      string,
      {
        key: string; rok: number; data: string; event: string; miasto: string;
        kraj: string; miejsce: string; crews: Set<string>; artists: string[]; sample: Concert;
      }
    > = {};
    filteredConcerts.forEach((c) => {
      const key = `${c.event || "Koncert"}|${c.rok || "?"}`;
      if (!map[key]) {
        map[key] = {
          key, rok: c.rok || 0, data: c.data || "", event: c.event || "Koncert",
          miasto: c.miasto, kraj: c.kraj, miejsce: c.miejsce, crews: new Set(), artists: [], sample: c
        };
      }
      if (c.z_kim) map[key].crews.add(c.z_kim);
      map[key].artists.push(c.artysta);
    });
    return Object.values(map).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [filteredConcerts]);

  const crewProfiles = useMemo(() => {
    const home = settings.hometown_coords || [52.4064, 16.9252];
    const crews: Record<
      string,
      { name: string; count: number; events: Set<string>; genres: Record<string, number>; trips: Set<string>; km: number }
    > = {};
    allConcerts.forEach((c) => {
      const name = (c.z_kim || "").trim();
      if (!name) return;
      if (!crews[name]) crews[name] = { name, count: 0, events: new Set(), genres: {}, trips: new Set(), km: 0 };
      crews[name].count++;
      crews[name].events.add(`${c.event || "Koncert"}|${c.rok || "?"}`);
      if (c.gatunek) crews[name].genres[c.gatunek] = (crews[name].genres[c.gatunek] || 0) + 1;
      const coords = getCityCoords(c.miasto, cityCoords);
      const tk = `${c.rok}|${c.event}|${c.miasto}`;
      if (coords && !crews[name].trips.has(tk)) {
        crews[name].trips.add(tk);
        const d = haversineKm(home[0], home[1], coords[0], coords[1]);
        if (d > 15) crews[name].km += Math.round(d * 2);
      }
    });
    return Object.values(crews).sort((a, b) => b.count - a.count);
  }, [allConcerts, settings.hometown_coords, cityCoords]);

  const clashAnalysis = useMemo(() => {
    const items = clashSlots.map((s, idx) => ({ ...s, idx, sMin: timeToMins(s.start), eMin: timeToMins(s.end) }));
    const conflicts = new Set<number>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (
          items[i].sMin != null && items[i].eMin != null &&
          items[j].sMin != null && items[j].eMin != null &&
          Math.max(items[i].sMin!, items[j].sMin!) < Math.min(items[i].eMin!, items[j].eMin!)
        ) {
          conflicts.add(i);
          conflicts.add(j);
        }
      }
    }
    return { items, conflicts };
  }, [clashSlots]);

  const toggleExpand = (k: string) => {
    setExpandedLineups((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  return (
    <div className="space-y-4">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length && activeUploadKeyRef.current) {
            await onUploadEventPhotos(activeUploadKeyRef.current, files);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={posterInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f && activeUploadKeyRef.current) {
            await onUploadEventPoster(activeUploadKeyRef.current, f);
          }
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setSubTab("cards")} className={`fl-btn !text-xs ${subTab === "cards" ? "fl-btn-primary" : ""}`}>
          Karty Eventów ({eventGroups.length})
        </button>
        {!isPublicView && (
          <>
            <button type="button" onClick={() => setSubTab("concerts")} className={`fl-btn !text-xs ${subTab === "concerts" ? "fl-btn-primary" : ""}`}>
              Baza koncertów eventu
            </button>
            <button type="button" onClick={() => setSubTab("crew")} className={`fl-btn !text-xs ${subTab === "crew" ? "fl-btn-primary" : ""}`}>
              Baza Ekipy ({crewProfiles.length})
            </button>
            <button type="button" onClick={() => setSubTab("clash")} className={`fl-btn !text-xs ${subTab === "clash" ? "fl-btn-primary" : ""}`}>
              Clashfinder
            </button>
          </>
        )}
      </div>

      {subTab === "cards" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eventGroups.map((g) => {
            const meta = eventsMeta[g.key] || { poster: "", photos: [], lineup: [] };
            const seenLower = new Set(g.artists.map((a) => a.toLowerCase()));
            const fullL = meta.lineup || [];
            const unseen = fullL.filter((a) => !seenLower.has(a.toLowerCase()));
            const isExp = expandedLineups.has(g.key);
            const expSum = tripExpenses
              .filter((x) => x.event_key === g.key)
              .reduce((s, x) => s + Number(x.amount_pln || 0), 0);
            const isHighlighted = highlightedEventKey === g.key;

            return (
              <div
                key={g.key}
                data-event-key={g.key}
                className={`flex flex-col justify-between gap-3 rounded-2xl border bg-[var(--surface)] p-4 ${
                  isHighlighted
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/40"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-extrabold leading-tight">{g.event}</h3>
                    <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent)]">
                      {g.rok}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {g.miejsce || "—"} • {g.miasto || "—"}, {g.kraj}
                    {g.crews.size > 0 && !isPublicView && (
                      <div className="mt-1">
                        Ekipa: <strong className="text-[var(--text)]">{[...g.crews].join(", ")}</strong>
                      </div>
                    )}
                  </div>

                  {meta.poster && (
                    <div
                      onClick={() => setLightbox({ url: meta.poster!, title: `Plakat: ${g.event}` })}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2"
                    >
                      <img src={meta.poster} alt={g.event} className="h-14 w-10 rounded-lg object-cover" />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold">Plakat z line-upem</div>
                        <div className="text-[11px] text-[var(--text-muted)]">Kliknij, aby powiększyć</div>
                      </div>
                      {!isPublicView && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemovePoster(g.key); }}
                          className="fl-btn fl-btn-danger !p-1"
                        >
                          <IconTrash size={13} stroke={1.75} />
                        </button>
                      )}
                    </div>
                  )}

                  {meta.photos && meta.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {meta.photos.map((ph, idx) => (
                        <div key={idx} className="relative flex-shrink-0">
                          <img
                            src={ph.url}
                            alt=""
                            onClick={() => setLightbox({ url: ph.url, title: `${g.event} • Zdjęcie ${idx + 1}` })}
                            className="h-16 w-16 cursor-pointer rounded-xl object-cover border border-[var(--border)]"
                          />
                          {!isPublicView && (
                            <button
                              type="button"
                              onClick={() => onRemovePhoto(g.key, idx)}
                              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] text-white"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-[var(--text-muted)]">
                      <span>
                        Widziani: <strong className="text-[var(--text)]">{g.artists.length}</strong>
                        {fullL.length > 0 ? ` / ${fullL.length}` : ""}
                      </span>
                      {unseen.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(g.key)}
                          className="font-semibold text-[var(--accent)] hover:underline"
                        >
                          {isExp ? "Zwiń" : `Line-up (+${unseen.length})`}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.artists.map((a, i) => (
                        <span
                          key={`${a}-${i}`}
                          className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] font-semibold"
                        >
                          {a}
                        </span>
                      ))}
                      {isExp &&
                        unseen.map((a) => (
                          <button
                            key={a}
                            type="button"
                            disabled={isPublicView}
                            onClick={() => !isPublicView && onQuickAddFromLineup(g.key, a)}
                            className="rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:border-solid hover:text-[var(--text)]"
                          >
                            + {a}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
                  <a
                    href={setlistSearchUrl(g.sample)}
                    target="_blank"
                    rel="noreferrer"
                    className="fl-btn !px-2.5 !py-1 !text-[11px]"
                  >
                    Setlist.fm <IconExternalLink size={12} stroke={1.75} />
                  </a>
                  {!isPublicView && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setSelectedEventKey(g.key); setSubTab("concerts"); }}
                        className="fl-btn !px-2.5 !py-1 !text-[11px]"
                      >
                        Lista ({g.artists.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { activeUploadKeyRef.current = g.key; photoInputRef.current?.click(); }}
                        className="fl-btn !px-2.5 !py-1 !text-[11px]"
                      >
                        <IconPhoto size={12} stroke={1.75} /> Zdjęcia
                      </button>
                      <button
                        type="button"
                        onClick={() => { activeUploadKeyRef.current = g.key; posterInputRef.current?.click(); }}
                        className="fl-btn !px-2.5 !py-1 !text-[11px]"
                      >
                        Plakat
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLineupEditKey(g.key); setLineupText((meta.lineup || []).join("\n")); }}
                        className="fl-btn !px-2.5 !py-1 !text-[11px]"
                      >
                        <IconListDetails size={12} stroke={1.75} /> Line-up
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenSplitwise(g.key)}
                        className="fl-btn !px-2.5 !py-1 !text-[11px]"
                      >
                        <IconReceipt size={12} stroke={1.75} /> Rozliczenie{expSum > 0 ? ` (${expSum} zł)` : ""}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === "concerts" && !isPublicView && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <select
            className="fl-input w-full sm:max-w-md"
            value={selectedEventKey}
            onChange={(e) => setSelectedEventKey(e.target.value)}
          >
            <option value="">Wszystkie eventy ({eventGroups.length})</option>
            {eventGroups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.event} ({g.rok})
              </option>
            ))}
          </select>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left font-mono text-[10px] uppercase text-[var(--text-muted)]">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Artysta</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Rodzaj</th>
                  <th className="px-3 py-2">Scena / Miejsce</th>
                  <th className="px-3 py-2">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredConcerts
                  .filter((c) => !selectedEventKey || `${c.event || "Koncert"}|${c.rok || "?"}` === selectedEventKey)
                  .map((c) => {
                    const kind = detectConcertKind(c, typeOverrides);
                    return (
                      <tr key={c.id} className="border-b border-[var(--border)]">
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{c.data} {c.godzina}</td>
                        <td className="px-3 py-2 font-semibold">{c.artysta}</td>
                        <td className="px-3 py-2">{c.event} ({c.rok})</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleToggleRowKind(c, "solowy")}
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                kind === "solowy"
                                  ? "bg-[var(--accent)] text-[var(--accent-ink,#fff)]"
                                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
                              }`}
                            >
                              Solowy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleRowKind(c, "festiwal")}
                              className={`rounded px-1.5 py-0.5 font-semibold ${
                                kind === "festiwal"
                                  ? "bg-[#38bdf8] text-slate-950"
                                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
                              }`}
                            >
                              Festiwal
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{c.scena ? `${c.scena} • ` : ""}{c.miejsce}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => onEditConcert(c)} className="fl-btn !p-1.5">
                              <IconEdit size={13} stroke={1.75} />
                            </button>
                            <button type="button" onClick={() => onDeleteConcert(c.id)} className="fl-btn fl-btn-danger !p-1.5">
                              <IconTrash size={13} stroke={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "crew" && !isPublicView && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {crewProfiles.map((cr) => {
            const favGenre = topEntry(cr.genres)[0];
            const expSum = tripExpenses
              .filter((ex) => cr.events.has(ex.event_key))
              .reduce((s, x) => s + Number(x.amount_pln || 0), 0);
            return (
              <div key={cr.name} className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-base font-extrabold">{cr.name}</h4>
                    <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent)]">
                      {cr.count} konc.
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                    <div>
                      Eventy razem: <strong className="text-[var(--text)]">{cr.events.size}</strong> • Wspólne km:{" "}
                      <strong className="text-[var(--text)]">{cr.km.toLocaleString("pl-PL")} km</strong>
                    </div>
                    <div>
                      Ulubiony gatunek: <strong className="text-[var(--text)]">{favGenre}</strong>
                    </div>
                    {expSum > 0 && (
                      <div>
                        Splitwise razem: <strong className="text-[var(--text)]">{expSum.toFixed(2)} PLN</strong>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onFilterByCrew(cr.name)}
                  className="fl-btn fl-btn-primary w-full !text-xs"
                >
                  Pokaż wspólne koncerty
                </button>
              </div>
            );
          })}
        </div>
      )}

      {subTab === "clash" && !isPublicView && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Dodawaj godziny występów — nakładające się sloty zostaną automatycznie oznaczone jako konflikt.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!cfArtist.trim() || !cfStart.trim() || !cfEnd.trim()) return;
              onAddClashSlot({ artist: cfArtist.trim(), stage: cfStage.trim(), start: cfStart.trim(), end: cfEnd.trim() });
              setCfArtist("");
              setCfStage("");
            }}
            className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <input required className="fl-input col-span-2 sm:col-span-1" value={cfArtist} onChange={(e) => setCfArtist(e.target.value)} placeholder="Artysta" />
            <input className="fl-input" value={cfStage} onChange={(e) => setCfStage(e.target.value)} placeholder="Scena" />
            <input required className="fl-input" value={cfStart} onChange={(e) => setCfStart(e.target.value)} placeholder="Start (21:00)" />
            <input required className="fl-input" value={cfEnd} onChange={(e) => setCfEnd(e.target.value)} placeholder="Koniec (22:15)" />
            <button type="submit" className="fl-btn fl-btn-primary col-span-2 sm:col-span-1">
              <IconPlus size={15} stroke={1.75} /> Dodaj
            </button>
          </form>

          <div className="space-y-2">
            {clashAnalysis.items.map((it) => {
              const isClash = clashAnalysis.conflicts.has(it.idx);
              return (
                <div
                  key={it.idx}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
                    isClash
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-[var(--border)] bg-[var(--surface-2)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{it.artist}</span>
                      {isClash && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-400">
                          <IconAlertTriangle size={11} /> KONFLIKT
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">
                      {it.start} – {it.end} • {it.stage || "Scena"}
                    </div>
                  </div>
                  <button type="button" onClick={() => onDeleteClashSlot(it.idx)} className="fl-btn fl-btn-danger !p-1.5">
                    <IconTrash size={14} stroke={1.75} />
                  </button>
                </div>
              );
            })}
            {clashAnalysis.items.length === 0 && (
              <div className="py-4 text-center text-xs text-[var(--text-muted)]">Brak dodanych występów.</div>
            )}
          </div>
        </div>
      )}

      {/* Line-up Editor Bottom Sheet */}
      <BottomSheet
        open={!!lineupEditKey}
        onOpenChange={(o) => !o && setLineupEditKey(null)}
        title="Edytuj Line-up"
        description="Wpisz artystów — jeden w linii lub po przecinku"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3">
          <textarea
            rows={10}
            className="fl-input w-full font-mono text-xs"
            value={lineupText}
            onChange={(e) => setLineupText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLineupEditKey(null)} className="fl-btn">
              Anuluj
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!lineupEditKey) return;
                const list = [...new Set(lineupText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))];
                await onSaveLineup(lineupEditKey, list);
                setExpandedLineups((prev) => new Set(prev).add(lineupEditKey));
                setLineupEditKey(null);
              }}
              className="fl-btn fl-btn-primary"
            >
              Zapisz line-up
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Photo / Poster Lightbox Sheet */}
      <BottomSheet
        open={!!lightbox}
        onOpenChange={(o) => !o && setLightbox(null)}
        title={lightbox?.title || "Podgląd"}
        maxWidthClass="max-w-3xl"
      >
        {lightbox && (
          <img
            src={lightbox.url}
            alt={lightbox.title}
            className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain"
          />
        )}
      </BottomSheet>
    </div>
  );
};
