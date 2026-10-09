"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendNokta } from "@/lib/analysis";

const EKSEN = { fontSize: 11, fill: "#667085" } as const;
const IZGARA = "#e4e7ec";

export function NetTrendGrafigi({
  veri,
  hedefNet,
}: {
  veri: TrendNokta[];
  hedefNet?: number | null;
}) {
  const hazir = veri.map((v) => ({ ...v, etiket: v.baslik.replace(/\s+/g, " ").slice(0, 22) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={hazir} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={IZGARA} vertical={false} />
        <XAxis dataKey="etiket" tick={EKSEN} tickLine={false} axisLine={{ stroke: IZGARA }} />
        <YAxis tick={EKSEN} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${IZGARA}` }}
          formatter={(deger, ad) => [
            `${Number(deger).toFixed(2)} net`,
            ad === "net" ? "Toplam net" : String(ad),
          ]}
        />
        {hedefNet ? (
          <ReferenceLine
            y={hedefNet}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: `hedef ${hedefNet.toFixed(0)}`, fontSize: 10, fill: "#ef4444", position: "insideTopRight" }}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey="net"
          stroke="#4f46e5"
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: "#4f46e5" }}
          activeDot={{ r: 5 }}
        />
        <Line type="monotone" dataKey="yanlis" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
        <Line type="monotone" dataKey="bos" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DersNetGrafigi({
  veri,
  dersler,
}: {
  veri: Record<string, number | string>[];
  dersler: { ad: string; renk: string }[];
}) {
  const hazir = veri.map((v) => ({ ...v, etiket: String(v.baslik).slice(0, 18) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={hazir} margin={{ top: 8, right: 16, bottom: 0, left: -18 }} barGap={2}>
        <CartesianGrid stroke={IZGARA} vertical={false} />
        <XAxis dataKey="etiket" tick={EKSEN} tickLine={false} axisLine={{ stroke: IZGARA }} />
        <YAxis tick={EKSEN} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${IZGARA}` }}
          formatter={(deger, ad) => [`${Number(deger).toFixed(2)} net`, String(ad)]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {dersler.map((d) => (
          <Bar key={d.ad} dataKey={d.ad} fill={d.renk} radius={[3, 3, 0, 0]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UstalikGrafigi({
  veri,
}: {
  veri: { ad: string; ustalik: number; kritik: number; toplam: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, veri.length * 46)}>
      <BarChart data={veri} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={IZGARA} horizontal={false} />
        <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `%${v * 100}`} tick={EKSEN} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="ad" width={110} tick={EKSEN} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${IZGARA}` }}
          formatter={(deger, ad) =>
            ad === "ustalik"
              ? [`%${Math.round(Number(deger) * 100)}`, "Ustalık"]
              : [String(Number(deger)), ad === "kritik" ? "Kritik kazanım" : "Ölçülen kazanım"]
          }
        />
        <Bar dataKey="ustalik" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {veri.map((v) => (
            <Cell
              key={v.ad}
              fill={v.ustalik >= 0.75 ? "#10b981" : v.ustalik >= 0.5 ? "#f59e0b" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
