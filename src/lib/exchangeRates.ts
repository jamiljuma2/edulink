let cachedKesRate: { value: number; expiresAt: number } | null = null;
const RATE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;

export async function getUsdToKesRate(): Promise<number> {
  const now = Date.now();
  if (cachedKesRate && cachedKesRate.expiresAt > now) {
    return cachedKesRate.value;
  }

  const fallback = Number(process.env.USD_KES_FALLBACK_RATE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    const rate = Number(json?.rates?.KES);
    if (!res.ok || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('Invalid exchange rate response');
    }
    cachedKesRate = { value: rate, expiresAt: now + RATE_TTL_MS };
    return rate;
  } catch {
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    if (cachedKesRate) return cachedKesRate.value;
    throw new Error('Unable to resolve USD/KES exchange rate.');
  } finally {
    clearTimeout(timer);
  }
}

export function convertUsdToKes(amountUsd: number, rate: number): number {
  if (!Number.isFinite(amountUsd) || !Number.isFinite(rate)) return 0;
  return Math.max(0, Math.round(amountUsd * rate));
}
