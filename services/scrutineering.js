/**
 * Scrutineering Service
 *
 * Phase 4: Election Mode Features
 * Handles vote tracking, scrutineering, and turnout management.
 *
 * Uses JSON file storage to match the DATA_BACKEND=json environment setting.
 * All data is stored under data/shared-data/{accountId}/.
 */

const path = require('path');
const fsPromises = require('fs').promises;
const { createLogger } = require('../lib');
const voterInteractionsService = require('./voter-interactions');

const scrutineeringLogger = createLogger('SCRUTINEERING');

const SHARED_DATA_DIR = path.join(__dirname, '..', 'data', 'shared-data');

// ── File paths ────────────────────────────────────────────────────────────────

const getVotedPath    = (accountId) => path.join(SHARED_DATA_DIR, String(accountId), 'scrutineering-voted.json');
const getVoteMarksPath = (accountId) => path.join(SHARED_DATA_DIR, String(accountId), 'vote-marks.json');
const getPollTurnoutPath = (accountId) => path.join(SHARED_DATA_DIR, String(accountId), 'poll-turnout.json');

// ── Generic JSON helpers ──────────────────────────────────────────────────────

const readJson = async (filePath, defaultValue) => {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return defaultValue;
    throw e;
  }
};

const writeJson = async (filePath, data) => {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp.' + Date.now();
  await fsPromises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsPromises.rename(tmp, filePath);
};

// ── Verification code ─────────────────────────────────────────────────────────

