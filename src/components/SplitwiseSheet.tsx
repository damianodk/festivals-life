import React, { useMemo, useState } from "react";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import type { Concert, TripExpense } from "../types";
import { BottomSheet } from "./ui/BottomSheet";

interface SplitwiseSheetProps {
  eventKey: string | null;
  onClose: () => void;
  allConcerts: Concert[];
  tripExpenses: TripExpense[];
  onAddExpense: (row: { event_key: string; title: string; amount_pln: number; paid_by: string }) => Promise<void>;
  onDeleteExpense: (id: number) => Promise<void>;
}

const SW_PARTICIPANTS_KEY = "fest_life_sw_participants_v1";

export const SplitwiseSheet: React.FC<SplitwiseSheetProps> = ({
  eventKey,
  onClose,
  allConcerts,
  tripExpenses,
  onAddExpense,
  onDeleteExpense
}) => {
  const [participantsMap, setParticipantsMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(SW_PARTICIPANTS_KEY) || "{}"); } catch { return {}; }
  });
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("Damian");

  const defaultParticipants = useMemo(() => {
    if (!eventKey) return "Damian";
    if (participantsMap[eventKey] !== undefined) return participantsMap[eventKey];
    const crews = new Set<string>(["Damian"]);
    allConcerts
      .filter((c) => `${c.event || "Koncert"}|${c.rok || "?"}` === eventKey && c.z_kim)
      .forEach((c) => {
        c.z_kim.split(/[,&]+/).map((s) => s.trim()).filter(Boolean).forEach((p) => crews.add(p));
      });
    return [...crews].join(", ");
  }, [eventKey, participantsMap, allConcerts]);

  const items = useMemo(
    () => (eventKey ? tripExpenses.filter((x) => x.event_key === eventKey) : []),
    [eventKey, tripExpenses]
  );

  const settlement = useMemo(() => {
    const raw = defaultParticipants.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
    const people = [...new Set(raw)];
    items.forEach((x) => {
      const pb = (x.paid_by || "").trim();
      if (pb && !people.includes(pb)) people.push(pb);
    });
    const total = items.reduce((s, x) => s + Number(x.amount_pln || 0), 0);
    if (people.length < 2 || !items.length) return { total, people, perPerson: 0, transfers: [] as { from: string; to: string; amount: number }[] };

    const perPerson = total / people.length;
    const paid: Record<string, number> = {};
    people.forEach((p) => { paid[p] = 0; });
    items.forEach((x) => {
      const pb = (x.paid_by || "").trim();
      if (pb) paid[pb] = (paid[pb] || 0) + Number(x.amount_pln || 0);
    });

    const debtors: { name: string; amt: number }[] = [];
    const creditors: { name: string; amt: number }[] = [];
    people.forEach((p) => {
      const bal = +(paid[p] - perPerson).toFixed(2);
      if (bal < -0.01) debtors.push({ name: p, amt: -bal });
      else if (bal > 0.01) creditors.push({ name: p, amt: bal });
    });
    debtors.sort((a, b) => b.amt - a.amt);
    creditors.sort((a, b) => b.amt - a.amt);

    const transfers: { from: string; to: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const pay = Math.min(d.amt, c.amt);
      if (pay > 0.01) transfers.push({ from: d.name, to: c.name, amount: pay });
      d.amt = +(d.amt - pay).toFixed(2);
      c.amt = +(c.amt - pay).toFixed(2);
      if (d.amt <= 0.01) i++;
      if (c.amt <= 0.01) j++;
    }
    return { total, people, perPerson, transfers };
  }, [items, defaultParticipants]);

  const updateParticipants = (val: string) => {
    if (!eventKey) return;
    const next = { ...participantsMap, [eventKey]: val };
    setParticipantsMap(next);
    localStorage.setItem(SW_PARTICIPANTS_KEY, JSON.stringify(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventKey || !title.trim() || !amount) return;
    await onAddExpense({
      event_key: eventKey,
      title: title.trim(),
      amount_pln: Number(amount),
      paid_by: paidBy.trim() || "Damian"
    });
    setTitle("");
    setAmount("");
  };

  const [evName, evYear] = (eventKey || "|").split("|");

  return (
    <BottomSheet
      open={!!eventKey}
      onOpenChange={(o) => !o && onClose()}
      title={`Rozliczenie: ${evName} (${evYear})`}
      description="Podział kosztów wyjazdowych — kto komu ile wisi"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Uczestnicy wyjazdu (po przecinku)
          </label>
          <input
            className="fl-input w-full"
            value={defaultParticipants}
            onChange={(e) => updateParticipants(e.target.value)}
            placeholder="Damian, Oliwki, Klopstegi"
          />
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            required
            className="fl-input col-span-2 sm:col-span-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Wydatek (np. Nocleg, Paliwo)"
          />
          <input
            required
            type="number"
            min="1"
            step="0.01"
            className="fl-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Kwota PLN"
          />
          <input
            required
            className="fl-input"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            placeholder="Kto płacił?"
          />
          <button type="submit" className="fl-btn fl-btn-primary col-span-2 sm:col-span-1">
            <IconPlus size={15} stroke={1.75} /> Dodaj
          </button>
        </form>

        <div className="font-mono text-xs text-[var(--accent)]">
          Łącznie: <strong className="tabular-nums">{settlement.total.toFixed(2)} PLN</strong>
        </div>

        {items.length > 0 && settlement.people.length >= 2 && (
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-3.5">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Podział ({settlement.people.length} os. • po {settlement.perPerson.toFixed(2)} PLN / os.)
            </div>
            {settlement.transfers.length > 0 ? (
              <div className="space-y-1.5">
                {settlement.transfers.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>
                      <strong>{t.from}</strong> → <strong>{t.to}</strong>
                    </span>
                    <span className="font-mono font-bold text-[var(--accent)] tabular-nums">
                      {t.amount.toFixed(2)} PLN
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-emerald-400">Wszystko rozliczone po równo!</div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {items.map((x) => (
            <div
              key={x.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5"
            >
              <div>
                <div className="text-sm font-semibold">{x.title}</div>
                <div className="text-xs text-[var(--text-muted)]">Płacił: {x.paid_by}</div>
              </div>
              <div className="flex items-center gap-2">
                <strong className="font-mono text-sm tabular-nums">{Number(x.amount_pln).toFixed(2)} zł</strong>
                <button
                  type="button"
                  onClick={() => onDeleteExpense(x.id)}
                  className="fl-btn fl-btn-danger !p-1.5"
                >
                  <IconTrash size={14} stroke={1.75} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-4 text-center text-xs text-[var(--text-muted)]">
              Brak wydatków dla tego wydarzenia.
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
