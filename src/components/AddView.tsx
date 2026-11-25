import React, { useEffect, useMemo, useState } from "react";
import { IconEdit, IconExternalLink, IconMusic, IconSparkles, IconTrash } from "@tabler/icons-react";
import type { ArtistMeta, Concert, EventMeta, UpcomingConcert } from "../types";
import { setlistSearchUrl } from "../lib/geo";

interface AddViewProps {
  subTab: "concert" | "upcoming" | "database";
  onSubTabChange: (t: "concert" | "upcoming" | "database") => void;
  allConcerts: Concert[];
  filteredConcerts: Concert[];
  eventsMeta: Record<string, EventMeta>;
  artistsMetaCache: Record<string, ArtistMeta>;
  editingConcert: Concert | null;
  prefillConcert: Partial<Concert> | null;
  onClearEditing: () => void;
  onSaveConcert: (rec: Omit<Concert, "id">, id?: number) => Promise<void>;
  onDeleteConcert: (id: number) => Promise<void>;
  onEditConcert: (c: Concert) => void;
  onSaveUpcoming: (
    item: Omit<UpcomingConcert, "id">,
    ticketFile: File | null,
    hotel: string,
    transport: string
  ) => Promise<void>;
}

export type ConcertKind = "solo" | "festival";

const DAYS_PL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

