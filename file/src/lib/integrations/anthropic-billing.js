/**
 * Anthropic Admin API integration for cost reporting.
 * Requires ANTHROPIC_ADMIN_API_KEY.
 */

export function isAnthropicBillingConfigured() {
  return !!process.env.ANTHROPIC_ADMIN_API_KEY;
}

/**
 * Fetch Anthropic cost report for a date range.
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @returns {Array<{ id: string, model: string, description: string, amount: number }>}
 */
export async function getAnthropicCostReport(startDate, endDate) {
  const apiKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const res = await fetch(
      `https://api.anthropic.com/v1/organizations/usage?${params.toString()}`,
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      return [];
    }

    const data = await res.json();

    // Handle the response — the API may return per-model breakdowns or a total
    if (data.data && Array.isArray(data.data)) {
      return data.data
        .filter((item) => Number(item.cost || item.amount || 0) > 0)
        .map((item) => ({
          id: `anthropic-${item.model || 'total'}-${startDate}`,
          model: item.model || 'All Models',
          description: `Anthropic API — ${item.model || 'Total usage'} (${startDate} to ${endDate})`,
          amount: Number(item.cost || item.amount || 0),
        }));
    }

    // Fallback: single total
    if (data.total_cost !== undefined || data.cost !== undefined) {
      const amount = Number(data.total_cost || data.cost || 0);
      if (amount > 0) {
        return [{
          id: `anthropic-total-${startDate}-${endDate}`,
          model: 'All Models',
          description: `Anthropic API usage — ${startDate} to ${endDate}`,
          amount,
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
