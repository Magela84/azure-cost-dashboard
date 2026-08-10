// Service wrapper around @azure/arm-logic.
// Lists Logic App workflows in the configured resource group and enriches each
// with the status of its most recent run.

const { DefaultAzureCredential } = require('@azure/identity');
const { LogicManagementClient } = require('@azure/arm-logic');

const mockLogicApps = require('../mocks/logicApps');

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const resourceGroup = process.env.AZURE_RESOURCE_GROUP;

let cachedClient;

function useMock() {
  return process.env.MOCK_DATA === 'true';
}

function getClient() {
  if (!cachedClient) {
    if (!subscriptionId) {
      throw new Error('AZURE_SUBSCRIPTION_ID is not set');
    }
    const credential = new DefaultAzureCredential();
    cachedClient = new LogicManagementClient(credential, subscriptionId);
  }
  return cachedClient;
}

const RUN_STATS_DAYS = 30; // lookback window for the run counts

// Fetch just the latest run for a workflow (top: 1) and summarize it.
async function getLatestRun(client, workflowName) {
  try {
    const iterator = client.workflowRuns.list(resourceGroup, workflowName, {
      top: 1,
    });
    for await (const run of iterator) {
      return {
        status: run.status, // Succeeded / Failed / Running / Cancelled ...
        startTime: run.startTime,
        endTime: run.endTime,
        correlationId: run.correlation?.clientTrackingId,
      };
    }
  } catch (err) {
    // Non-fatal: a workflow may have no run history yet.
    return { status: 'Unknown', error: err.message };
  }
  return null;
}

// Count runs within the lookback window so the UI can show a concrete number
// instead of a bare status. A workflow with no runs (e.g. disabled) gets 0s.
async function getRunCounts(client, workflowName, days = RUN_STATS_DAYS) {
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const counts = {
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    otherCount: 0,
    windowDays: days,
  };
  try {
    const iterator = client.workflowRuns.list(resourceGroup, workflowName, { top: 1000 });
    for await (const run of iterator) {
      if (run.startTime && new Date(run.startTime) < windowStart) continue;
      counts.runCount += 1;
      if (run.status === 'Succeeded') counts.successCount += 1;
      else if (run.status === 'Failed') counts.failureCount += 1;
      else counts.otherCount += 1;
    }
  } catch (_) {
    // Non-fatal: treat as no data rather than failing the whole list.
  }
  return counts;
}

/**
 * List Logic App workflows with their state and latest run status.
 * @returns {Promise<Array<object>>}
 */
async function getLogicApps() {
  if (useMock()) return mockLogicApps.getMockLogicApps();

  const client = getClient();
  if (!resourceGroup) {
    throw new Error('AZURE_RESOURCE_GROUP is not set');
  }

  const workflows = [];
  for await (const wf of client.workflows.listByResourceGroup(resourceGroup)) {
    const latestRun = await getLatestRun(client, wf.name);
    const runs = await getRunCounts(client, wf.name);
    workflows.push({
      name: wf.name,
      id: wf.id,
      state: wf.state, // Enabled / Disabled
      location: wf.location,
      createdTime: wf.createdTime,
      changedTime: wf.changedTime,
      latestRun,
      runs,
    });
  }

  return workflows;
}

module.exports = {
  getClient,
  getLogicApps,
  subscriptionId,
  resourceGroup,
};
