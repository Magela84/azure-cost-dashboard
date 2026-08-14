// RightSize - "Right-Sizing Recommendations". Uses utilization (CPU/memory)
// to flag VMs that are over- or under-provisioned, shows the estimated monthly
// cost impact of the recommended size, and lets you apply a downsize resize
// directly (with the same confirmation safety as the VM Scaling card).

import React, { useState } from 'react';

import { api, useFetch, formatCurrency } from '../api';

function UtilPct({ label, value }) {
  const color =
    value >= 85 ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2" title={`${label} utilization`}>
      <span className="w-9 text-right text-xs text-gray-500">{label}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600">{value}%</span>
    </div>
  );
}

function DirectionBadge({ direction }) {
  if (direction === 'down') {
    return (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
        ▼ downsize
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
      ▲ upsize
    </span>
  );
}

export default function RightSize({ canOperate = true }) {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useFetch(() => api.rightsize(), [reloadKey]);

  const [pending, setPending] = useState(null); // recommendation awaiting confirmation
  const [understandChecked, setUnderstandChecked] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [applyError, setApplyError] = useState(null);

  const recommendations = data?.recommendations || [];

  function openConfirm(rec) {
    if (!canOperate) return;
    setResult(null);
    setApplyError(null);
    setUnderstandChecked(false);
    setPending(rec);
  }

  function closeConfirm() {
    if (applying) return;
    setPending(null);
  }

  async function runApply() {
    if (!pending) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await api.scaleVms([
        { id: pending.id, targetSize: pending.recommendedSize, currentSize: pending.currentSize },
      ]);
      setResult(res);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📉</span>
          <h2 className="text-lg font-semibold text-gray-800">Right-Sizing Recommendations</h2>
        </div>
        {data && (
          <span className="text-sm text-gray-500">
            Up to{' '}
            <span className="text-2xl font-bold text-emerald-600">
              {formatCurrency(data.totalMonthlySavings, data.currency)}
            </span>
            /mo in potential savings · {data.count} VMs
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Analyzing utilization…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && recommendations.length === 0 && (
        <p className="text-sm text-gray-500">No right-sizing opportunities found. 🎉</p>
      )}

      {data && data.totalMonthlyCostRisk > 0 && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          ⚠️ {data.recommendations.filter((r) => r.direction === 'up').length} VM
          {data.recommendations.filter((r) => r.direction === 'up').length === 1 ? '' : 's'} at risk
          of under-provisioning (utilization above 85%).
        </p>
      )}

      {recommendations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                <th className="py-2 pr-4">Virtual Machine</th>
                <th className="py-2 pr-4">Recommendation</th>
                <th className="py-2 pr-4">Utilization (14-day avg)</th>
                <th className="py-2 pr-4 text-right">$ /mo</th>
                <th className="py-2 pr-4 text-right">Impact</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((r) => {
                const isDown = r.direction === 'down';
                return (
                  <tr key={r.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-800">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.resourceGroup} · {r.region}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <DirectionBadge direction={r.direction} />
                      </div>
                      <div className="mt-1 text-gray-700">
                        {r.currentSize} <span className="text-gray-400">→</span>{' '}
                        <span className="font-semibold text-gray-900">{r.recommendedSize}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        est. utilization after: {r.estimatedUtilAfterPct}%
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <UtilPct label="CPU" value={r.avgCpuPct} />
                      <UtilPct label="Mem" value={r.avgMemoryPct ?? 0} />
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">
                      {formatCurrency(r.monthlyCost, data.currency)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {isDown ? (
                        <span className="font-semibold text-emerald-700">
                          −{formatCurrency(Math.abs(r.monthlySavings), data.currency)}
                        </span>
                      ) : (
                        <span className="font-semibold text-red-700">
                          +{formatCurrency(Math.abs(r.monthlySavings), data.currency)}
                        </span>
                      )}
                      <div className="text-xs text-gray-400">/mo</div>
                    </td>
                    <td className="py-2 text-right">
                      {isDown ? (
                        <button
                          type="button"
                          onClick={() => openConfirm(r)}
                          disabled={!canOperate}
                          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                        >
                          {canOperate ? `Resize to ${r.recommendedSize}` : 'Read-only'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <p className="mt-3 text-xs text-gray-400">
          Based on the last 14 days of Azure Monitor utilization (CPU + memory) and
          pay-as-you-go list prices — guidance only. Applying a resize may briefly restart
          the VM.
        </p>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800">
              Resize {pending.name} to {pending.recommendedSize}?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {pending.currentSize} →{' '}
              <span className="font-semibold text-gray-900">{pending.recommendedSize}</span>{' '}
              saves{' '}
              <span className="font-bold text-emerald-700">
                {formatCurrency(pending.monthlySavings, data.currency)}
              </span>{' '}
              per month based on current utilization.
            </p>
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              Resizing may briefly restart the VM if the new size isn't available while it's
              running. The VM's data is preserved.
            </p>

            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                aria-label="I understand the VM may restart"
                checked={understandChecked}
                onChange={(e) => setUnderstandChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-emerald-600"
              />
              <span>I understand the VM may restart, and I want to apply this resize.</span>
            </label>

            {applyError && <p className="mt-3 text-sm text-red-600">{applyError}</p>}

            {result && (
              <div className="mt-3 rounded border border-gray-200 p-3 text-sm">
                <p className="font-semibold text-gray-800">
                  {result.succeeded.length} resized, {result.failed.length} failed
                </p>
                {result.failed.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-0.5 text-red-600">
                    {result.failed.map((f, i) => (
                      <li key={i}>{f.name || f.id}: {f.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={applying}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={runApply}
                  disabled={!understandChecked || applying}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {applying ? 'Resizing…' : 'Apply resize'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
