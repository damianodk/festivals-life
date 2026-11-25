import React, { useState } from "react";
import type { StreamingProvider, ThemeId } from "../types";
import { THEME_PROFILES } from "../lib/themes";
import { BottomSheet } from "./ui/BottomSheet";

interface OnboardingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHometown: string;
  initialTheme: ThemeId;
  initialStreaming: StreamingProvider;
  onThemeChange: (t: ThemeId) => void;
  onStreamingChange: (p: StreamingProvider) => void;
  onComplete: (data: {
    username: string;
    display_name: string;
    hometown: string;
    is_public: boolean;
  }) => Promise<boolean>;
  onGoAddFirst: () => void;
  onTriggerImport: () => void;
}

export const OnboardingSheet: React.FC<OnboardingSheetProps> = ({
  open,
  onOpenChange,
  initialHometown,
  initialTheme,
  initialStreaming,
  onThemeChange,
  onStreamingChange,
  onComplete,
  onGoAddFirst,
  onTriggerImport
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [hometown, setHometown] = useState(initialHometown || "Poznań");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onComplete({ username, display_name: displayName, hometown, is_public: isPublic });
    setSaving(false);
    if (ok) setStep(3);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Witaj w FEST LIFE"
      description="Skonfiguruj swój profil w 30 sekund"
      maxWidthClass="max-w-md"
    >
      <div className="mb-4 flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i <= step ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Twój nick (@username)
            </label>
            <input className="fl-input w-full" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="np. damian" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Imię / nazwa wyświetlana
            </label>
            <input className="fl-input w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="np. Damian" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Twoje miasto (Hometown — do liczenia km)
            </label>
            <input className="fl-input w-full" value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="Poznań" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={() => setStep(2)} className="fl-btn fl-btn-primary">
              Dalej
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Motyw kolorystyczny
            </label>
            <select
              className="fl-input w-full"
              value={initialTheme}
              onChange={(e) => onThemeChange(e.target.value as ThemeId)}
            >
              {(Object.keys(THEME_PROFILES) as ThemeId[]).map((tid) => (
                <option key={tid} value={tid}>
                  {THEME_PROFILES[tid].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Domyślna platforma muzyczna
            </label>
            <select
              className="fl-input w-full"
              value={initialStreaming}
              onChange={(e) => onStreamingChange(e.target.value as StreamingProvider)}
            >
              <option value="spotify">Spotify</option>
              <option value="apple">Apple Music</option>
              <option value="youtube">YouTube Music</option>
              <option value="tidal">Tidal</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-xs">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Udostępnij mój profil publicznie (tylko statystyki i HeatMapa)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setStep(1)} className="fl-btn">
              Wstecz
            </button>
            <button type="button" disabled={saving} onClick={handleSave} className="fl-btn fl-btn-primary">
              {saving ? "Zapisuję..." : "Zapisz i dalej"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2.5">
          <p className="mb-2 text-xs text-[var(--text-muted)]">Profil gotowy! Jak chcesz zacząć?</p>
          <button
            type="button"
            onClick={() => { onOpenChange(false); onGoAddFirst(); }}
            className="fl-btn fl-btn-primary w-full"
          >
            Dodaj pierwszy koncert ręcznie
          </button>
          <button
            type="button"
            onClick={() => { onOpenChange(false); onTriggerImport(); }}
            className="fl-btn w-full"
          >
            Zaimportuj bazę z pliku (.json / .xlsx)
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="fl-btn w-full">
            Przejdź do aplikacji
          </button>
        </div>
      )}
    </BottomSheet>
  );
};
