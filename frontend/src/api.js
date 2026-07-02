// Thin API layer + a small fetch hook used by the dashboard widgets.
// The dev server proxies /api to the Express backend (see vite.config.js).

import { useEffect, useState } from 'react';

async function getJson(path, params) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      // Backend error shape: { error: true, message, code, timestamp }.
      // Fall back to a string `error` field for older responses.
      if (body.message) message = body.message;
      else if (typeof body.error === 'string') message = body.error;
    } catch (_) {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  costOverview: (range) => getJson('/api/costs/overview', range),
  costByService: (range) => getJson('/api/costs/by-service', range),
  alerts: () => getJson('/api/alerts'),
  logicApps: () => getJson('/api/logicapps'),
};

/**
 * Generic data hook: runs `fetcher` on mount and whenever `deps` change.
 * @param {() => Promise<any>} fetcher
 * @param {Array<any>} deps
 * @returns {{ data: any, loading: boolean, error: string|null }}
 */
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((err) => active && setState({ data: null, loading: false, error: err.message }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

// Format a number as a currency amount.
export function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
