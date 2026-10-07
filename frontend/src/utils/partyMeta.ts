export type PartyMeta = {
  age?: string;
  ageUnit?: 'Y' | 'M';
  gender?: 'Male' | 'Female' | 'Other' | '';
  careOf?: string;
  class?: string;
};

const GENDERS = new Set(['Male', 'Female', 'Other']);

export function compactPartyMeta(
  meta?: PartyMeta | Record<string, unknown> | null,
): Record<string, string> {
  if (!meta || typeof meta !== 'object') return {};
  const src = meta as Record<string, unknown>;
  const out: Record<string, string> = {};
  const age = String(src.age ?? '').trim();
  if (age) out.age = age;
  const unit = String(src.ageUnit ?? '').trim().toUpperCase();
  if (unit === 'M' || unit === 'Y') out.ageUnit = unit;
  const gender = String(src.gender ?? '').trim();
  if (GENDERS.has(gender)) out.gender = gender;
  const careOf = String(src.careOf ?? '').trim();
  if (careOf) out.careOf = careOf;
  const klass = String(src.class ?? '').trim();
  if (klass) out.class = klass;
  return out;
}

export function readPartyMeta(
  ...sources: Array<Record<string, unknown> | null | undefined>
): PartyMeta {
  const merged: Record<string, unknown> = {};
  for (const src of sources) {
    if (src && typeof src === 'object') Object.assign(merged, src);
  }
  const compact = compactPartyMeta(merged);
  return {
    age: compact.age ?? '',
    ageUnit: compact.ageUnit === 'M' ? 'M' : 'Y',
    gender: (compact.gender as PartyMeta['gender']) ?? '',
    careOf: compact.careOf ?? '',
    class: compact.class ?? '',
  };
}

export function formatPartyMetaLines(meta: unknown): string[] {
  const m = compactPartyMeta(meta as Record<string, unknown>);
  const lines: string[] = [];
  const ageSex: string[] = [];
  if (m.age) {
    const unit = m.ageUnit === 'M' ? 'M' : 'Y';
    ageSex.push(`Age ${m.age} ${unit}`);
  }
  if (m.gender) ageSex.push(m.gender);
  if (ageSex.length) lines.push(ageSex.join(' / '));
  if (m.careOf) lines.push(`C/O ${m.careOf}`);
  if (m.class) lines.push(`Class ${m.class}`);
  return lines;
}
