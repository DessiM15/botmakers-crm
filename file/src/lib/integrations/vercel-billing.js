/**
 * Vercel Billing API integration.
 * Requires VERCEL_API_TOKEN and optionally VERCEL_TEAM_ID.
 */

export function isVercelBillingConfigured() {
  return !!process.env.VERCEL_API_TOKEN;
}

/**
 * Fetch Vercel billing charges for a date range.
 * @param {string} from - ISO date string (YYYY-MM-DD)
 * @param {string} to - ISO date string (YYYY-MM-DD)
 * @returns {Array<{ id: string, name: string, description: string, amount: number }>}
 */
export async function getVercelCharges(from, to) {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return [];

  try {
    const params = new URLSearchParams();
    if (from) params.set('from', new Date(from).getTime().toString());
    if (to) params.set('to', new Date(to).getTime().toString());

    const teamId = process.env.VERCEL_TEAM_ID;
    if (teamId) params.set('teamId', teamId);

    const res = await fetch(
      `https://api.vercel.com/v1/billing/usage?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();

    // Vercel billing API returns usage data; normalize to cost entries
    // The exact response shape depends on the plan — handle gracefully
    if (data.charges && Array.isArray(data.charges)) {
      return data.charges.map((charge) => ({
        id: charge.id || `vercel-${charge.resourceId || charge.name}-${from}`,
        name: charge.name || charge.resourceId || 'Vercel Usage',
        description: charge.description || `Vercel ${charge.name || 'charge'}`,
        amount: Number(charge.amount || charge.total || 0) / 100, // Convert cents to dollars
      }));
    }

    // Fallback: return the total as a single entry
    if (data.totalAmount !== undefined || data.amount !== undefined) {
      const amount = Number(data.totalAmount || data.amount || 0) / 100;
      if (amount > 0) {
        return [{
          id: `vercel-total-${from}-${to}`,
          name: 'Vercel',
          description: `Vercel usage — ${from} to ${to}`,
          amount,
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
