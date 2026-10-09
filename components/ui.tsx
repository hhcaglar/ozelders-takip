import clsx from "clsx";
import type { ReactNode } from "react";

export function Kart({
  baslik,
  altBaslik,
  sag,
  children,
  className,
}: {
  baslik?: string;
  altBaslik?: string;
  sag?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-xl border border-cizgi bg-yuzey shadow-sm", className)}>
      {(baslik || sag) && (
        <header className="flex items-start justify-between gap-4 border-b border-cizgi px-4 py-3">
          <div>
            {baslik && <h2 className="text-sm font-semibold">{baslik}</h2>}
            {altBaslik && <p className="mt-0.5 text-xs text-solgun">{altBaslik}</p>}
          </div>
          {sag}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type RozetTonu = "olumlu" | "uyari" | "kritik" | "bilgi" | "notr";

const ROZET_RENK: Record<RozetTonu, string> = {
  olumlu: "bg-emerald-50 text-emerald-700 border-emerald-200",
  uyari: "bg-amber-50 text-amber-700 border-amber-200",
  kritik: "bg-rose-50 text-rose-700 border-rose-200",
  bilgi: "bg-indigo-50 text-indigo-700 border-indigo-200",
  notr: "bg-slate-50 text-slate-600 border-slate-200",
};

export function Rozet({ ton = "notr", children }: { ton?: RozetTonu; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        ROZET_RENK[ton],
      )}
    >
      {children}
    </span>
  );
}

export function Ilerleme({ deger, renk = "#4f46e5" }: { deger: number; renk?: string }) {
  const y = Math.max(0, Math.min(100, deger * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${y}%`, background: renk }} />
    </div>
  );
}

export function Istatislik({
  etiket,
  deger,
  alt,
  ton = "notr",
}: {
  etiket: string;
  deger: string;
  alt?: string;
  ton?: RozetTonu;
}) {
  return (
    <div className="rounded-xl border border-cizgi bg-yuzey p-4">
      <p className="text-[11px] font-medium tracking-wide text-solgun uppercase">{etiket}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{deger}</p>
      {alt && (
        <p className="mt-1">
          <Rozet ton={ton}>{alt}</Rozet>
        </p>
      )}
    </div>
  );
}

export function Bos({ mesaj }: { mesaj: string }) {
  return (
    <div className="rounded-lg border border-dashed border-cizgi bg-zemin px-4 py-8 text-center text-sm text-solgun">
      {mesaj}
    </div>
  );
}

export function Buton({
  children,
  onClick,
  variant = "birincil",
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "birincil" | "ikincil" | "tehlike";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const stiller: Record<string, string> = {
    birincil: "bg-vurgu text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    ikincil: "border border-cizgi bg-yuzey text-murekkep hover:bg-zemin disabled:text-solgun",
    tehlike: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed",
        stiller[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Alan({
  etiket,
  children,
  ipucu,
}: {
  etiket: string;
  children: ReactNode;
  ipucu?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-solgun">{etiket}</span>
      {children}
      {ipucu && <span className="mt-1 block text-[11px] text-solgun">{ipucu}</span>}
    </label>
  );
}

export const girisSinifi =
  "w-full rounded-lg border border-cizgi bg-yuzey px-3 py-2 text-sm outline-none transition focus:border-vurgu focus:ring-2 focus:ring-indigo-100";
