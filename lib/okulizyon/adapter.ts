import type { Ogrenci, SinavTuru } from "../types";
import type { BaglantiAyari } from "../types";
import type { HamKarne } from "./parse";
import { demoAdapter } from "./demo";
import { httpAdapter } from "./http";

export interface SenkronBaglami {
  ogrenci: Ogrenci;
  ogrenciId: string;
  sinavTuru: SinavTuru;
  ayar: BaglantiAyari;
  /** Şifre yalnızca bellekte tutulur, diske yazılmaz. */
  sifre?: string;
  sinavSayisi?: number;
}

export interface SenkronSonucu {
  karneler: HamKarne[];
  mesaj: string;
}

export interface OkulizyonAdapter {
  ad: string;
  senkron(baglam: SenkronBaglami): Promise<SenkronSonucu>;
}

export function adapterSec(ayar: BaglantiAyari): OkulizyonAdapter {
  return ayar.mod === "http" ? httpAdapter : demoAdapter;
}
