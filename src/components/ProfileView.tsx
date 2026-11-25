import React, { useEffect, useState } from "react";
import {
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconLogout,
  IconPlus,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconUserPlus,
  IconArrowsLeftRight
} from "@tabler/icons-react";
import { toast } from "sonner";
import type {
  ArtistMeta,
  BucketItem,
  Concert,
  PublicProfileSettings,
  PublicProfileSummary,
  StreamingProvider,
  ThemeId,
  UserSettings
} from "../types";
import { THEME_PROFILES } from "../lib/themes";
import { artistInitials, sanitizeSlug } from "../lib/geo";

interface ProfileViewProps {
  userEmail: string;
  isCloud: boolean;
  settings: UserSettings;
  theme: ThemeId;
  streamingProvider: StreamingProvider;
  publicProfile: PublicProfileSettings;
  followingList: PublicProfileSummary[];
  bucketList: BucketItem[];
  allConcerts: Concert[];
  artistsMetaCache: Record<string, ArtistMeta>;
  onSaveHometown: (city: string) => Promise<void>;
  onThemeChange: (t: ThemeId) => void;
  onStreamingChange: (p: StreamingProvider) => void;
  onSyncArtists: () => Promise<void>;
  onSavePublicProfile: (p: PublicProfileSettings) => Promise<void>;
  onSearchProfiles: (query: string) => Promise<PublicProfileSummary[]>;
  onFollow: (id: string) => Promise<void>;
  onUnfollow: (id: string) => Promise<void>;
  onOpenConcertMatch: (username: string) => Promise<void>;
  onAddBucket: (artist: string, notes: string) => Promise<void>;
  onDeleteBucket: (id: number) => Promise<void>;
  onOpenWrapped: () => void;
  onExportXLSX: () => void;
  onTriggerImport: () => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userEmail,
  isCloud,
  settings,
  theme,
  streamingProvider,
  publicProfile,
  followingList,
  bucketList,
  allConcerts,
  artistsMetaCache,
  onSaveHometown,
  onThemeChange,
  onStreamingChange,
  onSyncArtists,
  onSavePublicProfile,
  onSearchProfiles,
  onFollow,
  onUnfollow,
  onOpenConcertMatch,
  onAddBucket,
  onDeleteBucket,
  onOpenWrapped,
  onExportXLSX,
  onTriggerImport,
  onLogout
}) => {
  const [hometownInput, setHometownInput] = useState(settings.hometown);
  const [pubForm, setPubForm] = useState<PublicProfileSettings>(publicProfile);

  useEffect(() => { setHometownInput(settings.hometown); }, [settings.hometown]);
  useEffect(() => { setPubForm(publicProfile); }, [publicProfile]);
  const [socialQ, setSocialQ] = useState("");
  const [socialResults, setSocialResults] = useState<PublicProfileSummary[]>([]);
  const [blArtist, setBlArtist] = useState("");
  const [blNotes, setBlNotes] = useState("");

  const cleanSlug = sanitizeSlug(pubForm.username);
  const shareUrl = cleanSlug ? `${location.origin}${location.pathname}?u=${encodeURIComponent(cleanSlug)}` : "";

  const seenArtistsSet = new Set(allConcerts.map((c) => (c.artysta || "").toLowerCase()));
  const folIds = new Set(followingList.map((f) => f.id));

  const runSearch = async (val: string) => {
    setSocialQ(val);
    const clean = val.trim().replace(/^@/, "");
    if (clean.length < 2) {
      setSocialResults([]);
      return;
    }
    const res = await onSearchProfiles(clean);
    setSocialResults(res);
  };

  return (
    <div className="space-y-6">
      {/* CORE SETTINGS */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-display text-xl font-extrabold tracking-tight">Mój Profil & Ustawienia</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {isCloud ? `Zalogowano jako ${userEmail}` : "Tryb lokalny / demo"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Hometown (punkt startowy kilometrów)
            </label>
            <div className="flex gap-2">
              <input
                className="fl-input flex-1"
                value={hometownInput}
                onChange={(e) => setHometownInput(e.target.value)}
                placeholder="np. Poznań"
              />
              <button type="button" onClick={() => onSaveHometown(hometownInput)} className="fl-btn fl-btn-primary">
                Zapisz
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Motyw kolorystyczny
            </label>
            <select className="fl-input w-full" value={theme} onChange={(e) => onThemeChange(e.target.value as ThemeId)}>
              {(Object.keys(THEME_PROFILES) as ThemeId[]).map((tid) => (
                <option key={tid} value={tid}>
                  {THEME_PROFILES[tid].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Domyślna platforma streamingowa
            </label>
            <select
              className="fl-input w-full"
              value={streamingProvider}
              onChange={(e) => onStreamingChange(e.target.value as StreamingProvider)}
            >
              <option value="spotify">Spotify</option>
              <option value="apple">Apple Music</option>
              <option value="youtube">YouTube Music</option>
              <option value="tidal">Tidal</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Baza zdjęć artystów (Spotify / Apple)
            </label>
            <button type="button" onClick={onSyncArtists} className="fl-btn w-full">
              <IconRefresh size={15} stroke={1.75} /> Synchronizuj zdjęcia artystów
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onOpenWrapped} className="fl-btn fl-btn-primary !text-xs">
            <IconSparkles size={15} stroke={1.75} /> Wrapped Studio 9:16
          </button>
          <button type="button" onClick={onExportXLSX} className="fl-btn !text-xs">
            <IconDownload size={15} stroke={1.75} /> Eksport Excel (.xlsx)
          </button>
          <button type="button" onClick={onTriggerImport} className="fl-btn !text-xs">
            <IconUpload size={15} stroke={1.75} /> Import (.json / .xlsx)
          </button>
          {isCloud && (
            <button type="button" onClick={onLogout} className="fl-btn fl-btn-danger !text-xs">
              <IconLogout size={15} stroke={1.75} /> Wyloguj się
            </button>
          )}
        </div>
      </section>

      {/* PUBLIC PROFILE */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="font-display text-lg font-extrabold tracking-tight">Profil Publiczny & Udostępnianie</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Link tylko do odczytu dla znajomych (ukrywa ceny, bilety, notatki i Splitwise)
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={pubForm.is_public}
              onChange={(e) => setPubForm({ ...pubForm, is_public: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>Udostępnij mój profil publicznie</span>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Nick w linku (np. damian)
              </label>
              <input
                className="fl-input w-full"
                value={pubForm.username}
                onChange={(e) => setPubForm({ ...pubForm, username: e.target.value })}
                placeholder="damian"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Nazwa wyświetlana
              </label>
              <input
                className="fl-input w-full"
                value={pubForm.display_name}
                onChange={(e) => setPubForm({ ...pubForm, display_name: e.target.value })}
                placeholder="Damian"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Bio
              </label>
              <input
                className="fl-input w-full"
                value={pubForm.bio}
                onChange={(e) => setPubForm({ ...pubForm, bio: e.target.value })}
                placeholder="np. Open'er, BitterSweet & koncertowe kilometry"
              />
            </div>
          </div>

          {shareUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs">
              <span className="truncate text-[var(--text-muted)]">{shareUrl}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(shareUrl);
                    toast.success("Skopiowano link do profilu!");
                  }}
                  className="fl-btn !px-2.5 !py-1 !text-[11px]"
                >
                  <IconCopy size={13} stroke={1.75} /> Kopiuj
                </button>
                <a href={shareUrl} target="_blank" rel="noreferrer" className="fl-btn !px-2.5 !py-1 !text-[11px]">
                  Podgląd <IconExternalLink size={12} stroke={1.75} />
                </a>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onSavePublicProfile({ ...pubForm, username: cleanSlug })}
            className="fl-btn fl-btn-primary !text-xs"
          >
            Zapisz profil publiczny
          </button>
        </div>
      </section>

      {/* SOCIAL & CONCERT MATCH */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="font-display text-lg font-extrabold tracking-tight">Społeczność & Concert Match 1v1</h3>
          <p className="text-xs text-[var(--text-muted)]">Szukaj znajomych po @nicku i sprawdzaj wspólnych artystów</p>
        </div>

        <input
          className="fl-input mb-3 w-full"
          value={socialQ}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Wpisz @nick lub nazwę znajomego..."
        />

        {socialResults.length > 0 && (
          <div className="mb-4 space-y-2">
            {socialResults.map((p) => {
              const isFol = folIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5"
                >
                  <div>
                    <strong className="text-sm">{p.display_name || `@${p.username}`}</strong>
                    <span className="ml-2 font-mono text-xs text-[var(--accent)]">@{p.username}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenConcertMatch(p.username)}
                      className="fl-btn fl-btn-primary !px-2.5 !py-1 !text-xs"
                    >
                      <IconArrowsLeftRight size={13} stroke={1.75} /> Match 1v1
                    </button>
                    {!isFol ? (
                      <button
                        type="button"
                        onClick={() => onFollow(p.id)}
                        className="fl-btn !px-2.5 !py-1 !text-xs"
                      >
                        <IconUserPlus size={13} stroke={1.75} /> Obserwuj
                      </button>
                    ) : (
                      <span className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                        Obserwujesz
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Obserwowani znajomi ({followingList.length})
        </div>
        <div className="space-y-2">
          {followingList.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5"
            >
              <div>
                <strong className="text-sm">{p.display_name || `@${p.username}`}</strong>
                <span className="ml-2 font-mono text-xs text-[var(--accent)]">@{p.username}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenConcertMatch(p.username)}
                  className="fl-btn fl-btn-primary !px-2.5 !py-1 !text-xs"
                >
                  Match 1v1
                </button>
                <a
                  href={`${location.origin}${location.pathname}?u=${encodeURIComponent(p.username)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="fl-btn !px-2.5 !py-1 !text-xs"
                >
                  Profil
                </a>
                <button type="button" onClick={() => onUnfollow(p.id)} className="fl-btn fl-btn-danger !p-1.5">
                  <IconTrash size={13} stroke={1.75} />
                </button>
              </div>
            </div>
          ))}
          {followingList.length === 0 && (
            <div className="text-xs text-[var(--text-muted)]">Nikogo jeszcze nie obserwujesz.</div>
          )}
        </div>
      </section>

      {/* BUCKET LIST */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="font-display text-lg font-extrabold tracking-tight">Bucket List — Lista Marzeń</h3>
          <p className="text-xs text-[var(--text-muted)]">Artyści, których chcesz zobaczyć na żywo</p>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!blArtist.trim()) return;
            await onAddBucket(blArtist.trim(), blNotes.trim());
            setBlArtist("");
            setBlNotes("");
          }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <input required className="fl-input flex-1 min-w-[160px]" value={blArtist} onChange={(e) => setBlArtist(e.target.value)} placeholder="Nazwa artysty" />
          <input className="fl-input flex-1 min-w-[140px]" value={blNotes} onChange={(e) => setBlNotes(e.target.value)} placeholder="Notatka" />
          <button type="submit" className="fl-btn fl-btn-primary">
            <IconPlus size={15} stroke={1.75} /> Dodaj
          </button>
        </form>

        <div className="space-y-2">
          {bucketList.map((b) => {
            const isSeen = b.seen || seenArtistsSet.has((b.artist || "").toLowerCase());
            const meta = artistsMetaCache[(b.artist || "").trim().toLowerCase()];
            return (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3">
                  {meta?.image_url ? (
                    <img src={meta.image_url} alt={b.artist} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface)] font-display text-xs font-extrabold">
                      {artistInitials(b.artist)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className={isSeen ? "line-through opacity-60" : ""}>{b.artist}</span>
                      {isSeen && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                          Zaliczony
                        </span>
                      )}
                    </div>
                    {b.notes && <div className="text-xs text-[var(--text-muted)]">{b.notes}</div>}
                  </div>
                </div>
                <button type="button" onClick={() => onDeleteBucket(b.id)} className="fl-btn fl-btn-danger !p-1.5">
                  <IconTrash size={13} stroke={1.75} />
                </button>
              </div>
            );
          })}
          {bucketList.length === 0 && (
            <div className="text-xs text-[var(--text-muted)]">Twoja lista marzeń jest pusta.</div>
          )}
        </div>
      </section>
    </div>
  );
};
