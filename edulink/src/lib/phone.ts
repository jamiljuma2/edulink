export function normalizeKenyanPhone(rawPhone: string): string | null {
  const cleaned = String(rawPhone ?? '').trim().replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (!cleaned) return null;

  let digits = cleaned;
  if (/^0\d{9}$/.test(digits)) {
    digits = `254${digits.slice(1)}`;
  } else if (/^(7|1)\d{8}$/.test(digits)) {
    digits = `254${digits}`;
  }

  if (!/^254(7\d{8}|1\d{8})$/.test(digits)) {
    return null;
  }

  return digits;
}
