import React, { useEffect } from "react";
import { Command } from "cmdk";
import {
  IconMusic,
  IconMapPin,
  IconTicket,
  IconPlus,
  IconSparkles,
  IconPalette,
  IconRefresh,
  IconX
} from "@tabler/icons-react";
import type { Concert, MainTab, ThemeId } from "../types";
import { THEME_PROFILES } from "../lib/themes";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concerts: Concert[];
  isPublicView: boolean;
  onSelectSearch: (query: string) => void;
  onNavigate: (tab: MainTab) => void;
  onOpenWrapped: () => void;
  onResetFilters: () => void;
  onSetTheme: (theme: ThemeId) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  concerts,
  isPublicView,
  onSelectSearch,
  onNavigate,
  onOpenWrapped,
  onResetFilters,
  onSetTheme
}) => {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  if (!open) return null;

  const artists = [...new Set(concerts.map((c) => c.artysta).filter(Boolean))].slice(0, 40);
  const events = [...new Set(concerts.map((c) => c.event).filter(Boolean))].slice(0, 25);
  const cities = [...new Set(concerts.map((c) => c.miasto).filter(Boolean))].slice(0, 20);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <Command label="Szybkie wyszukiwanie FEST LIFE">
          <div className="flex items-center border-b border-[var(--border)] pr-3">
            <Command.Input
              autoFocus
              placeholder="Szukaj artysty, festiwalu, miasta albo akcji..."
              className="!border-b-0 flex-1"
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <IconX size={16} stroke={1.75} />
            </button>
          </div>
          <Command.List>
            <Command.Empty className="py-8 text-center text-xs text-[var(--text-muted)]">
              Nic nie znaleziono.
            </Command.Empty>

            <Command.Group heading="Szybkie akcje">
              {!isPublicView && (
                <Command.Item onSelect={() => run(() => onNavigate("add"))}>
                  <span className="flex items-center gap-2.5">
                    <IconPlus size={16} stroke={1.75} /> Dodaj nowy koncert
                  </span>
                </Command.Item>
              )}
              <Command.Item onSelect={() => run(onOpenWrapped)}>
                <span className="flex items-center gap-2.5">
                  <IconSparkles size={16} stroke={1.75} /> Otwórz Wrapped Studio (9:16)
                </span>
              </Command.Item>
              <Command.Item onSelect={() => run(() => onNavigate("map"))}>
                <span className="flex items-center gap-2.5">
                  <IconMapPin size={16} stroke={1.75} /> Otwórz HeatMapę Świata
                </span>
              </Command.Item>
              <Command.Item onSelect={() => run(onResetFilters)}>
                <span className="flex items-center gap-2.5">
                  <IconRefresh size={16} stroke={1.75} /> Wyczyść aktywne filtry
                </span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Artyści">
              {artists.map((a) => (
                <Command.Item key={a} value={`artysta ${a}`} onSelect={() => run(() => onSelectSearch(a))}>
                  <span className="flex items-center gap-2.5">
                    <IconMusic size={15} stroke={1.75} className="text-[var(--text-muted)]" />
                    {a}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">Artysta</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Festiwale i trasy">
              {events.map((ev) => (
                <Command.Item key={ev} value={`event ${ev}`} onSelect={() => run(() => onSelectSearch(ev))}>
                  <span className="flex items-center gap-2.5">
                    <IconTicket size={15} stroke={1.75} className="text-[var(--text-muted)]" />
                    {ev}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">Event</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Miasta">
              {cities.map((c) => (
                <Command.Item key={c} value={`miasto ${c}`} onSelect={() => run(() => onSelectSearch(c))}>
                  <span className="flex items-center gap-2.5">
                    <IconMapPin size={15} stroke={1.75} className="text-[var(--text-muted)]" />
                    {c}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">Miasto</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Motywy">
              {(Object.keys(THEME_PROFILES) as ThemeId[]).map((tid) => (
                <Command.Item key={tid} value={`motyw ${THEME_PROFILES[tid].label}`} onSelect={() => run(() => onSetTheme(tid))}>
                  <span className="flex items-center gap-2.5">
                    <IconPalette size={15} stroke={1.75} className="text-[var(--text-muted)]" />
                    Motyw: {THEME_PROFILES[tid].label}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
