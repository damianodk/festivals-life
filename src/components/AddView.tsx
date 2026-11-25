import React, { useEffect, useMemo, useState } from "react";
import { IconEdit, IconExternalLink, IconTrash } from "@tabler/icons-react";
import type { ArtistMeta, Concert, EventMeta, UpcomingConcert } from "../types";
import { setlistSearchUrl } from "../lib/geo";
import { supabase } from "../lib/supabase";
import {
  ConcertKind,
  detectConcertKind,
  inferKindFromFields,
  loadTypeOverrides,
  saveConcertKindLocal,
} from "./StartView";

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

const DAYS_PL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

const emptyConcertForm = {
  event: "", rok: "", artysta: "", data: "", dzien: "", godzina: "", scena: "",
  miejsce: "", miasto: "", district: "", kraj: "Polska", gatunek: "", podgatunek: "",
  kto: "Razem", z_kim: "", ocena: 0, cena: "", uwagi: "",
  kind: "solowy" as ConcertKind,
};

const emptyUpcomingForm = {
  artysta: "", event: "", data: "", godzina: "", rok: "", dzien: "",
  miasto: "", kraj: "Polska", miejsce: "", gatunek: "", z_kim: "",
  status_biletu: "Kupiony", cena: "", hotel: "", transport: "", uwagi: "",
  kind: "solowy" as ConcertKind,
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
  const [kindTouched, setKindTouched] = useState(false);
  const [upForm, setUpForm] = useState(emptyUpcomingForm);
  const [upKindTouched, setUpKindTouched] = useState(false);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [sortCol, setSortCol] = useState<keyof Concert>("data");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, ConcertKind>>(() =>
    loadTypeOverrides()
  );

  useEffect(() => {
    const sync = () => setTypeOverrides(loadTypeOverrides());
    window.addEventListener("festlife:concert-updated", sync);
    return () => window.removeEventListener("festlife:concert-updated", sync);
  }, []);

  useEffect(() => {
    if (editingConcert) {
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
        uwagi: editingConcert.uwagi || "",
        kind: detectConcertKind(editingConcert),
      });
    } else if (prefillConcert) {
      const inferred = inferKindFromFields(prefillConcert.event, prefillConcert.artysta);
      setKindTouched(false);
      setForm({
        ...emptyConcertForm,
        event: prefillConcert.event || "",
        rok: prefillConcert.rok ? String(prefillConcert.rok) : "",
        artysta: prefillConcert.artysta || "",
        data: prefillConcert.data || "",
        dzien: prefillConcert.dzien || "",
        miejsce: prefillConcert.miejsce || "",
        miasto: prefillConcert.miasto || "",
        kraj: prefillConcert.kraj || "Polska",
        z_kim: prefillConcert.z_kim || "",
        kind: inferred,
      });
    }
  }, [editingConcert, prefillConcert]);

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

  const handleToggleDbRowKind = async (c: Concert, nextKind: ConcertKind) => {
    const nextMap = saveConcertKindLocal(c, nextKind);
    setTypeOverrides(nextMap);
    if (c.id) {
      await supabase.from("concerts").update({ typ: nextKind } as any).eq("id", c.id);
    }
  };

  const submitConcert = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      rok: parseInt(form.rok, 10) || null,
      event: form.event.trim(),
      artysta: form.artysta.trim(),
      data: form.data || null,
      dzien: form.dzien.trim(),
      godzina: form.godzina.trim(),
      scena: form.scena.trim(),
      miejsce: form.miejsce.trim(),
      miasto: form.miasto.trim(),
      district: form.district.trim(),
      kraj: form.kraj.trim(),
      gatunek: form.gatunek.trim(),
      podgatunek: form.podgatunek.trim(),
      kto: form.kto.trim(),
      z_kim: form.z_kim.trim(),
      ocena: Number(form.ocena) || 0,
      cena: form.cena !== "" ? Number(form.cena) : null,
      uwagi: form.uwagi.trim(),
    };

    const chosenKind = form.kind;
    const nextMap = saveConcertKindLocal({ ...payload, id: editingConcert?.id }, chosenKind);
    setTypeOverrides(nextMap);

    await onSaveConcert(payload, editingConcert?.id);

    if (editingConcert?.id) {
      await supabase
        .from("concerts")
        .update({ typ: chosenKind } as any)
        .eq("id", editingConcert.id);
    }

    setForm(emptyConcertForm);
    setKindTouched(false);
    onClearEditing();
  };

  const submitUpcoming = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      rok: parseInt(upForm.rok, 10) || null,
      event: upForm.event.trim(),
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
      uwagi: upForm.uwagi.trim(),
    };
    const nextMap = saveConcertKindLocal(payload, upForm.kind);
    setTypeOverrides(nextMap);

    await onSaveUpcoming(
      payload,
      ticketFile,
      upForm.hotel.trim(),
      upForm.transport.trim()
    );
    setUpForm(emptyUpcomingForm);
    setUpKindTouched(false);
    setTicketFile(null);
  };

  const sortedDb = useMemo(() => {
    return [...filteredConcerts].sort((a, b) => {
      const va = String(a[sortCol] || "").toLowerCase();
      const vb = String(b[sortCol] || "").toLowerCase();
      return sortAsc ? va.localeCompare(vb, "pl") : vb.localeCompare(va, "pl");
    });
  }, [filteredConcerts, sortCol, sortAsc]);

  const toggleSort = (col: keyof Concert) => {
    if (sortCol === col) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(true); }
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
            onClick={() => onSubTabChange(t.id as any)}
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
          {/* Wybór rodzaju występu: Koncert solowy vs Festiwal */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Rodzaj występu
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {form.kind === "solowy"
                    ? "Koncert dedykowany jednemu artyście (klubowy / halowy / stadionowy)"
                    : "Występ artysty w ramach festiwalu lub większego wydarzenia"}
                </div>
              </div>
              <div className="inline-flex shrink-0 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setKindTouched(true);
                    setForm((f) => ({ ...f, kind: "solowy" }));
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.kind === "solowy"
                      ? "bg-[var(--accent)] text-[var(--accent-ink,#fff)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Koncert solowy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKindTouched(true);
                    setForm((f) => ({ ...f, kind: "festiwal" }));
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.kind === "festiwal"
                      ? "bg-[#38bdf8] text-slate-950"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Festiwal
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {form.kind === "festiwal" ? "Nazwa festiwalu *" : "Trasa / Event / Nazwa koncertu *"}
              </label>
              <input
                required
                list="dlEvent"
                className="fl-input w-full"
                value={form.event}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((f) => ({
                    ...f,
                    event: val,
                    kind: kindTouched ? f.kind : inferKindFromFields(val, f.artysta),
                  }));
                }}
                placeholder={form.kind === "festiwal" ? "np. Open’er Festival" : "np. Trasa koncertowa / Koncert klubowy"}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Rok (auto)</label>
              <input required type="number" min={1990} max={2100} className="fl-input w-full" value={form.rok} onChange={(e) => setForm({ ...form, rok: e.target.value })} />
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
                      onClick={() => { setForm((f) => ({ ...f, artysta: a })); tryAutoGenre(a); }}
                      className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 text-xs hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]"
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Artysta *</label>
              <input required list="dlArtysta" className="fl-input w-full" value={form.artysta} onChange={(e) => setForm({ ...form, artysta: e.target.value })} onBlur={(e) => tryAutoGenre(e.target.value)} placeholder="np. Taco Hemingway" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Data *</label>
              <input
                required
                type="date"
                className="fl-input w-full"
                value={form.data}
                onChange={(e) => {
                  const ad = autoDate(e.target.value);
                  setForm({ ...form, data: e.target.value, rok: ad.rok || form.rok, dzien: ad.dzien || form.dzien });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Dzień tygodnia</label>
              <input className="fl-input w-full" value={form.dzien} onChange={(e) => setForm({ ...form, dzien: e.target.value })} placeholder="piątek" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Godzina</label>
              <input className="fl-input w-full" value={form.godzina} onChange={(e) => setForm({ ...form, godzina: e.target.value })} placeholder="21:00" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Scena</label>
              <input className="fl-input w-full" value={form.scena} onChange={(e) => setForm({ ...form, scena: e.target.value })} placeholder="Main Stage" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Miejsce / Klub</label>
              <input className="fl-input w-full" value={form.miejsce} onChange={(e) => setForm({ ...form, miejsce: e.target.value })} placeholder="Cytadela" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Miasto *</label>
              <input required list="dlMiasto" className="fl-input w-full" value={form.miasto} onChange={(e) => setForm({ ...form, miasto: e.target.value })} placeholder="Poznań" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Kraj *</label>
              <input required list="dlKraj" className="fl-input w-full" value={form.kraj} onChange={(e) => setForm({ ...form, kraj: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Gatunek (auto ze Spotify)</label>
              <input list="dlGatunek" className="fl-input w-full" value={form.gatunek} onChange={(e) => setForm({ ...form, gatunek: e.target.value })} placeholder="Hip-Hop/Rap" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Z kim?</label>
              <input list="dlZKim" className="fl-input w-full" value={form.z_kim} onChange={(e) => setForm({ ...form, z_kim: e.target.value })} placeholder="Oliwki & Klopstegi" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Ocena</label>
              <select className="fl-input w-full" value={form.ocena} onChange={(e) => setForm({ ...form, ocena: Number(e.target.value) })}>
                <option value={0}>Brak oceny</option>
                <option value={5}>5 / 5 — Legendarny</option>
                <option value={4}>4 / 5 — Świetny</option>
                <option value={3}>3 / 5 — Dobry</option>
                <option value={2}>2 / 5 — Średni</option>
                <option value={1}>1 / 5 — Słaby</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cena biletu (PLN)</label>
              <input type="number" min={0} className="fl-input w-full" value={form.cena} onChange={(e) => setForm({ ...form, cena: e.target.value })} placeholder="350" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Uwagi</label>
              <input className="fl-input w-full" value={form.uwagi} onChange={(e) => setForm({ ...form, uwagi: e.target.value })} placeholder="Deszcz, bisy, gość specjalny..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setForm(emptyConcertForm); setKindTouched(false); onClearEditing(); }} className="fl-btn">
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
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Rodzaj wyjazdu
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {upForm.kind === "solowy"
                    ? "Koncert dedykowany jednemu artyście"
                    : "Występ w ramach festiwalu"}
                </div>
              </div>
              <div className="inline-flex shrink-0 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setUpKindTouched(true);
                    setUpForm((f) => ({ ...f, kind: "solowy" }));
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    upForm.kind === "solowy"
                      ? "bg-[var(--accent)] text-[var(--accent-ink,#fff)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Koncert solowy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUpKindTouched(true);
                    setUpForm((f) => ({ ...f, kind: "festiwal" }));
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    upForm.kind === "festiwal"
                      ? "bg-[#38bdf8] text-slate-950"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Festiwal
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Artysta *</label>
              <input required list="dlArtysta" className="fl-input w-full" value={upForm.artysta} onChange={(e) => setUpForm({ ...upForm, artysta: e.target.value })} placeholder="np. Fred Again.." />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Event / Festiwal *</label>
              <input
                required
                list="dlEvent"
                className="fl-input w-full"
                value={upForm.event}
                onChange={(e) => {
                  const val = e.target.value;
                  setUpForm((f) => ({
                    ...f,
                    event: val,
                    kind: upKindTouched ? f.kind : inferKindFromFields(val, f.artysta),
                  }));
                }}
                placeholder="np. Open’er Festival"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Data *</label>
              <input
                required
                type="date"
                className="fl-input w-full"
                value={upForm.data}
                onChange={(e) => {
                  const ad = autoDate(e.target.value);
                  setUpForm({ ...upForm, data: e.target.value, rok: ad.rok || upForm.rok, dzien: ad.dzien || upForm.dzien });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Godzina</label>
              <input className="fl-input w-full" value={upForm.godzina} onChange={(e) => setUpForm({ ...upForm, godzina: e.target.value })} placeholder="21:00" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Miasto *</label>
              <input required list="dlMiasto" className="fl-input w-full" value={upForm.miasto} onChange={(e) => setUpForm({ ...upForm, miasto: e.target.value })} placeholder="Gdynia" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Kraj *</label>
              <input required list="dlKraj" className="fl-input w-full" value={upForm.kraj} onChange={(e) => setUpForm({ ...upForm, kraj: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status biletu</label>
              <select className="fl-input w-full" value={upForm.status_biletu} onChange={(e) => setUpForm({ ...upForm, status_biletu: e.target.value })}>
                <option value="Kupiony">Kupiony</option>
                <option value="Do kupienia">Do kupienia</option>
                <option value="Zastanawiam się">Zastanawiam się</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cena biletu (PLN)</label>
              <input type="number" min={0} className="fl-input w-full" value={upForm.cena} onChange={(e) => setUpForm({ ...upForm, cena: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Plik biletu (PDF / QR)</label>
              <input type="file" accept=".pdf,image/*" className="fl-input w-full !py-2 text-xs" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Nocleg / Hotel</label>
              <input className="fl-input w-full" value={upForm.hotel} onChange={(e) => setUpForm({ ...upForm, hotel: e.target.value })} placeholder="np. Hotel Mercure Gdynia" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Dojazd / Lot / Nr rezerwacji</label>
              <input className="fl-input w-full" value={upForm.transport} onChange={(e) => setUpForm({ ...upForm, transport: e.target.value })} placeholder="np. PKP EIP 14:20" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Z kim?</label>
              <input list="dlZKim" className="fl-input w-full" value={upForm.z_kim} onChange={(e) => setUpForm({ ...upForm, z_kim: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Lista pakowania & Uwagi</label>
              <input className="fl-input w-full" value={upForm.uwagi} onChange={(e) => setUpForm({ ...upForm, uwagi: e.target.value })} placeholder="Peleryna, powerbank, zatyczki..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setUpForm(emptyUpcomingForm); setUpKindTouched(false); setTicketFile(null); }} className="fl-btn">
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
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("event")}>Event ↕</th>
                <th className="px-3 py-2.5">Rodzaj</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("miasto")}>Miasto ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("gatunek")}>Gatunek ↕</th>
                <th className="cursor-pointer px-3 py-2.5" onClick={() => toggleSort("z_kim")}>Ekipa ↕</th>
                <th className="px-3 py-2.5">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sortedDb.map((c) => {
                const kind = detectConcertKind(c, typeOverrides);
                return (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono">{c.data}</td>
                    <td className="px-3 py-2.5 font-semibold">{c.artysta}</td>
                    <td className="px-3 py-2.5">{c.event}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleToggleDbRowKind(c, "solowy")}
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
                          onClick={() => handleToggleDbRowKind(c, "festiwal")}
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
                    <td className="px-3 py-2.5">{c.miasto}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px]">
                        {c.gatunek || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-muted)]">{c.z_kim || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex gap-1">
                        <a href={setlistSearchUrl(c)} target="_blank" rel="noreferrer" className="fl-btn !px-2 !py-1 !text-[11px]">
                          Setlist <IconExternalLink size={12} stroke={1.75} />
                        </a>
                        <button type="button" onClick={() => onEditConcert(c)} className="fl-btn !p-1.5" title="Edytuj">
                          <IconEdit size={13} stroke={1.75} />
                        </button>
                        <button type="button" onClick={() => onDeleteConcert(c.id)} className="fl-btn fl-btn-danger !p-1.5" title="Usuń">
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
