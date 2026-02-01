export async function getUsdToKesRate(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    const rate = Number(json?.rates?.KES);
    if (!res.ok || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('Invalid exchange rate response');
    }
    return rate;
  } catch (err) {
    const fallback = Number(process.env.USD_KES_FALLBACK_RATE);
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    throw err;
  }
}

export function convertUsdToKes(amountUsd: number, rate: number): number {
  if (!Number.isFinite(amountUsd) || !Number.isFinite(rate)) return 0;
  return Math.max(0, Math.round(amountUsd * rate));
}
