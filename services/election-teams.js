/**
 * Election Teams Service
 * Teams, roles, permissions, and volunteer list assignments.
 * JSON file storage per account; easy to migrate to Postgres later.
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../lib');

const logger = createLogger('ELECTION_TEAMS');

const PERMISSION_KEYS = [
  'VIEW_DASHBOARD',
  'VIEW_CONTACT_MANAGER',
  'VIEW_ELECTION_LISTS',
  'VIEW_ELECTION_INTERACTIONS',
  'VIEW_ELECTION_NAVIGATION',
  'VIEW_ELECTION_SCRUTINEERING',
  'VIEW_INVOICES',
  'VIEW_MESSAGES',
  'VIEW_IMAGE_LIBRARY',
  'VIEW_AI_CALLING',
  'VIEW_TEMPLATES',
  'VIEW_TEAMS'
];

const BUILTIN_ROLE_DEFAULTS = {
  campaign_manager: Object.fromEntries(PERMISSION_KEYS.map(k => [k, true])),
  phone_caller: { VIEW_CONTACT_MANAGER: true, VIEW_ELECTION_LISTS: true },
  canvasser: {
    VIEW_CONTACT_MANAGER: true,
    VIEW_ELECTION_NAVIGATION: true,
    VIEW_ELECTION_INTERACTIONS: true,
    VIEW_ELECTION_LISTS: true
  },
  scrutineer: { VIEW_ELECTION_SCRUTINEERING: true },
  marketing: {
    VIEW_MESSAGES: true,
    VIEW_IMAGE_LIBRARY: true,
    VIEW_DASHBOARD: true,
    VIEW_AI_CALLING: true,
    VIEW_TEMPLATES: true
  },
  driver: { VIEW_ELECTION_NAVIGATION: true, VIEW_ELECTION_LISTS: true },
  lawn_signs: {
    VIEW_ELECTION_NAVIGATION: true,
    VIEW_ELECTION_LISTS: true,
    VIEW_CONTACT_MANAGER: true
  },
  volunteer_general: { VIEW_DASHBOARD: true },
  custom: {}
};

function getTeamsFilePath(accountId, baseDir) {
  return path.join(baseDir, String(accountId), 'election-teams.json');
}

async function readTeamsData(accountId, baseDir) {
  const filePath = getTeamsFilePath(accountId, baseDir);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return {
      members: Array.isArray(data.members) ? data.members : [],
      roles: Array.isArray(data.roles) ? data.roles : [],
      invitations: Array.isArray(data.invitations) ? data.invitations : [],
      assignments: Array.isArray(data.assignments) ? data.assignments : []
    };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { members: [], roles: [], invitations: [], assignments: [] };
    }
    throw e;
  }
}

async function writeTeamsData(accountId, baseDir, data) {
  const dir = path.dirname(getTeamsFilePath(accountId, baseDir));
  await fs.mkdir(dir, { recursive: true });
  const filePath = getTeamsFilePath(accountId, baseDir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getBuiltInRoles() {
  return [
    { roleId: 'campaign_manager', roleName: 'Campaign Manager', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.campaign_manager } },
    { roleId: 'phone_caller', roleName: 'Phone Caller', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.phone_caller } },
    { roleId: 'canvasser', roleName: 'Canvasser (Door Knocker)', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.canvasser } },
    { roleId: 'scrutineer', roleName: 'Scrutineer', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.scrutineer } },
    { roleId: 'marketing', roleName: 'Marketing', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.marketing } },
    { roleId: 'driver', roleName: 'Driver', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.driver } },
    { roleId: 'lawn_signs', roleName: 'Lawn Signs', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.lawn_signs } },
    { roleId: 'volunteer_general', roleName: 'Volunteer (General)', isSystem: true, defaultPermissions: { ...BUILTIN_ROLE_DEFAULTS.volunteer_general } },
    { roleId: 'custom', roleName: 'Custom', isSystem: true, defaultPermissions: {} }
  ];
}

function mergeRolesWithBuiltIns(customRoles) {
  const builtIn = getBuiltInRoles();
  const byId = new Map(builtIn.map(r => [r.roleId, { ...r }]));
  (customRoles || []).forEach(r => {
    if (r && r.roleId && !byId.get(r.roleId)?.isSystem) {
      byId.set(r.roleId, {
        roleId: r.roleId,
        roleName: r.roleName || r.roleId,
        isSystem: false,
        defaultPermissions: r.defaultPermissions || {}
      });
    }
  });
  return Array.from(byId.values());
}

function defaultPermissionsForRole(roleId) {
  const def = BUILTIN_ROLE_DEFAULTS[roleId];
  if (def) return { ...def };
  return {};
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * GET teams data for account: members, roles (built-in + custom), permissionKeys, lists (from election lists service).
 */
