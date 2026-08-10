// IdleResources - "Idle Resource Hunter". Headlines total monthly waste from
// orphaned/idle resources and lists each finding with an estimated cost and a
// suggested action. Findings can be selected and permanently destroyed (after
// an explicit confirmation) so their recurring cost stops.

import React, { useState } from 'react';

import { api, useFetch, formatCurrency } from '../api';

const TYPE_STYLES = {
  'Unattached Disk': 'bg-amber-100 text-amber-700',
  'Idle VM': 'bg-red-100 text-red-700',
  'Deallocated VM': 'bg-orange-100 text-orange-700',
  'Unassociated Public IP': 'bg-sky-100 text-sky-700',
  'Stale Snapshot': 'bg-violet-100 text-violet-700',
};

function TypeBadge({ type }) {
  const cls = TYPE_STYLES[type] || 'bg-gray-100 text-gray-600';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{type}</span>;
}

function checkbox(checked, onChange, label) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-red-600 accent-red-600"
    />
  );
}

export default function IdleResources() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useFetch(() => api.idleResources(), [reloadKey]);

  const [selected, setSelected] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [understandChecked, setUnderstandChecked] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const [result, setResult] = useState(null);
  const [destroyError, setDestroyError] = useState(null);

  const findings = data?.findings || [];
  const allSelected = findings.length > 0 && selected.size === findings.length;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(findings.map((f) => f.id)));
  }

  const selectedFindings = findings.filter((f) => selected.has(f.id));
  const selectedWaste = selectedFindings.reduce((sum, f) => sum + (f.monthlyCost || 0), 0);

  function openConfirm() {
    setResult(null);
    setDestroyError(null);
    setUnderstandChecked(false);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (destroying) return;
    setConfirmOpen(false);
  }

  async function runDestroy() {
    setDestroying(true);
    setDestroyError(null);
    try {
      const res = await api.idleDestroy(
        selectedFindings.map((f) => ({
          id: f.id,
          type: f.type,
          name: f.name,
          monthlyCost: f.monthlyCost,
        }))
      );
      setResult(res);
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } catch (err) {
      setDestroyError(err.message);
    } finally {
      setDestroying(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧹</span>
          <h2 className="text-lg font-semibold text-gray-800">Idle Resource Hunter</h2>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-sm text-gray-500">
              <span className="text-2xl font-bold text-red-600">
                {formatCurrency(data.totalMonthlyWaste, data.currency)}
              </span>{' '}
              /mo in potential waste · {data.findingCount} findings
            </span>
          )}
          {data && findings.length > 0 && (
            <button
              type="button"
              onClick={openConfirm}
              disabled={selected.size === 0}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              Destroy selected ({selected.size})
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Scanning resources…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && findings.length === 0 && (
        <p className="text-sm text-gray-500">No idle resources found. 🎉</p>
      )}

      {data && Object.keys(data.byType || {}).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {Object.entries(data.byType).map(([type, info]) => (
            <span
              key={type}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600"
            >
              {type}: {info.count} · {formatCurrency(info.monthlyCost, data.currency)}/mo
            </span>
          ))}
        </div>
      )}

      {findings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                <th className="w-8 py-2 pr-2">
                  {checkbox(allSelected, toggleAll, 'Select all resources')}
                </th>
                <th className="py-2 pr-4">Resource</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Why</th>
                <th className="py-2 pr-4 text-right">Est. $/mo</th>
                <th className="py-2">Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className={`border-b border-gray-100 align-top ${selected.has(f.id) ? 'bg-red-50/50' : ''}`}>
                  <td className="py-2 pr-2">
                    {checkbox(selected.has(f.id), () => toggle(f.id), `Select ${f.name}`)}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-gray-800">{f.name}</div>
                    <div className="text-xs text-gray-400">{f.resourceGroup} · {f.region}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <TypeBadge type={f.type} />
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{f.reason}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-gray-900">
                    {formatCurrency(f.monthlyCost, f.currency)}
                  </td>
                  <td className="py-2 text-gray-500">{f.actionHint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <p className="mt-3 text-xs text-gray-400">
          Costs are estimated from list prices and are for guidance only. Destroying a VM also
          deletes its managed disks.
        </p>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800">
              Destroy {selectedFindings.length} resource{selectedFindings.length === 1 ? '' : 's'}?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This permanently deletes the resources below and their data. This cannot be undone.
            </p>

            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
              {selectedFindings.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <TypeBadge type={f.type} />
                    <span className="truncate font-medium text-gray-800">{f.name}</span>
                    <span className="text-xs text-gray-400">{f.resourceGroup}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-gray-900">
                    {formatCurrency(f.monthlyCost, f.currency)}/mo
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-sm text-gray-600">
              Estimated savings: <span className="font-bold text-green-700">{formatCurrency(selectedWaste)}/mo</span>
            </p>

            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
              {checkbox(understandChecked, () => setUnderstandChecked((v) => !v), 'I understand the risks')}
              <span>I understand these resources and their data will be permanently deleted.</span>
            </label>

            {destroyError && <p className="mt-3 text-sm text-red-600">{destroyError}</p>}

            {result && (
              <div className="mt-3 rounded border border-gray-200 p-3 text-sm">
                <p className="font-semibold text-gray-800">
                  {result.succeeded.length} destroyed, {result.failed.length} failed
                  {result.totalPotentialMonthlySavings > 0 && (
                    <span className="ml-2 font-bold text-green-700">
                      · saves {formatCurrency(result.totalPotentialMonthlySavings)}/mo
                    </span>
                  )}
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
                disabled={destroying}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={runDestroy}
                  disabled={!understandChecked || destroying}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {destroying ? 'Destroying…' : `Destroy ${selectedFindings.length} resource${selectedFindings.length === 1 ? '' : 's'}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
