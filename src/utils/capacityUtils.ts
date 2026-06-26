export interface ParsedCapacity {
  normalized?: string; // e.g. "5 kW"
  value?: number; // numeric value when parse succeeds
  unit?: string; // normalized unit, default 'kW'
  raw: string; // original input
}

// Parse free-form capacity strings into a normalized value + unit
export const parseCapacity = (input?: string | null): ParsedCapacity | null => {
  if (!input) return null;
  const raw = (input || "").toString().trim();
  if (!raw) return null;
  // Strategy:
  // 1) Collect all numeric tokens and their nearby units
  // 2) Prefer values that explicitly mention kW/kWp (or values inside parentheses)
  // 3) Otherwise pick the largest inferred kW value
  // 4) If no kW tokens and only module-watt values (e.g. "560 W") but product_description is descriptive,
  //    return the raw string to preserve context.

  // Find parenthetical ranges to mark tokens inside parentheses
  const parenRanges: Array<[number, number]> = [];
  const parenRegex = /\(([^)]+)\)/g;
  let pm;
  while ((pm = parenRegex.exec(raw)) !== null) {
    parenRanges.push([pm.index, pm.index + pm[0].length]);
  }

  const tokenRegex = /([0-9]+(?:[.,][0-9]+)?)\s*(kW|kWp|KW|kw|kWp|W|w|kva|KVA|kVA)?/gi;
  const tokens: Array<{
    value: number;
    unit?: string | null;
    index: number;
    inParen: boolean;
    rawMatch: string;
  }> = [];

  let m;
  while ((m = tokenRegex.exec(raw)) !== null) {
    const numStr = (m[1] || '').replace(',', '.');
    const n = parseFloat(numStr);
    if (Number.isNaN(n)) continue;
    const unitRaw = m[2] || null;
    const idx = m.index;
    const inParen = parenRanges.some(([s, e]) => idx >= s && idx <= e);
    tokens.push({ value: n, unit: unitRaw, index: idx, inParen, rawMatch: m[0] });
  }

  if (tokens.length === 0) return { raw };

  // Normalize unit and compute equivalent kW value for comparison
  const normalizedTokens = tokens.map(t => {
    const unitRaw = (t.unit || '').toString().toLowerCase();
    let unit: string | null = null;
    if (unitRaw.includes('kwp')) unit = 'kWp';
    else if (unitRaw.includes('kw')) unit = 'kW';
    else if (unitRaw.includes('kva')) unit = 'kVA';
    else if (unitRaw === 'w') unit = 'W';
    // default: unknown unit (treat as number of watts? keep null)

    let valueKW: number;
    if (unit === 'W') valueKW = t.value / 1000;
    else valueKW = t.value; // kW/kWp/kVA treated as kW-equivalent for selection purposes

    return { ...t, unit, valueKW };
  });

  // Selection logic
  const kWTokens = normalizedTokens.filter(t => t.unit === 'kW' || t.unit === 'kWp');
  const parenTokens = normalizedTokens.filter(t => t.inParen);

  let chosen = null as any;
  if (kWTokens.length > 0) {
    // Prefer kW tokens; if any in parens prefer those, else pick largest kW-equivalent
    const parenKW = kWTokens.filter(t => t.inParen);
    const pool = parenKW.length > 0 ? parenKW : kWTokens;
    chosen = pool.reduce((a, b) => (b.valueKW > a.valueKW ? b : a));
  } else if (parenTokens.length > 0) {
    // No explicit kW tokens but parenthetical values exist - pick largest
    chosen = parenTokens.reduce((a, b) => (b.valueKW > a.valueKW ? b : a));
  } else {
    // Fallback: pick largest inferred kW-equivalent value
    chosen = normalizedTokens.reduce((a, b) => (b.valueKW > a.valueKW ? b : a));
  }

  if (!chosen) return { raw };

  // If chosen token is in W and there were no kW tokens and no parentheses, prefer to return raw descriptive string
  if (chosen.unit === 'W' && kWTokens.length === 0 && !chosen.inParen && raw.length > chosen.rawMatch.length + 10) {
    // raw seems more descriptive than a lone watt value, return raw
    return { raw };
  }

  // Prepare normalized display in kW where appropriate
  const displayKW = chosen.valueKW;
  const normalizedNumber = displayKW % 1 === 0 ? displayKW.toFixed(0) : Number(displayKW.toFixed(2));
  const normalized = `${normalizedNumber} kW`;

  return {
    normalized,
    value: displayKW,
    unit: 'kW',
    raw,
  };
};