async function getTeamsData(accountId, baseDir, getListsFn) {
  const data = await readTeamsData(accountId, baseDir);
  const roles = mergeRolesWithBuiltIns(data.roles);
  const lists = typeof getListsFn === 'function' ? await getListsFn(accountId) : [];
  const members = (data.members || []).map(m => {
    const assignmentListIds = (data.assignments || [])
      .filter(a => a.memberId === m.memberId)
      .map(a => a.listId);
    return { ...m, assignedListIds: assignmentListIds };
  });
  return {
    members,
    roles,
    permissionKeys: PERMISSION_KEYS,
    lists: Array.isArray(lists) ? lists : (lists.lists || [])
  };
}

/**
 * POST invite: create invitation and a placeholder member (status: invited).
 */
async function inviteMember(accountId, baseDir, { email, name, roleId }) {
  if (!email || typeof email !== 'string') {
    throw new Error('email is required');
  }
  const data = await readTeamsData(accountId, baseDir);
  const normalizedEmail = email.trim().toLowerCase();
  const exists = (data.members || []).some(m => (m.email || '').toLowerCase() === normalizedEmail);
  if (exists) {
    throw new Error('A member with this email already exists.');
  }
  const memberId = generateId('mem');
  const roleDefaults = defaultPermissionsForRole(roleId || 'volunteer_general');
  const permissions = Object.fromEntries(PERMISSION_KEYS.map(k => [k, !!roleDefaults[k]]));
  const now = new Date().toISOString();
  const member = {
    memberId,
    accountId,
    email: normalizedEmail,
    name: (name && String(name).trim()) || null,
    roleId: roleId || 'volunteer_general',
    status: 'invited',
    permissions,
    tags: [],
    notes: null,
    assignedListIds: [],
    createdAt: now,
    updatedAt: now
  };
  const inviteId = generateId('inv');
  const invitation = {
    inviteId,
    accountId,
    email: normalizedEmail,
    roleId: roleId || 'volunteer_general',
    permissionsSnapshot: { ...permissions },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: null
  };
  data.members = data.members || [];
  data.members.push(member);
  data.invitations = data.invitations || [];
  data.invitations.push(invitation);
  await writeTeamsData(accountId, baseDir, data);
  return { member, invitation };
}

async function updateMemberRole(accountId, baseDir, { memberId, roleId }) {
  const data = await readTeamsData(accountId, baseDir);
  const member = (data.members || []).find(m => m.memberId === memberId);
  if (!member) throw new Error('Member not found');
  const defaults = defaultPermissionsForRole(roleId || member.roleId);
  member.roleId = roleId || member.roleId;
  member.permissions = Object.fromEntries(PERMISSION_KEYS.map(k => [k, !!defaults[k]]));
  member.updatedAt = new Date().toISOString();
  await writeTeamsData(accountId, baseDir, data);
  return member;
}

async function updateMemberPermissions(accountId, baseDir, { memberId, permissionsPatch }) {
  const data = await readTeamsData(accountId, baseDir);
  const member = (data.members || []).find(m => m.memberId === memberId);
  if (!member) throw new Error('Member not found');
  const next = { ...(member.permissions || {}) };
  PERMISSION_KEYS.forEach(k => {
    if (permissionsPatch[k] !== undefined) next[k] = !!permissionsPatch[k];
  });
  member.permissions = next;
  member.updatedAt = new Date().toISOString();
  await writeTeamsData(accountId, baseDir, data);
  return member;
}

async function setMemberSuspended(accountId, baseDir, { memberId, suspended }) {
  const data = await readTeamsData(accountId, baseDir);
  const member = (data.members || []).find(m => m.memberId === memberId);
  if (!member) throw new Error('Member not found');
  member.status = suspended ? 'suspended' : 'active';
  member.updatedAt = new Date().toISOString();
  await writeTeamsData(accountId, baseDir, data);
  return member;
}

async function removeMember(accountId, baseDir, { memberId }) {
  const data = await readTeamsData(accountId, baseDir);
  const member = (data.members || []).find(m => m.memberId === memberId);
  if (!member) throw new Error('Member not found');
  const email = (member.email || '').toLowerCase();
  data.members = (data.members || []).filter(m => m.memberId !== memberId);
  data.assignments = (data.assignments || []).filter(a => a.memberId !== memberId);
  data.invitations = (data.invitations || []).filter(i => (i.email || '').toLowerCase() !== email);
  await writeTeamsData(accountId, baseDir, data);
  return { ok: true };
}