const FESTIVAL_KEYWORDS_RE =
  /festi[wv]al|open['’]?er|m[eę]skie\s*granie|pol['’]?and['’]?rock|woodstock|audioriver|orange\s*warsaw|tauron|colours\s*of\s*ostrava|sziget|primavera|coachella|glastonbury|rock\s*am\s*ring|nos\s*alive|roskilde|tomorrowland|sunrise|clout|bitter\s?sweet|salt\s*wave|next\s*fest|great\s*september|soundrive|up\s*to\s*date|inside\s*seaside|mystic|jarocin|off\s+/i;

export function detectEventKindFromName(
  eventName: string,
  eventsMeta?: Record<string, EventMeta>,
  rok?: string | number | null
): ConcertKind {
  const ev = eventName.trim();
  if (!ev) return "solo";
  if (FESTIVAL_KEYWORDS_RE.test(ev)) return "festival";
  if (eventsMeta) {
    const lower = ev.toLowerCase();
    const yr = rok ? String(rok).trim() : "";
    const exactKey = yr ? Object.keys(eventsMeta).find((k) => k.toLowerCase() === `${lower}|${yr}`) : undefined;
    if (exactKey && (eventsMeta[exactKey]?.lineup?.length || 0) > 1) return "festival";
    const anyMatch = Object.keys(eventsMeta).some(
      (k) => k.toLowerCase().startsWith(`${lower}|`) && (eventsMeta[k]?.lineup?.length || 0) > 1
    );
    if (anyMatch) return "festival";
  }
  return "solo";
}

export function getConcertKind(
  c: Concert,
  eventsMeta?: Record<string, EventMeta>,
  allConcerts?: Concert[]
): ConcertKind {
  const explicit = ((c as unknown as { rodzaj?: string }).rodzaj || c.podgatunek || "").trim().toLowerCase();
  if (explicit === "festival" || explicit === "festiwal") return "festival";
  if (explicit === "solo" || explicit === "koncert solowy" || explicit === "solowy") return "solo";

  const ev = (c.event || "").trim();
  if (!ev || /^koncert(\s+solowy)?$/i.test(ev)) return "solo";
  if (detectEventKindFromName(ev, eventsMeta, c.rok) === "festival") return "festival";

  if (allConcerts && allConcerts.length > 0) {
    const sameEventArtists = new Set(
      allConcerts
        .filter(
          (other) =>
            (other.event || "").trim().toLowerCase() === ev.toLowerCase() &&
            String(other.rok || "") === String(c.rok || "")
        )
        .map((other) => other.artysta.trim().toLowerCase())
        .filter(Boolean)
    );
    if (sameEventArtists.size > 1) return "festival";
  }

  return "solo";
}

const emptyConcertForm = {
  event: "", rok: "", artysta: "", data: "", dzien: "", godzina: "", scena: "",
  miejsce: "", miasto: "", district: "", kraj: "Polska", gatunek: "", podgatunek: "",
  kto: "Razem", z_kim: "", ocena: 0, cena: "", uwagi: ""
};

const emptyUpcomingForm = {
  artysta: "", event: "", data: "", godzina: "", rok: "", dzien: "",
  miasto: "", kraj: "Polska", miejsce: "", gatunek: "", z_kim: "",
  status_biletu: "Kupiony", cena: "", hotel: "", transport: "", uwagi: ""
};

export const AddView: React.FC<AddViewProps> = ({
  subTab,
  onSubTabChange,
  allConcerts,
  filteredConcerts,
  eventsMeta,
  artistsMetaCache,
  editingConcert,
  prefillConcert,
  onClearEditing,
  onSaveConcert,
  onDeleteConcert,
  onEditConcert,
  onSaveUpcoming
}) => {
  const [form, setForm] = useState(emptyConcertForm);
  const [concertKind, setConcertKind] = useState<ConcertKind>("solo");
  const [kindTouched, setKindTouched] = useState(false);

  const [upForm, setUpForm] = useState(emptyUpcomingForm);
  const [upKind, setUpKind] = useState<ConcertKind>("solo");
  const [upKindTouched, setUpKindTouched] = useState(false);

  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [sortCol, setSortCol] = useState<keyof Concert | "rodzaj">("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [savingKindId, setSavingKindId] = useState<number | null>(null);

  useEffect(() => {
    if (editingConcert) {
      const detected = getConcertKind(editingConcert, eventsMeta, allConcerts);
      setConcertKind(detected);
      setKindTouched(true);
      setForm({
        event: editingConcert.event || "",
        rok: editingConcert.rok ? String(editingConcert.rok) : "",
        artysta: editingConcert.artysta || "",
        data: editingConcert.data || "",
        dzien: editingConcert.dzien || "",
        godzina: editingConcert.godzina || "",
        scena: editingConcert.scena || "",
        miejsce: editingConcert.miejsce || "",
        miasto: editingConcert.miasto || "",
        district: editingConcert.district || "",
        kraj: editingConcert.kraj || "Polska",
        gatunek: editingConcert.gatunek || "",
        podgatunek: editingConcert.podgatunek || "",
        kto: editingConcert.kto || "Razem",
        z_kim: editingConcert.z_kim || "",
        ocena: editingConcert.ocena || 0,
        cena: editingConcert.cena != null ? String(editingConcert.cena) : "",
        uwagi: editingConcert.uwagi || ""
      });
    } else if (prefillConcert) {
      const evName = prefillConcert.event || "";
      const detected = detectEventKindFromName(evName, eventsMeta, prefillConcert.rok);
      setConcertKind(detected);
      setKindTouched(Boolean(evName));
      setForm({
        ...emptyConcertForm,
        event: evName,
        rok: prefillConcert.rok ? String(prefillConcert.rok) : "",
        artysta: prefillConcert.artysta || "",
        data: prefillConcert.data || "",
        dzien: prefillConcert.dzien || "",
        miejsce: prefillConcert.miejsce || "",
        miasto: prefillConcert.miasto || "",
        kraj: prefillConcert.kraj || "Polska",
        z_kim: prefillConcert.z_kim || ""
      });
    }
  }, [editingConcert, prefillConcert, eventsMeta, allConcerts]);

  const suggestedConcertKind = useMemo(
    () => detectEventKindFromName(form.event, eventsMeta, form.rok),
    [form.event, eventsMeta, form.rok]
  );

  const suggestedUpcomingKind = useMemo(
    () => detectEventKindFromName(upForm.event, eventsMeta, upForm.rok),
    [upForm.event, eventsMeta, upForm.rok]
  );

  const lineupSuggestions = useMemo(() => {
    const ev = form.event.trim().toLowerCase();
    const yr = form.rok.trim();
    if (!ev) return [];
    const exact = Object.keys(eventsMeta).find((k) => k.toLowerCase() === `${ev}|${yr}`);
    if (exact && eventsMeta[exact]?.lineup?.length) return eventsMeta[exact].lineup!;
    const set = new Set<string>();
    Object.keys(eventsMeta)
      .filter((k) => k.toLowerCase().startsWith(ev + "|"))
      .forEach((k) => (eventsMeta[k].lineup || []).forEach((a) => set.add(a)));
    return [...set];
  }, [form.event, form.rok, eventsMeta]);

  const autoDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return { rok: "", dzien: "" };
    return { rok: String(d.getFullYear()), dzien: DAYS_PL[d.getDay()] };
  };

  const tryAutoGenre = (artistName: string) => {
    if (form.gatunek.trim()) return;
    const hit = artistsMetaCache[artistName.trim().toLowerCase()];
    if (hit?.genres?.length) {
      setForm((f) => ({ ...f, gatunek: hit.genres![0] }));
    }
  };

  const handleEventNameChange = (value: string) => {
    setForm((prev) => ({ ...prev, event: value }));
    if (!kindTouched) {
      setConcertKind(detectEventKindFromName(value, eventsMeta, form.rok));
    }
  };

  const handleUpcomingEventChange = (value: string) => {
    setUpForm((prev) => ({ ...prev, event: value }));
    if (!upKindTouched) {
      setUpKind(detectEventKindFromName(value, eventsMeta, upForm.rok));
    }
  };

  const submitConcert = async (e: React.FormEvent) => {
    e.preventDefault();
    const kindLabel = concertKind === "festival" ? "Festiwal" : "Koncert solowy";
    const resolvedEvent =
      form.event.trim() ||
      (concertKind === "solo" && form.artysta.trim()
        ? `Koncert: ${form.artysta.trim()}`
        : kindLabel);

    await onSaveConcert(
      {
        rok: parseInt(form.rok, 10) || null,
        event: resolvedEvent,
        artysta: form.artysta.trim(),
        data: form.data || null,
        dzien: form.dzien.trim(),
        godzina: form.godzina.trim(),
        scena: concertKind === "festival" ? form.scena.trim() : form.scena.trim(),
        miejsce: form.miejsce.trim(),
        miasto: form.miasto.trim(),
        district: form.district.trim(),
        kraj: form.kraj.trim(),
        gatunek: form.gatunek.trim(),
        podgatunek: kindLabel,
        kto: form.kto.trim(),
        z_kim: form.z_kim.trim(),
        ocena: Number(form.ocena) || 0,
        cena: form.cena !== "" ? Number(form.cena) : null,
        uwagi: form.uwagi.trim()
      },
      editingConcert?.id
    );
    setForm(emptyConcertForm);
    setConcertKind("solo");
    setKindTouched(false);
    onClearEditing();
  };

  const submitUpcoming = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedEvent =
      upForm.event.trim() ||
      (upKind === "solo" && upForm.artysta.trim()
        ? `Koncert: ${upForm.artysta.trim()}`
        : "Koncert solowy");

    await onSaveUpcoming(
      {
        rok: parseInt(upForm.rok, 10) || null,
        event: resolvedEvent,
        artysta: upForm.artysta.trim(),
        data: upForm.data || null,
        dzien: upForm.dzien.trim(),
        godzina: upForm.godzina.trim(),
        miejsce: upForm.miejsce.trim(),
        miasto: upForm.miasto.trim(),
        kraj: upForm.kraj.trim(),
        gatunek: upForm.gatunek.trim(),
        z_kim: upForm.z_kim.trim(),
        status_biletu: upForm.status_biletu,
        cena: upForm.cena !== "" ? Number(upForm.cena) : null,
        ticket_file_path: "",
        uwagi: upForm.uwagi.trim()
      },
      ticketFile,
      upForm.hotel.trim(),
      upForm.transport.trim()
    );
    setUpForm(emptyUpcomingForm);
    setUpKind("solo");
    setUpKindTouched(false);
    setTicketFile(null);
  };

  const handleToggleRowKind = async (c: Concert) => {
    if (savingKindId === c.id) return;
    setSavingKindId(c.id);
    try {
      const current = getConcertKind(c, eventsMeta, allConcerts);
      const nextLabel = current === "festival" ? "Koncert solowy" : "Festiwal";
      const { id, ...rest } = c;
      await onSaveConcert({ ...rest, podgatunek: nextLabel }, id);
    } finally {
      setSavingKindId(null);
    }
  };

  const sortedDb = useMemo(() => {
    return [...filteredConcerts].sort((a, b) => {
      if (sortCol === "rodzaj") {
        const ka = getConcertKind(a, eventsMeta, allConcerts);
        const kb = getConcertKind(b, eventsMeta, allConcerts);
        return sortAsc ? ka.localeCompare(kb, "pl") : kb.localeCompare(ka, "pl");
      }
      const va = String(a[sortCol] || "").toLowerCase();
      const vb = String(b[sortCol] || "").toLowerCase();
      return sortAsc ? va.localeCompare(vb, "pl") : vb.localeCompare(va, "pl");
    });
  }, [filteredConcerts, sortCol, sortAsc, eventsMeta, allConcerts]);

  const toggleSort = (col: keyof Concert | "rodzaj") => {
    if (sortCol === col) setSortAsc((a) => !a);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const uniqueVals = (field: keyof Concert) =>
    [...new Set(allConcerts.map((c) => String(c[field] || "")).filter(Boolean))].sort();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3.5">
        {[
          { id: "concert", lbl: editingConcert ? `Edycja: ${editingConcert.artysta}` : "Dodaj koncert" },
          { id: "upcoming", lbl: "Nadchodzący & Travel Wallet" },
          { id: "database", lbl: `Pełna baza (${filteredConcerts.length})` }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSubTabChange(t.id as "concert" | "upcoming" | "database")}
            className={`fl-btn !text-xs ${subTab === t.id ? "fl-btn-primary" : ""}`}
          >
            {t.lbl}
          </button>
        ))}
      </div>

      {/* DATALISTS */}
      <datalist id="dlArtysta">{uniqueVals("artysta").map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dlEvent">{uniqueVals("event").map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dlMiasto">{uniqueVals("miasto").map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dlKraj">{uniqueVals("kraj").map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dlGatunek">{uniqueVals("gatunek").map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dlZKim">{uniqueVals("z_kim").map((v) => <option key={v} value={v} />)}</datalist>

      {subTab === "concert" && (
        <form onSubmit={submitConcert} className="space-y-4">
          {/* Przełącznik Koncert solowy vs Festiwal */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Rodzaj wydarzenia
              </span>
              {form.event.trim() && suggestedConcertKind !== concertKind && (
                <button
                  type="button"
                  onClick={() => {
                    setConcertKind(suggestedConcertKind);
                    setKindTouched(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent)] hover:underline"
                >
                  <IconSparkles size={12} />
                  Podpowiedź: zmień na {suggestedConcertKind === "festival" ? "Festiwal" : "Koncert solowy"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setConcertKind("solo");
                  setKindTouched(true);
                }}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  concertKind === "solo"
                    ? "border-[var(--accent)] bg-[var(--surface)] shadow-sm"
                    : "border-[var(--border)] bg-transparent opacity-75 hover:opacity-100"
                }`}
              >
                <IconMusic size={16} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">Koncert solowy</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Dedykowany jednemu artyście (klub, hala, trasa)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConcertKind("festival");
                  setKindTouched(true);
                }}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                  concertKind === "festival"
                    ? "border-[var(--accent)] bg-[var(--surface)] shadow-sm"
                    : "border-[var(--border)] bg-transparent opacity-75 hover:opacity-100"
                }`}
              >
                <IconSparkles size={16} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">Festiwal</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Występ w ramach festiwalu / multi-artystycznego eventu
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {concertKind === "festival" ? "Nazwa festiwalu *" : "Nazwa trasy / wydarzenia (opcjonalnie)"}
              </label>
              <input
                required={concertKind === "festival"}
                list="dlEvent"
                className="fl-input w-full"
                value={form.event}
                onChange={(e) => handleEventNameChange(e.target.value)}
                placeholder={
                  concertKind === "festival"
                    ? "np. Open’er Festival"
                    : "np. 1-800-OŚWIECENIE Tour (zostaw puste dla zwykłego koncertu)"
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Rok (auto)
              </label>
              <input
                required
                type="number"
                min={1990}
                max={2100}
                className="fl-input w-full"
                value={form.rok}
                onChange={(e) => setForm({ ...form, rok: e.target.value })}
              />
            </div>

            {lineupSuggestions.length > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="mb-2 flex justify-between font-mono text-[10px] font-bold uppercase text-[var(--accent)]">
                  <span>Wybierz z line-upu</span>
                  <span>{lineupSuggestions.length} artystów</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lineupSuggestions.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, artysta: a }));
                        tryAutoGenre(a);
                      }}
                      className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 text-xs hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Artysta *
              </label>
              <input
                required
                list="dlArtysta"
                className="fl-input w-full"
                value={form.artysta}
                onChange={(e) => setForm({ ...form, artysta: e.target.value })}
                onBlur={(e) => tryAutoGenre(e.target.value)}
                placeholder="np. Taco Hemingway"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Data *
              </label>
              <input
                required
                type="date"
                className="fl-input w-full"
                value={form.data}
                onChange={(e) => {
                  const ad = autoDate(e.target.value);
                  setForm({
                    ...form,
                    data: e.target.value,
                    rok: ad.rok || form.rok,
                    dzien: ad.dzien || form.dzien
                  });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Dzień tygodnia
              </label>
              <input
                className="fl-input w-full"
                value={form.dzien}
                onChange={(e) => setForm({ ...form, dzien: e.target.value })}
                placeholder="piątek"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Godzina
              </label>
              <input
                className="fl-input w-full"
                value={form.godzina}
                onChange={(e) => setForm({ ...form, godzina: e.target.value })}
                placeholder="21:00"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Scena
              </label>
              <input
                className="fl-input w-full"
                value={form.scena}
                onChange={(e) => setForm({ ...form, scena: e.target.value })}
                placeholder={concertKind === "festival" ? "Main Stage" : "Opcjonalnie"}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Miejsce / Klub
              </label>
              <input
                className="fl-input w-full"
                value={form.miejsce}
                onChange={(e) => setForm({ ...form, miejsce: e.target.value })}
                placeholder="Cytadela"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Miasto *
              </label>
              <input
                required
                list="dlMiasto"
                className="fl-input w-full"
                value={form.miasto}
                onChange={(e) => setForm({ ...form, miasto: e.target.value })}
                placeholder="Poznań"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Kraj *
              </label>
              <input
                required
                list="dlKraj"
                className="fl-input w-full"
                value={form.kraj}
                onChange={(e) => setForm({ ...form, kraj: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Gatunek (auto ze Spotify)
              </label>
              <input
                list="dlGatunek"
                className="fl-input w-full"
                value={form.gatunek}
                onChange={(e) => setForm({ ...form, gatunek: e.target.value })}
                placeholder="Hip-Hop/Rap"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Z kim?
              </label>
              <input
                list="dlZKim"
                className="fl-input w-full"
                value={form.z_kim}
                onChange={(e) => setForm({ ...form, z_kim: e.target.value })}
                placeholder="Oliwki & Klopstegi"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Ocena
              </label>
              <select
                className="fl-input w-full"
                value={form.ocena}
                onChange={(e) => setForm({ ...form, ocena: Number(e.target.value) })}
              >
                <option value={0}>Brak oceny</option>
                <option value={5}>5 / 5 — Legendarny</option>
                <option value={4}>4 / 5 — Świetny</option>
                <option value={3}>3 / 5 — Dobry</option>
                <option value={2}>2 / 5 — Średni</option>
                <option value={1}>1 / 5 — Słaby</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Cena biletu (PLN)
              </label>
              <input
                type="number"
                min={0}
                className="fl-input w-full"
                value={form.cena}
                onChange={(e) => setForm({ ...form, cena: e.target.value })}
                placeholder="350"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Uwagi
              </label>
              <input
                className="fl-input w-full"
                value={form.uwagi}
                onChange={(e) => setForm({ ...form, uwagi: e.target.value })}
                placeholder="Deszcz, bisy, gość specjalny..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(emptyConcertForm);
                setConcertKind("solo");
                setKindTouched(false);
                onClearEditing();
              }}
              className="fl-btn"
            >
              Wyczyść
            </button>
            <button type="submit" className="fl-btn fl-btn-primary">
              {editingConcert ? "Zapisz zmiany" : "Zapisz koncert"}
            </button>
          </div>
        </form>
      )}

      {subTab === "upcoming" && (
        <form onSubmit={submitUpcoming} className="space-y-4">
          {/* Przełącznik Koncert solowy vs Festiwal */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Rodzaj nadchodzącego wyjazdu
              </span>
              {upForm.event.trim() && suggestedUpcomingKind !== upKind && (
                <button
                  type="button"
                  onClick={() => {
                    setUpKind(suggestedUpcomingKind);
                    setUpKindTouched(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent)] hover:underline"
                >
                  <IconSparkles size={12} />
                  Podpowiedź: {suggestedUpcomingKind === "festival" ? "Festiwal" : "Koncert solowy"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUpKind("solo");
                  setUpKindTouched(true);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                  upKind === "solo"
                    ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <IconMusic size={15} className="text-[var(--accent)]" />
                Koncert solowy
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpKind("festival");
                  setUpKindTouched(true);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                  upKind === "festival"
                    ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <IconSparkles size={15} className="text-[var(--accent)]" />
                Festiwal
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Artysta *
              </label>
              <input
                required
                list="dlArtysta"
                className="fl-input w-full"
                value={upForm.artysta}
                onChange={(e) => setUpForm({ ...upForm, artysta: e.target.value })}
                placeholder="np. Fred Again.."
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {upKind === "festival" ? "Nazwa festiwalu *" : "Event / Trasa (opcjonalnie)"}
              </label>
              <input
                required={upKind === "festival"}
                list="dlEvent"
                className="fl-input w-full"
                value={upForm.event}
                onChange={(e) => handleUpcomingEventChange(e.target.value)}
                placeholder={upKind === "festival" ? "np. Open’er Festival" : "np. USB Tour"}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Data *
              </label>
              <input
                required
                type="date"
                className="fl-input w-full"
                value={upForm.data}
                onChange={(e) => {
                  const ad = autoDate(e.target.value);
                  setUpForm({
                    ...upForm,
                    data: e.target.value,
                    rok: ad.rok || upForm.rok,
                    dzien: ad.dzien || upForm.dzien
                  });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Godzina
              </label>
              <input
                className="fl-input w-full"
                value={upForm.godzina}
                onChange={(e) => setUpForm({ ...upForm, godzina: e.target.value })}
                placeholder="21:00"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Miasto *
              </label>
              <input
                required
                list="dlMiasto"
                className="fl-input w-full"
                value={upForm.miasto}
                onChange={(e) => setUpForm({ ...upForm, miasto: e.target.value })}
                placeholder="Gdynia"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Kraj *
              </label>
              <input
                required
                list="dlKraj"
                className="fl-input w-full"
                value={upForm.kraj}
                onChange={(e) => setUpForm({ ...upForm, kraj: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Status biletu
              </label>
              <select
                className="fl-input w-full"
                value={upForm.status_biletu}
                onChange={(e) => setUpForm({ ...upForm, status_biletu: e.target.value })}
              >
                <option value="Kupiony">Kupiony</option>
                <option value="Do kupienia">Do kupienia</option>
                <option value="Zastanawiam się">Zastanawiam się</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Cena biletu (PLN)
              </label>
              <input
                type="number"
                min={0}
                className="fl-input w-full"
                value={upForm.cena}
                onChange={(e) => setUpForm({ ...upForm, cena: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Plik biletu (PDF / QR)
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                className="fl-input w-full !py-2 text-xs"
                onChange={(e) => setTicketFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Nocleg / Hotel
              </label>
              <input
                className="fl-input w-full"
                value={upForm.hotel}
                onChange={(e) => setUpForm({ ...upForm, hotel: e.target.value })}
                placeholder="np. Hotel Mercure Gdynia"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Dojazd / Lot / Nr rezerwacji
              </label>
              <input
                className="fl-input w-full"
                value={upForm.transport}
                onChange={(e) => setUpForm({ ...upForm, transport: e.target.value })}
                placeholder="np. PKP EIP 14:20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Z kim?
              </label>
              <input
                list="dlZKim"
                className="fl-input w-full"
                value={upForm.z_kim}
                onChange={(e) => setUpForm({ ...upForm, z_kim: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Lista pakowania & Uwagi
              </label>
              <input
                className="fl-input w-full"
                value={upForm.uwagi}
                onChange={(e) => setUpForm({ ...upForm, uwagi: e.target.value })}
                placeholder="Peleryna, powerbank, zatyczki..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setUpForm(emptyUpcomingForm);
                setUpKind("solo");
                setUpKindTouched(false);
                setTicketFile(null);
              }}
              className="fl-btn"
            >
              Wyczyść
            </button>
            <button type="submit" className="fl-btn fl-btn-primary">
              Zapisz wyjazd
            </button>
          </div>
        </form>
      )}

      {subTab === "database" && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("data")}>Data ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("artysta")}>Artysta ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("rodzaj")}>Rodzaj ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("event")}>Event ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("miasto")}>Miasto ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("gatunek")}>Gatunek ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("z_kim")}>Ekipa ↕</th>
                <th className="px-3 py-2.5">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sortedDb.map((c) => {
                const kind = getConcertKind(c, eventsMeta, allConcerts);
                const isFest = kind === "festival";
                return (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono">{c.data}</td>
                    <td className="px-3 py-2.5 font-semibold">{c.artysta}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <button
                        type="button"
                        disabled={savingKindId === c.id}
                        onClick={() => handleToggleRowKind(c)}
                        title="Kliknij, aby przełączyć Solowy / Festiwal"
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                          isFest
                            ? "border-[var(--accent)] bg-[var(--surface-2)] text-[var(--accent)]"
                            : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        {isFest ? <IconSparkles size={11} /> : <IconMusic size={11} />}
                        {isFest ? "Festiwal" : "Solowy"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">{c.event}</td>
                    <td className="px-3 py-2.5">{c.miasto}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px]">
                        {c.gatunek || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-muted)]">{c.z_kim || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex gap-1">
                        <a
                          href={setlistSearchUrl(c)}
                          target="_blank"
                          rel="noreferrer"
                          className="fl-btn !px-2 !py-1 !text-[11px]"
                        >
                          Setlist <IconExternalLink size={12} stroke={1.75} />
                        </a>
                        <button
                          type="button"
                          onClick={() => onEditConcert(c)}
                          className="fl-btn !p-1.5"
                          title="Edytuj"
                        >
                          <IconEdit size={13} stroke={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteConcert(c.id)}
                          className="fl-btn fl-btn-danger !p-1.5"
                          title="Usuń"
                        >
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
      )}
    </div>
  );
};