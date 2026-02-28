/**
 * Campaign & Resource Requests Service
 * Account-scoped requests (campaign, token, billing). Owner-managed fulfillment.
 */

const fs = require('fs').promises;
const path = require('path');

function getRequestsFilePath(accountId, sharedDataDir) {
  return path.join(sharedDataDir, String(accountId), 'requests.json');
}

async function getRequests(accountId, sharedDataDir) {
  const filePath = getRequestsFilePath(accountId, sharedDataDir);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    const list = Array.isArray(data.requests) ? data.requests : [];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function createRequest(accountId, sharedDataDir, payload) {
  const dir = path.dirname(getRequestsFilePath(accountId, sharedDataDir));
  await fs.mkdir(dir, { recursive: true });
  const list = await getRequests(accountId, sharedDataDir);
  const id = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const request = {
    id,
    type: payload.type || 'general',
    status: 'Submitted',
    createdAt: new Date().toISOString(),
    submittedBy: payload.submittedBy || null,
    ...payload
  };
  list.unshift(request);
  await fs.writeFile(
    path.join(dir, 'requests.json'),
    JSON.stringify({ requests: list }, null, 2),
    'utf8'
  );
  return request;
}

async function updateRequestStatus(accountId, sharedDataDir, requestId, status) {
  const list = await getRequests(accountId, sharedDataDir);
  const idx = list.findIndex(r => r.id === requestId);
  if (idx === -1) return null;
  const valid = ['Submitted', 'In Review', 'Approved', 'Completed'];
  if (!valid.includes(status)) return null;
  list[idx].status = status;
  list[idx].updatedAt = new Date().toISOString();
  list[idx].readByAdmin = true;
  const filePath = getRequestsFilePath(accountId, sharedDataDir);
  await fs.writeFile(filePath, JSON.stringify({ requests: list }, null, 2), 'utf8');
  return list[idx];
}

async function updateRequest(accountId, sharedDataDir, requestId, updates) {
  const list = await getRequests(accountId, sharedDataDir);
  const idx = list.findIndex(r => r.id === requestId);
  if (idx === -1) return null;
  if (updates.status) {
    const valid = ['Submitted', 'In Review', 'Approved', 'Completed'];
    if (valid.includes(updates.status)) list[idx].status = updates.status;
  }
  if (updates.adminReply !== undefined) {
    list[idx].adminReply = updates.adminReply;
    list[idx].repliedAt = new Date().toISOString();
  }
  list[idx].readByAdmin = true;
  list[idx].updatedAt = new Date().toISOString();
  const filePath = getRequestsFilePath(accountId, sharedDataDir);
  await fs.writeFile(filePath, JSON.stringify({ requests: list }, null, 2), 'utf8');
  return list[idx];
}

async function deleteRequest(accountId, sharedDataDir, requestId) {
  const list = await getRequests(accountId, sharedDataDir);
  const next = list.filter(r => r.id !== requestId);
  if (next.length === list.length) return false;
  const filePath = getRequestsFilePath(accountId, sharedDataDir);
  await fs.writeFile(filePath, JSON.stringify({ requests: next }, null, 2), 'utf8');
  return true;
}

async function deleteOldRequests(accountId, sharedDataDir, olderThanDays = 90, onlyCompleted = true) {
  const days = Number.isFinite(Number(olderThanDays)) ? Number(olderThanDays) : 90;
  const cutoff = Date.now() - (Math.max(1, days) * 24 * 60 * 60 * 1000);
  const list = await getRequests(accountId, sharedDataDir);
  const before = list.length;
  const next = list.filter((r) => {
    const ts = new Date(r.createdAt || r.updatedAt || 0).getTime();
    const isOld = Number.isFinite(ts) ? ts < cutoff : false;
    if (!isOld) return true;
    if (onlyCompleted) return r.status !== 'Completed';
    return false;
  });
  const deleted = before - next.length;
  if (deleted > 0) {
    const filePath = getRequestsFilePath(accountId, sharedDataDir);
    await fs.writeFile(filePath, JSON.stringify({ requests: next }, null, 2), 'utf8');
  }
  return { deleted, remaining: next.length };
}

module.exports = {
  getRequests,
  createRequest,
  updateRequestStatus,
  updateRequest,
  deleteRequest,
  deleteOldRequests,
  getRequestsFilePath
};
