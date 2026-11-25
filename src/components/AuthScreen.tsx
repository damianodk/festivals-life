import React, { useState } from "react";
import { motion } from "motion/react";
import { IconArrowRight, IconDeviceMobile } from "@tabler/icons-react";
import { getSupabase } from "../lib/supabase";
import { toast } from "sonner";

interface AuthScreenProps {
  onSuccess: (user: any) => void;
  onOfflineDemo: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onOfflineDemo }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPw("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Wpisz poprawny adres e-mail.");
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError("Brak konfiguracji Supabase. Użyj trybu lokalnego/demo.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        if (password !== confirmPw) {
          setError("Hasła nie są takie same.");
          setBusy(false);
          return;
        }
        const { data, error: err } = await sb.auth.signUp({ email: cleanEmail, password });
        if (err) {
          setError(err.message);
          return;
        }
        if (data.session && data.user) {
          toast.success("Konto utworzone! Witamy w FEST LIFE.");
          onSuccess(data.user);
        } else {
          switchMode("login");
          toast.success("Konto utworzone! Potwierdź e-mail (jeśli wymagane) i zaloguj się.");
        }
      } else {
        const { data, error: err } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
        if (err) {
          setError(err.message);
          return;
        }
        if (data.user) onSuccess(data.user);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-[var(--bg)] p-5">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[410px] rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface)] p-7"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)]">
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="font-display text-lg font-extrabold tracking-tight">FL</span>
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight">FEST LIFE</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {mode === "register"
                ? "Utwórz darmowe konto i zbuduj historię koncertów."
                : "Zaloguj się do swojej chmury koncertowej."}
            </p>
          </div>
        </div>

        {/* Standard Login | Register Segmented Control */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-lg py-2 font-display text-xs font-bold transition ${
              mode === "login"
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Zaloguj się
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-lg py-2 font-display text-xs font-bold transition ${
              mode === "register"
                ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Załóż konto
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              E-mail
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="twoj@email.com"
              className="fl-input w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Hasło
            </label>
            <input
              type="password"
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 znaków"
              className="fl-input w-full"
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Powtórz hasło
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Powtórz hasło"
                className="fl-input w-full"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="fl-btn fl-btn-primary mt-2 w-full !py-2.5"
          >
            <span>{busy ? "Chwileczkę..." : mode === "register" ? "Utwórz konto" : "Zaloguj się"}</span>
            <IconArrowRight size={16} stroke={1.75} />
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-[var(--text-muted)]">
          {mode === "login" ? "Nie masz jeszcze konta?" : "Masz już konto?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            {mode === "login" ? "Załóż konto" : "Zaloguj się"}
          </button>
        </div>

        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onOfflineDemo} className="fl-btn w-full !text-xs">
            <IconDeviceMobile size={15} stroke={1.75} />
            <span>Tryb lokalny / demo</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