const generateVerificationCode = () =>
  `V${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

// ── Support category normalizer (for tally) ───────────────────────────────────

// Map contact category to tally bucket. Order matters: check oppose before support.
// Unknown = no matching category (truly no data). Undecided = only "undecided".
// Support = supporter, member, volunteer, donor, etc. Oppose = opposed, non-supporter, liberal/ndp/green (other party).
const normalizeSupportFromCategory = (cat) => {
  if (!cat || typeof cat !== 'string') return null;
  const lower = cat.toLowerCase().replace(/\s+/g, '_');
  const raw = cat.toLowerCase();
  // Oppose first: opposed, non-supporter, other-party (liberal, ndp, green)
  if (['strong_oppose', 'strongoppose', 'opposed', 'oppose'].some(p => lower.includes(p))) return 'strong_oppose';
  if (['likely_oppose', 'likelyoppose', 'non_supporter', 'nonsupporter', 'non-supporter', 'liberal', 'ndp', 'green'].some(p => lower.includes(p) || raw.includes(p))) return 'likely_oppose';
  // Support: supporter, member, volunteer, donor, board, etc.
  if (['strong_support', 'strongsupport'].some(p => lower.includes(p))) return 'strong_support';
  if (['likely_support', 'likelysupport', 'supporter', 'member', 'donor', 'volunteer', 'board', 'lapsed'].some(p => lower.includes(p) || raw.includes(p))) return 'likely_support';
  // Undecided only
  if (lower === 'undecided' || raw === 'undecided') return 'undecided';
  return null;
};

// ── Vote Marks (immutable audit trail with poll numbers) ──────────────────────

/**
 * Mark a vote with verification code (immutable audit).
 */
const markVote = async (voteData) => {
  const {
    accountId,
    contactId,
    pollNumber,
    riding,
    province,
    markedBy,
    verificationCode,
    notes,
    metadata = {}
  } = voteData;

  const finalVerificationCode = verificationCode || generateVerificationCode();

  const filePath = getVoteMarksPath(accountId);
  const marks = await readJson(filePath, []);

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    account_id: accountId,
    contact_id: contactId,
    poll_number: pollNumber,
    riding: riding || null,
    province: province || null,
    marked_by: markedBy || null,
    verification_code: finalVerificationCode,
    notes: notes || null,
    metadata,
    marked_at: new Date().toISOString()
  };

  marks.push(entry);
  await writeJson(filePath, marks);

  // Update poll turnout summary
  await _incrementPollTurnout(accountId, pollNumber, riding, province, markedBy);

  scrutineeringLogger.info('Vote marked', { accountId, pollNumber, verificationCode: finalVerificationCode });
  return entry;
};

const _incrementPollTurnout = async (accountId, pollNumber, riding, province, markedBy) => {
  const filePath = getPollTurnoutPath(accountId);
  const turnout = await readJson(filePath, []);
  const key = [pollNumber, riding || '', province || ''].join('|');
  const existing = turnout.find(t => [t.poll_number, t.riding || '', t.province || ''].join('|') === key);
  if (existing) {
    existing.votes_cast = (existing.votes_cast || 0) + 1;
    existing.updated_by = markedBy || null;
    existing.last_updated_at = new Date().toISOString();
  } else {
    turnout.push({
      account_id: accountId,
      poll_number: pollNumber,
      riding: riding || null,
      province: province || null,
      total_voters: 0,
      votes_cast: 1,
      updated_by: markedBy || null,
      last_updated_at: new Date().toISOString()
    });
  }
  await writeJson(filePath, turnout);
};

/**
 * Get vote marks for a specific poll.
 */
const getVoteMarksByPoll = async (accountId, pollNumber, riding = null, province = null) => {
  const marks = await readJson(getVoteMarksPath(accountId), []);
  return marks.filter(m =>
    m.poll_number === pollNumber &&
    (!riding || m.riding === riding) &&
    (!province || m.province === province)
  );
};

/**
 * Get all vote marks for an account (with filters and pagination).
 */
const getVoteMarks = async (accountId, filters = {}) => {
  let marks = await readJson(getVoteMarksPath(accountId), []);

  if (filters.pollNumber) marks = marks.filter(m => m.poll_number === filters.pollNumber);
  if (filters.riding)     marks = marks.filter(m => m.riding === filters.riding);
  if (filters.province)   marks = marks.filter(m => m.province === filters.province);
  if (filters.markedBy)   marks = marks.filter(m => m.marked_by === filters.markedBy);
  if (filters.startDate)  marks = marks.filter(m => new Date(m.marked_at) >= new Date(filters.startDate));
  if (filters.endDate)    marks = marks.filter(m => new Date(m.marked_at) <= new Date(filters.endDate));

  if (filters.contactSearch) {
    const q = filters.contactSearch.toLowerCase();
    marks = marks.filter(m =>
      (m.contact_name && m.contact_name.toLowerCase().includes(q)) ||
      (m.contact_id && m.contact_id.toLowerCase().includes(q))
    );
  }

  // Sort descending by marked_at
  marks.sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at));

  const total = marks.length;
  const limit  = filters.limit  || 100;
  const offset = filters.offset || 0;
  const paginated = marks.slice(offset, offset + limit);

  return { voteMarks: paginated, total, limit, offset, hasMore: offset + paginated.length < total };
};

/**
 * Get turnout summary grouped by poll.
 */
const getTurnoutSummary = async (accountId, filters = {}) => {
  let polls = await readJson(getPollTurnoutPath(accountId), []);

  if (filters.riding)   polls = polls.filter(p => p.riding === filters.riding);
  if (filters.province) polls = polls.filter(p => p.province === filters.province);

  const totals = polls.reduce((acc, row) => {
    acc.totalVoters    += parseInt(row.total_voters || 0);
    acc.totalVotesCast += parseInt(row.votes_cast   || 0);
    return acc;
  }, { totalVoters: 0, totalVotesCast: 0 });

  const turnoutPercentage = totals.totalVoters > 0
    ? parseFloat(((totals.totalVotesCast / totals.totalVoters) * 100).toFixed(2))
    : 0;

  return { polls, totals: { ...totals, turnoutPercentage } };
};

/**
 * Get poll-turnout data in the shape the /api/election/poll-turnout endpoint expects.
 * Returns { turnout: [...rows] }.
 */
const getPollTurnout = async (accountId) => {
  const polls = await readJson(getPollTurnoutPath(accountId), []);
  return { turnout: polls };
};

/**
 * Get details for a single poll.
 */
const getPollTurnoutDetails = async (accountId, pollNumber, riding, province) => {
  const polls = await readJson(getPollTurnoutPath(accountId), []);
  const turnout = polls.find(p =>
    p.poll_number === pollNumber &&
    (!riding   || p.riding   === riding) &&
    (!province || p.province === province)
  );
  if (!turnout) return null;
  const voteMarks = await getVoteMarksByPoll(accountId, pollNumber, riding, province);
  return {
    ...turnout,
    voteMarks,
    voteCount: voteMarks.length,
    turnoutPercentage: turnout.total_voters > 0
      ? ((turnout.votes_cast / turnout.total_voters) * 100).toFixed(2)
      : 0
  };
};

/**
 * Verify a vote mark by verification code.
 */
const verifyVoteMark = async (accountId, verificationCode) => {
  const marks = await readJson(getVoteMarksPath(accountId), []);
  return marks.find(m => m.verification_code === verificationCode) || null;
};

// ── Scrutineering "Voted" (running tally) ─────────────────────────────────────

/**
 * Mark a contact as voted for the running tally.
 */
const setVoted = async (accountId, contactId, markedBy = null) => {
  const filePath = getVotedPath(accountId);
  const voted = await readJson(filePath, []);
  const existing = voted.find(v => v.contact_id === String(contactId));
  if (existing) {
    existing.voted_at  = new Date().toISOString();
    existing.marked_by = markedBy || null;
  } else {
    voted.push({ account_id: accountId, contact_id: String(contactId), voted_at: new Date().toISOString(), marked_by: markedBy || null });
  }
  await writeJson(filePath, voted);
  return voted.find(v => v.contact_id === String(contactId));
};

/**
 * Unmark a contact as voted.
 */
const unsetVoted = async (accountId, contactId) => {
  const filePath = getVotedPath(accountId);
  const voted = await readJson(filePath, []);
  const filtered = voted.filter(v => v.contact_id !== String(contactId));
  if (filtered.length === voted.length) return false;
  await writeJson(filePath, filtered);
  return true;
};

/**
 * Clear all voted data for an account (manual reset before next election).
 */
const clearAllVoted = async (accountId) => {
  const filePath = getVotedPath(accountId);
  const voted = await readJson(filePath, []);
  const count = voted.length;
  await writeJson(filePath, []);
  return count;
};

/**
 * Check if a contact is marked voted.
 */
const isContactVoted = async (accountId, contactId) => {
  const voted = await readJson(getVotedPath(accountId), []);
  return voted.some(v => v.contact_id === String(contactId));
};

/**
 * Get IDs of all contacts marked voted for an account.
 */
const getVotedContactIds = async (accountId) => {
  const voted = await readJson(getVotedPath(accountId), []);
  return voted.map(v => v.contact_id);
};

/**
 * Get running tally and projected outcomes by support category.
 * Support is derived from: (1) election_interactions support_likelihood (if available),
 * then (2) contact categories (JSON file-based).
 */
const getTally = async (accountId, getAccountContacts) => {
  const votedIds = await getVotedContactIds(accountId);
  const totalVoted = votedIds.length;
  const emptyByCategory = { strong_support: 0, likely_support: 0, undecided: 0, likely_oppose: 0, strong_oppose: 0, unknown: 0 };

  if (totalVoted === 0) {
    return { totalVoted: 0, byCategory: emptyByCategory, projectedOutcome: null };
  }

  // Try to get support categories from election_interactions (PostgreSQL).
  // If unavailable, fall through to contact categories.
  let supportFromInteractions = new Map();
  try {
    supportFromInteractions = await voterInteractionsService.getSupportCategoriesForContacts(accountId, votedIds);
  } catch (e) {
    scrutineeringLogger.warn('Could not load interaction support categories, falling back to contact categories', { message: e.message });
  }

  const contacts = await getAccountContacts();
  const contactMap = new Map((contacts || []).map(c => [String(c.id), c]));

  const byCategory = { ...emptyByCategory };

  for (const contactId of votedIds) {
    let effective = supportFromInteractions.get(contactId) || 'unknown';
    if (effective === 'unknown') {
      const contact = contactMap.get(contactId);
      if (contact && Array.isArray(contact.categories)) {
        for (const cat of contact.categories) {
          const normalized = normalizeSupportFromCategory(cat);
          if (normalized) { effective = normalized; break; }
        }
      }
    }
    if (byCategory[effective] !== undefined) {
      byCategory[effective]++;
    } else {
      byCategory.unknown++;
    }
  }

  const supportVotes = byCategory.strong_support + byCategory.likely_support;
  const opposeVotes  = byCategory.strong_oppose  + byCategory.likely_oppose;
  const projectedOutcome = totalVoted > 0
    ? {
        supportPct: Math.round((supportVotes / totalVoted) * 100),
        opposePct:  Math.round((opposeVotes  / totalVoted) * 100),
        undecidedPct: Math.round((byCategory.undecided / totalVoted) * 100),
        unknownPct:   Math.round((byCategory.unknown   / totalVoted) * 100),
        likelyWin: supportVotes > opposeVotes
      }
    : null;

  return { totalVoted, byCategory, projectedOutcome };
};

module.exports = {
  markVote,
  getVoteMarksByPoll,
  getVoteMarks,
  getTurnoutSummary,
  getPollTurnout,
  getPollTurnoutDetails,
  verifyVoteMark,
  setVoted,
  unsetVoted,
  clearAllVoted,
  isContactVoted,
  getVotedContactIds,
  getTally
};
