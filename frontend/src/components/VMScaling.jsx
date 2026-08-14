// VMScaling - "VM Scale" card. Lists every VM with its current size and the
// sizes Azure makes available, so you can resize up or down. Each row offers a
// target size; scaling requires an explicit confirmation (resizing may briefly
// restart a running VM).

import React, { useState } from 'react';

import { api, useFetch } from '../api';

function formatSize(size) {
  if (!size) return '—';
  return `${size.name} (${size.cores} vCPU / ${size.memoryGB} GB)`;
}

// Which direction a candidate size sits relative to the VM's current size:
// 'current', 'up' (bigger) or 'down' (smaller), based on its position in the
// available-sizes list (which the backend sorts by size, low to high).
function sizeDirection(vm, sizeName) {
  const current = vm.availableSizes.findIndex((s) => s.name === vm.currentSize);
  const target = vm.availableSizes.findIndex((s) => s.name === sizeName);
  if (current < 0 || target < 0 || current === target) return 'current';
  return target > current ? 'up' : 'down';
}

const DIR_INDICATOR = {
  up: '▲',
  down: '▼',
  current: '',
};

function canGoUp(vm) {
  return vm.availableSizes.some((s) => sizeDirection(vm, s.name) === 'up');
}

function canGoDown(vm) {
  return vm.availableSizes.some((s) => sizeDirection(vm, s.name) === 'down');
}

export default function VMScaling({ canOperate = true }) {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useFetch(() => api.vms(), [reloadKey]);

  const [targets, setTargets] = useState({});
  const [pending, setPending] = useState(null); // { vm, targetSize } awaiting confirmation
  const [understandChecked, setUnderstandChecked] = useState(false);
  const [scaling, setScaling] = useState(false);
  const [result, setResult] = useState(null);
  const [scaleError, setScaleError] = useState(null);

  const vms = data?.vms || [];

  function setTarget(id, size) {
    setTargets((prev) => ({ ...prev, [id]: size }));
  }

  function openConfirm(vm) {
    if (!canOperate) return;
    const targetSize = targets[vm.id];
    if (!targetSize || targetSize === vm.currentSize) return;
    setResult(null);
    setScaleError(null);
    setUnderstandChecked(false);
    setPending({ vm, targetSize });
  }

  function closeConfirm() {
    if (scaling) return;
    setPending(null);
  }

  async function runScale() {
    if (!pending) return;
    setScaling(true);
    setScaleError(null);
    try {
      const res = await api.scaleVms([
        { id: pending.vm.id, targetSize: pending.targetSize, currentSize: pending.vm.currentSize },
      ]);
      setResult(res);
      setTargets((prev) => ({ ...prev, [pending.vm.id]: undefined }));
      setReloadKey((k) => k + 1);
    } catch (err) {
      setScaleError(err.message);
    } finally {
      setScaling(false);
    }
  }

  const from = pending?.vm
    ? formatSize(pending.vm.availableSizes.find((s) => s.name === pending.vm.currentSize))
    : null;
  const to = pending
    ? formatSize(pending.vm.availableSizes.find((s) => s.name === pending.targetSize))
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">📐</span>
        <h2 className="text-lg font-semibold text-gray-800">VM Scaling</h2>
        {data && (
          <span className="text-sm text-gray-500">· {vms.length} VMs · resize up or down</span>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading VMs…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && vms.length === 0 && (
        <p className="text-sm text-gray-500">No VMs found in this subscription.</p>
      )}

      {vms.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                <th className="py-2 pr-4">Virtual Machine</th>
                <th className="py-2 pr-4">Current size</th>
                <th className="py-2 pr-4">Resize to</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {vms.map((vm) => {
                const selected = targets[vm.id] || vm.currentSize;
                const changed = selected !== vm.currentSize;
                return (
                  <tr key={vm.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-gray-800">{vm.name}</span>
                        {canGoUp(vm) && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                            ▲ up
                          </span>
                        )}
                        {canGoDown(vm) && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                            ▼ down
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{vm.resourceGroup} · {vm.region}</div>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {formatSize(vm.availableSizes.find((s) => s.name === vm.currentSize))}
                      <span
                        className="ml-1 inline-block rounded bg-emerald-50 px-1 text-xs font-semibold text-emerald-600"
                        title="Current size"
                      >
                        current
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {vm.availableSizes.length > 0 ? (
                        <select
                          value={selected}
                          onChange={(e) => setTarget(vm.id, e.target.value)}
                          disabled={!canOperate}
                          className={`rounded border px-2 py-1 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                            changed
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                              : 'border-gray-300'
                          }`}
                        >
                          {vm.availableSizes.map((s) => {
                            const dir = sizeDirection(vm, s.name);
                            return (
                              <option key={s.name} value={s.name}>
                                {s.name} ({s.cores} vCPU / {s.memoryGB} GB)
                                {dir === 'up' ? '  ▲ up' : dir === 'down' ? '  ▼ down' : '  (current)'}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">No sizes available</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openConfirm(vm)}
                        disabled={!canOperate || !changed}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                      >
                        {canOperate ? (changed ? `Scale to ${selected}` : 'Scale') : 'Read-only'}
                      </button>
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
          Only sizes Azure reports as available for each VM are shown. ▲ = resize up
          (bigger, costs more) · ▼ = resize down (smaller, saves money). Resizing may
          briefly restart a running VM.
        </p>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800">
              Resize {pending.vm.name}?
            </h3>
            <div className="mt-3 space-y-1 text-sm text-gray-700">
              <p>
                <span className="text-gray-500">From:</span>{' '}
                <span className="font-medium text-gray-900">{from}</span>
              </p>
              <p>
                <span className="text-gray-500">To:</span>{' '}
                <span className="font-medium text-gray-900">{to}</span>
              </p>
            </div>
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              Resizing may briefly restart the VM if the new size isn't available
              while it's running. The VM's data is preserved.
            </p>

            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                aria-label="I understand the VM may restart"
                checked={understandChecked}
                onChange={(e) => setUnderstandChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600"
              />
              <span>I understand the VM may restart, and that a size change takes effect immediately.</span>
            </label>

            {scaleError && <p className="mt-3 text-sm text-red-600">{scaleError}</p>}

            {result && (
              <div className="mt-3 rounded border border-gray-200 p-3 text-sm">
                <p className="font-semibold text-gray-800">
                  {result.succeeded.length} resized, {result.failed.length} failed
                </p>
                {result.succeeded.map((s) => (
                  <p key={s.id} className="mt-1 text-gray-600">
                    {s.name}: {s.currentSize} → {s.targetSize}{' '}
                    {s.details?.method === 'resized-with-restart' && (
                      <span className="text-amber-600">(restarted)</span>
                    )}
                  </p>
                ))}
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
                disabled={scaling}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button
                  type="button"
                  onClick={runScale}
                  disabled={!understandChecked || scaling}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {scaling ? 'Resizing…' : 'Resize VM'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
