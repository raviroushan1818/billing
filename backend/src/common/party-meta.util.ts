export type PartyMetaInput = {
  age?: string;
  ageUnit?: string;
  gender?: string;
  careOf?: string;
  class?: string;
};

const GENDERS = new Set(['Male', 'Female', 'Other']);

export function compactPartyMeta(
  meta?: PartyMetaInput | Record<string, unknown> | null,
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
