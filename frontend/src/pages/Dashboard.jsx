// Dashboard - owns the shared date range and composes the widgets.

import React, { useState } from 'react';

import AiAnalyst from '../components/AiAnalyst';
import IdleResources from '../components/IdleResources';
import VMScaling from '../components/VMScaling';
import RightSize from '../components/RightSize';
import CostForecast from '../components/CostForecast';
import CostOverview from '../components/CostOverview';
import CostByService from '../components/CostByService';
import BudgetAlerts from '../components/BudgetAlerts';
import LogicAppsStatus from '../components/LogicAppsStatus';
import DateRangePicker from '../components/DateRangePicker';

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Dashboard({ profile = { auth: 'basic', canOperate: true } }) {
  const [range, setRange] = useState({
    from: isoDaysAgo(30),
    to: new Date().toISOString().slice(0, 10),
  });

  const canOperate = profile.canOperate !== false;
  const showUser = profile.auth === 'oidc';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Azure Cost Visibility Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-4">
          <DateRangePicker value={range} onChange={setRange} />
          {showUser && (
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-800">{profile.name}</span>
              <a
                href="/api/auth/logout"
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Sign out
              </a>
            </div>
          )}
        </div>
      </header>

      {!canOperate && (
        <p className="mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Read-only view — your account needs the Operator role to destroy or
          resize resources.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AiAnalyst />
        <IdleResources canOperate={canOperate} />
        <VMScaling canOperate={canOperate} />
        <RightSize canOperate={canOperate} />
        <CostForecast />
        <CostOverview range={range} />
        <CostByService range={range} />
        <BudgetAlerts />
        <LogicAppsStatus />
      </div>
    </div>
  );
}