async function createRole(accountId, baseDir, { roleName, defaultPermissions }) {
  const data = await readTeamsData(accountId, baseDir);
  const roleId = generateId('role').replace(/[^a-zA-Z0-9_]/g, '_');
  const role = {
    roleId,
    accountId,
    roleName: (roleName && String(roleName).trim()) || 'Custom Role',
    isSystem: false,
    defaultPermissions: defaultPermissions || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.roles = data.roles || [];
  data.roles.push(role);
  await writeTeamsData(accountId, baseDir, data);
  return role;
}

async function updateRole(accountId, baseDir, { roleId, roleName, defaultPermissions }) {
  const data = await readTeamsData(accountId, baseDir);
  const role = (data.roles || []).find(r => r.roleId === roleId);
  if (!role) throw new Error('Role not found');
  if (role.isSystem) throw new Error('Cannot edit system role');
  if (roleName !== undefined) role.roleName = String(roleName).trim() || role.roleName;
  if (defaultPermissions !== undefined) role.defaultPermissions = defaultPermissions || {};
  role.updatedAt = new Date().toISOString();
  await writeTeamsData(accountId, baseDir, data);
  return role;
}

async function deleteRole(accountId, baseDir, { roleId }) {
  const data = await readTeamsData(accountId, baseDir);
  const role = (data.roles || []).find(r => r.roleId === roleId);
  if (!role) throw new Error('Role not found');
  if (role.isSystem) throw new Error('Cannot delete system role');
  const inUse = (data.members || []).some(m => m.roleId === roleId);
  if (inUse) throw new Error('Role is assigned to members; reassign them first.');
  data.roles = (data.roles || []).filter(r => r.roleId !== roleId);
  await writeTeamsData(accountId, baseDir, data);
  return { ok: true };
}

async function createAssignment(accountId, baseDir, { memberId, listId }, currentUserId) {
  const data = await readTeamsData(accountId, baseDir);
  const member = (data.members || []).find(m => m.memberId === memberId);
  if (!member) throw new Error('Member not found');
  const exists = (data.assignments || []).some(a => a.memberId === memberId && a.listId === listId);
  if (exists) throw new Error('This list is already assigned to this member.');
  const assignmentId = generateId('asn');
  const now = new Date().toISOString();
  const assignment = {
    assignmentId,
    accountId,
    memberId,
    type: 'ELECTION_LIST',
    listId,
    status: 'assigned',
    assignedByMemberId: currentUserId,
    assignedAt: now,
    startedAt: null,
    completedAt: null,
    targetCount: null,
    completedCount: null,
    lastActivityAt: null
  };
  data.assignments = data.assignments || [];
  data.assignments.push(assignment);
  await writeTeamsData(accountId, baseDir, data);
  return assignment;
}

function getAssignments(accountId, baseDir, { memberId }) {
  return readTeamsData(accountId, baseDir).then(data => {
    let list = data.assignments || [];
    if (memberId) list = list.filter(a => a.memberId === memberId);
    return list;
  });
}

async function updateAssignmentStatus(accountId, baseDir, { assignmentId, status }) {
  const data = await readTeamsData(accountId, baseDir);
  const a = (data.assignments || []).find(x => x.assignmentId === assignmentId);
  if (!a) throw new Error('Assignment not found');
  a.status = status;
  if (status === 'in_progress' && !a.startedAt) a.startedAt = new Date().toISOString();
  if (status === 'completed') a.completedAt = new Date().toISOString();
  a.lastActivityAt = new Date().toISOString();
  await writeTeamsData(accountId, baseDir, data);
  return a;
}

async function removeAssignment(accountId, baseDir, { assignmentId }) {
  const data = await readTeamsData(accountId, baseDir);
  const before = (data.assignments || []).length;
  data.assignments = (data.assignments || []).filter(a => a.assignmentId !== assignmentId);
  if (data.assignments.length === before) throw new Error('Assignment not found');
  await writeTeamsData(accountId, baseDir, data);
  return { ok: true };
}

module.exports = {
  PERMISSION_KEYS,
  getTeamsData,
  inviteMember,
  updateMemberRole,
  updateMemberPermissions,
  setMemberSuspended,
  removeMember,
  createRole,
  updateRole,
  deleteRole,
  createAssignment,
  getAssignments,
  updateAssignmentStatus,
  removeAssignment,
  getBuiltInRoles
};
