import { Injectable } from '@angular/core';

/** Parses the delta lines of `de-plz.data.ts` ("<distance to the previous PLZ>\t<Ort>|<Ort>"). */
export function parsePlzData(data: string): Map<string, string[]> {
  const byPlz = new Map<string, string[]>();
  let plz = 0;
  for (const line of data.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    plz += Number(line.slice(0, tab));
    byPlz.set(String(plz).padStart(5, '0'), line.slice(tab + 1).split('|'));
  }
  return byPlz;
}

/**
 * German PLZ → Ort, for filling in the city as soon as a postal code is typed (#174).
 *
 * The list ships with the app (GeoNames, CC BY 4.0) and is refreshed every January by
 * `.github/workflows/plz-data.yml`. It sits in its own lazy chunk, about 64 KB, so only
 * a page that calls `preload` or `lookup` downloads it. A failed load resolves to "no
 * match": the Ort field simply stays manual.
 */
@Injectable({ providedIn: 'root' })
export class PlzService {
  private table?: Promise<Map<string, string[]>>;

  /** Starts the download in the background, so the first lookup is instant. */
  preload(): void {
    void this.load();
  }

  /** The Orte of a five-digit German PLZ, alphabetically; empty when unknown. */
  async lookup(plz: string): Promise<string[]> {
    if (!/^\d{5}$/.test(plz)) return [];
    return (await this.load()).get(plz) ?? [];
  }

  private load(): Promise<Map<string, string[]>> {
    this.table ??= import('../data/de-plz.data')
      .then(m => parsePlzData(m.DE_PLZ))
      .catch(() => {
        this.table = undefined; // try again on the next lookup
        return new Map<string, string[]>();
      });
    return this.table;
  }
}
