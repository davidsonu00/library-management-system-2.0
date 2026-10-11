'use strict';

/**
 * Approved, READ-ONLY tools the AI Librarian may call.
 *
 * Design rules (see README section "AI Librarian"):
 *  - No tool writes to the database. Only find, count, sum and aggregate queries are used.
 *  - The model never supplies SQL. It supplies a few validated arguments.
 *  - Business rules are reused from the existing code (calculateFine) or mirror the
 *    existing controllers exactly (overdue = return_date IS NULL AND due_date < now).
 *    The `status` column is NOT used for overdue logic because the app never sets
 *    status = 'overdue'.
 *  - Member PII is minimised: only member_id + name ever leave this module
 *    (no email, phone or address).
 *  - Every tool returns { ok: true, data, as_of } or { ok: false, error }.
 *    A zero-row result is ok:true with total:0; a failed query is ok:false.
 */

const { Op, fn, col, literal, where: sqlWhere } = require('sequelize');
const { Book, Member, IssueLog } = require('../models');
const { calculateFine } = require('../controllers/issueController');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const MAX_AGGREGATE_ROWS = 5000; // safety cap when a total must be computed in JS
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/* ----------------------------- small helpers ----------------------------- */

/**
 * Dates are handled as plain YYYY-MM-DD strings. "Today" is the SERVER's local calendar date,
 * which is the same basis Sequelize uses when the app writes DATEONLY columns such as
 * issue_date, and when the dashboard filters `due_date < new Date()`.
 */
const ymd = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); // Date.UTC normalises overflow
const todayStr = (now = new Date()) => ymd(now.getFullYear(), now.getMonth(), now.getDate());
const dayNumber = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
};

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

/** Split a free-text query into at most 5 search terms (AND-ed, each OR-ed across fields). */
const toTerms = (q) =>
  String(q)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);

/** Same arithmetic as calculateFine() in issueController, expressed in days (0 when not past due). */
const daysOverdue = (dueDate) => {
  const diff = Math.floor((new Date() - new Date(dueDate)) / MS_PER_DAY);
  return diff > 0 ? diff : 0;
};

const num = (v) => (v === null || v === undefined ? 0 : Number(v));
const round2 = (v) => Math.round(num(v) * 100) / 100;

/**
 * Derived status (the stored `status` column is not reliable for 'overdue').
 * Overdue = not returned AND due_date is before today's date, matching openOverdueWhere().
 */
const loanStatus = (row) => {
  if (row.return_date) return 'returned';
  return String(row.due_date) < todayStr() ? 'overdue' : 'issued';
};

const PERIODS = [
  'this_month',
  'last_month',
  'last_30_days',
  'last_6_months',
  'this_year',
  'all_time',
];

/** Returns inclusive { from, to } as YYYY-MM-DD strings, or null for all_time. */
const periodRange = (period, now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'this_month':
      return { from: ymd(y, m, 1), to: ymd(y, m, d) };
    case 'last_month':
      return { from: ymd(y, m - 1, 1), to: ymd(y, m, 0) };
    case 'last_30_days':
      return { from: ymd(y, m, d - 29), to: ymd(y, m, d) };
    case 'last_6_months':
      return { from: ymd(y, m - 5, 1), to: ymd(y, m, d) };
    case 'this_year':
      return { from: ymd(y, 0, 1), to: ymd(y, m, d) };
    case 'all_time':
    default:
      return null;
  }
};

/** Equal-length window immediately before `range` (for trend comparison). */
const previousRange = (range) => {
  if (!range) return null;
  const from = dayNumber(range.from);
  const lengthDays = dayNumber(range.to) - from + 1;
  const prevTo = from - 1;
  const prevFrom = prevTo - (lengthDays - 1);
  const fmt = (n) => new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
  return { from: fmt(prevFrom), to: fmt(prevTo) };
};

const dateWhere = (field, range) =>
  range ? { [field]: { [Op.gte]: range.from, [Op.lte]: range.to } } : {};

const openOverdueWhere = () => ({ return_date: null, due_date: { [Op.lt]: new Date() } });

const bookPublic = (b) => ({
  book_id: b.book_id,
  title: b.title,
  author: b.author,
  category: b.category,
  isbn: b.isbn,
  total_copies: b.total_copies,
  available_copies: b.available_copies,
  shelf_location: b.shelf_location,
});

/** AND over terms, each term OR-ed over searchable text fields. */
const bookTextWhere = (query) => {
  if (typeof query !== 'string' || !query.trim()) return null;
  const terms = toTerms(query);
  if (!terms.length) return null;
  return {
    [Op.and]: terms.map((t) => {
      const pattern = `%${escapeLike(t)}%`;
      return {
        [Op.or]: [
          { title: { [Op.iLike]: pattern } },
          { author: { [Op.iLike]: pattern } },
          { category: { [Op.iLike]: pattern } },
          { isbn: { [Op.iLike]: pattern } },
          { description: { [Op.iLike]: pattern } },
        ],
      };
    }),
  };
};

const listBooks = async ({ query, category, availability, limit }) => {
  const clauses = [];
  const text = bookTextWhere(query);
  if (text) clauses.push(text);
  if (category) clauses.push({ category: { [Op.iLike]: `%${escapeLike(category)}%` } });
  if (availability === 'available') clauses.push({ available_copies: { [Op.gt]: 0 } });
  if (availability === 'unavailable') clauses.push({ available_copies: { [Op.lte]: 0 } });

  const { count, rows } = await Book.findAndCountAll({
    where: clauses.length ? { [Op.and]: clauses } : {},
    limit,
    order: [['title', 'ASC']],
  });
  return { total: count, returned: rows.length, truncated: count > rows.length, items: rows.map(bookPublic) };
};

/** Resolve a member from a numeric id or a (partial) name. */
const resolveMember = async (memberRef) => {
  const ref = String(memberRef).trim();
  if (/^\d+$/.test(ref)) {
    const byId = await Member.findByPk(parseInt(ref, 10), {
      attributes: ['member_id', 'name', 'member_type', 'is_active'],
    });
    if (byId) return { matches: [byId] };
  }
  const matches = await Member.findAll({
    where: { name: { [Op.iLike]: `%${escapeLike(ref)}%` } },
    attributes: ['member_id', 'name', 'member_type', 'is_active'],
    order: [['name', 'ASC']],
    limit: 6,
  });
  return { matches };
};

/* ------------------------------ tool registry ----------------------------- */
/**
 * params: provider-neutral schema, used for BOTH server validation and the
 * function declarations sent to the model.
 *   type: 'string' | 'integer' | 'enum'
 */
const limitParam = {
  type: 'integer',
  min: 1,
  max: MAX_LIMIT,
  default: DEFAULT_LIMIT,
  description: `Maximum rows to return (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).`,
};

const periodParam = (def) => ({
  type: 'enum',
  values: PERIODS,
  default: def,
  description: 'Time window, based on the server calendar date.',
});

const TOOLS = {
  searchBooks: {
    description:
      'Search the book catalogue by title, author, category, ISBN or topic keywords. ' +
      'Use for questions like "books about Python" or "find books by Orwell". ' +
      'Returns matching books with total and available copies.',
    params: {
      query: { type: 'string', max: 100, description: 'Free-text keywords, e.g. "python programming".' },
      category: { type: 'string', max: 100, description: 'Optional category filter, e.g. "Science".' },
      availability: {
        type: 'enum',
        values: ['any', 'available', 'unavailable'],
        default: 'any',
        description: 'Filter by whether at least one copy is on the shelf.',
      },
      limit: limitParam,
    },
    handler: async (a) => listBooks({ ...a }),
  },

  getAvailableBooks: {
    description:
      'Library-wide availability counts plus a list of books that currently have at least one ' +
      'available copy. Use for "how many books are available" and "which books are available". ' +
      'Also reports titles with zero available copies and any stock records that look inconsistent.',
    params: {
      query: { type: 'string', max: 100, description: 'Optional keywords to narrow the list.' },
      category: { type: 'string', max: 100, description: 'Optional category filter.' },
      limit: limitParam,
    },
    handler: async (a) => {
      const [titles, totalCopies, availableCopies, titlesAvailable, titlesUnavailable, inconsistent, list] =
        await Promise.all([
          Book.count(),
          Book.sum('total_copies'),
          Book.sum('available_copies'),
          Book.count({ where: { available_copies: { [Op.gt]: 0 } } }),
          Book.count({ where: { available_copies: { [Op.lte]: 0 } } }),
          Book.count({ where: sqlWhere(col('available_copies'), '>', col('total_copies')) }),
          listBooks({ query: a.query, category: a.category, availability: 'available', limit: a.limit }),
        ]);
      return {
        totals: {
          book_titles: titles,
          total_copies: num(totalCopies),
          available_copies: num(availableCopies),
          titles_with_available_copies: titlesAvailable,
          titles_with_zero_available_copies: titlesUnavailable,
          titles_with_available_exceeding_total: inconsistent,
        },
        matches: list,
      };
    },
  },

  getOverdueBooks: {
    description:
      'Loans that are not yet returned and whose due date has passed (same rule as the dashboard). ' +
      'Returns the most overdue loans first, with member name, book, days overdue and current fine, ' +
      'plus the total count and total accrued fine across ALL overdue loans. ' +
      'A loan is overdue only once its due date is before today (a loan due today is not yet overdue).',
    params: { limit: limitParam },
    handler: async (a) => {
      const where = openOverdueWhere();
      const [total, rows, allDue] = await Promise.all([
        IssueLog.count({ where }),
        IssueLog.findAll({
          where,
          include: [
            { model: Member, as: 'member', attributes: ['member_id', 'name'], required: true },
            { model: Book, as: 'book', attributes: ['book_id', 'title', 'author'], required: true },
          ],
          order: [['due_date', 'ASC'], ['issue_id', 'ASC']],
          limit: a.limit,
        }),
        IssueLog.findAll({ where, attributes: ['due_date'], limit: MAX_AGGREGATE_ROWS, raw: true }),
      ]);
      const totalFine = allDue.reduce((sum, r) => sum + calculateFine(r.due_date, null), 0);
      return {
        total,
        returned: rows.length,
        truncated: total > rows.length,
        total_current_fine: round2(totalFine),
        total_fine_is_complete: allDue.length === total,
        items: rows.map((r) => ({
          issue_id: r.issue_id,
          member_id: r.member.member_id,
          member_name: r.member.name,
          book_id: r.book.book_id,
          book_title: r.book.title,
          book_author: r.book.author,
          issue_date: r.issue_date,
          due_date: r.due_date,
          days_overdue: daysOverdue(r.due_date),
          current_fine: calculateFine(r.due_date, null),
        })),
      };
    },
  },

  getPendingReturns: {
    description:
      'Members who currently hold books that have not been returned, grouped per member with the ' +
      'number of open loans, how many of those are overdue, and the earliest due date. ' +
      'Optionally filter by member name.',
    params: {
      member: { type: 'string', max: 100, description: 'Optional member name (or part of it) to filter by.' },
      limit: limitParam,
    },
    handler: async (a) => {
      const where = { return_date: null };
      if (a.member) {
        const ids = await Member.findAll({
          where: { name: { [Op.iLike]: `%${escapeLike(a.member)}%` } },
          attributes: ['member_id'],
          limit: 100,
          raw: true,
        });
        if (!ids.length) return { total_members_with_pending_returns: 0, total_open_loans: 0, returned: 0, truncated: false, items: [] };
        where.member_id = { [Op.in]: ids.map((r) => r.member_id) };
      }

      const [groups, memberCount, openLoans] = await Promise.all([
        IssueLog.findAll({
          where,
          attributes: [
            'member_id',
            [fn('COUNT', col('issue_id')), 'open_loans'],
            [fn('MIN', col('due_date')), 'earliest_due_date'],
          ],
          group: ['member_id'],
          order: [[literal('open_loans'), 'DESC'], [literal('earliest_due_date'), 'ASC']],
          limit: a.limit,
          raw: true,
        }),
        IssueLog.count({ where, distinct: true, col: 'member_id' }),
        IssueLog.count({ where }),
      ]);

      const pageIds = groups.map((g) => g.member_id);
      const [members, overdueGroups] = pageIds.length
        ? await Promise.all([
            Member.findAll({ where: { member_id: { [Op.in]: pageIds } }, attributes: ['member_id', 'name'], raw: true }),
            IssueLog.findAll({
              where: { ...openOverdueWhere(), member_id: { [Op.in]: pageIds } },
              attributes: ['member_id', [fn('COUNT', col('issue_id')), 'overdue_loans']],
              group: ['member_id'],
              raw: true,
            }),
          ])
        : [[], []];
      const nameById = Object.fromEntries(members.map((m) => [m.member_id, m.name]));
      const overdueById = Object.fromEntries(overdueGroups.map((g) => [g.member_id, num(g.overdue_loans)]));

      return {
        total_members_with_pending_returns: memberCount,
        total_open_loans: openLoans,
        returned: groups.length,
        truncated: memberCount > groups.length,
        items: groups.map((g) => ({
          member_id: g.member_id,
          member_name: nameById[g.member_id] || null,
          open_loans: num(g.open_loans),
          overdue_loans: overdueById[g.member_id] || 0,
          earliest_due_date: g.earliest_due_date,
        })),
      };
    },
  },

  getIssueStatistics: {
    description:
      'Borrowing statistics for a time window: books issued, books returned, a comparison with the ' +
      'immediately preceding window of equal length, issues per month, top categories, and the current ' +
      'open/overdue loan counts. Use for questions about trends, volumes and "how many books were issued".',
    params: { period: periodParam('this_month') },
    handler: async (a) => {
      const range = periodRange(a.period);
      const prev = previousRange(range);
      const issuedWhere = dateWhere('issue_date', range);
      const monthExpr = fn('TO_CHAR', col('issue_date'), 'YYYY-MM');

      const [issued, returned, prevIssued, open, overdue, activeMembers, byMonth, byCategory] = await Promise.all([
        IssueLog.count({ where: issuedWhere }),
        IssueLog.count({ where: { return_date: { [Op.ne]: null }, ...dateWhere('return_date', range) } }),
        prev ? IssueLog.count({ where: dateWhere('issue_date', prev) }) : Promise.resolve(null),
        IssueLog.count({ where: { return_date: null } }),
        IssueLog.count({ where: openOverdueWhere() }),
        Member.count({ where: { is_active: true } }),
        IssueLog.findAll({
          where: issuedWhere,
          attributes: [[monthExpr, 'month'], [fn('COUNT', col('issue_id')), 'issued']],
          group: [monthExpr],
          order: [[monthExpr, 'DESC']],
          limit: 24,
          raw: true,
        }),
        IssueLog.findAll({
          where: issuedWhere,
          attributes: [[col('book.category'), 'category'], [fn('COUNT', col('IssueLog.issue_id')), 'issued']],
          include: [{ model: Book, as: 'book', attributes: [], required: true }],
          group: [col('book.category')],
          order: [[literal('issued'), 'DESC']],
          limit: 5,
          raw: true,
        }),
      ]);

      return {
        period: a.period,
        range,
        issued_in_period: issued,
        returned_in_period: returned,
        previous_range: prev,
        issued_in_previous_period: prevIssued,
        currently_open_loans: open,
        currently_overdue_loans: overdue,
        active_members: activeMembers,
        issues_by_month: byMonth.map((r) => ({ month: r.month, issued: num(r.issued) })).reverse(),
        top_categories: byCategory.map((r) => ({ category: r.category || 'Uncategorised', issued: num(r.issued) })),
      };
    },
  },

  listIssuedBooks: {
    description:
      'List the individual loans issued within a time window (newest first), e.g. "show books issued ' +
      'this month". Each row has the member, book, issue/due/return dates and a derived status.',
    params: { period: periodParam('this_month'), limit: limitParam },
    handler: async (a) => {
      const range = periodRange(a.period);
      const where = dateWhere('issue_date', range);
      const { count, rows } = await IssueLog.findAndCountAll({
        where,
        include: [
          { model: Member, as: 'member', attributes: ['member_id', 'name'], required: true },
          { model: Book, as: 'book', attributes: ['book_id', 'title', 'author'], required: true },
        ],
        order: [['issue_date', 'DESC'], ['issue_id', 'DESC']],
        limit: a.limit,
        distinct: true,
      });
      return {
        period: a.period,
        range,
        total: count,
        returned: rows.length,
        truncated: count > rows.length,
        items: rows.map((r) => ({
          issue_id: r.issue_id,
          member_id: r.member.member_id,
          member_name: r.member.name,
          book_id: r.book.book_id,
          book_title: r.book.title,
          issue_date: r.issue_date,
          due_date: r.due_date,
          return_date: r.return_date,
          status: loanStatus(r),
        })),
      };
    },
  },

  getPopularBooks: {
    description: 'Most frequently issued books in a time window, ranked by number of issues.',
    params: { period: periodParam('all_time'), limit: limitParam },
    handler: async (a) => {
      const range = periodRange(a.period);
      const where = dateWhere('issue_date', range);
      const groups = await IssueLog.findAll({
        where,
        attributes: ['book_id', [fn('COUNT', col('issue_id')), 'times_issued']],
        group: ['book_id'],
        order: [[literal('times_issued'), 'DESC'], ['book_id', 'ASC']],
        limit: a.limit,
        raw: true,
      });
      const books = groups.length
        ? await Book.findAll({
            where: { book_id: { [Op.in]: groups.map((g) => g.book_id) } },
            attributes: ['book_id', 'title', 'author', 'category', 'available_copies', 'total_copies'],
            raw: true,
          })
        : [];
      const byId = Object.fromEntries(books.map((b) => [b.book_id, b]));
      return {
        period: a.period,
        range,
        returned: groups.length,
        items: groups.map((g, i) => ({
          rank: i + 1,
          book_id: g.book_id,
          title: byId[g.book_id]?.title ?? null,
          author: byId[g.book_id]?.author ?? null,
          category: byId[g.book_id]?.category ?? null,
          times_issued: num(g.times_issued),
          available_copies: byId[g.book_id]?.available_copies ?? null,
          total_copies: byId[g.book_id]?.total_copies ?? null,
        })),
      };
    },
  },

  getMemberIssueHistory: {
    description:
      'Issue history for one member, looked up by name (or part of a name) or numeric member id. ' +
      'If several members match, returns the candidates so the librarian can pick one. ' +
      'Returns a summary and the most recent loans.',
    params: {
      member: { type: 'string', required: true, max: 100, description: 'Member name (or part) or numeric member id.' },
      limit: limitParam,
    },
    handler: async (a) => {
      const { matches } = await resolveMember(a.member);
      if (matches.length === 0) return { found: false, ambiguous: false, candidates: [], items: [] };
      if (matches.length > 1) {
        return {
          found: false,
          ambiguous: true,
          candidates: matches.slice(0, 5).map((m) => ({
            member_id: m.member_id,
            member_name: m.name,
            member_type: m.member_type,
          })),
          items: [],
        };
      }
      const member = matches[0];
      const where = { member_id: member.member_id };
      const [total, open, overdue, fines, rows] = await Promise.all([
        IssueLog.count({ where }),
        IssueLog.count({ where: { ...where, return_date: null } }),
        IssueLog.count({ where: { ...where, ...openOverdueWhere() } }),
        IssueLog.sum('fine_amount', { where }),
        IssueLog.findAll({
          where,
          include: [{ model: Book, as: 'book', attributes: ['book_id', 'title', 'author'], required: true }],
          order: [['issue_date', 'DESC'], ['issue_id', 'DESC']],
          limit: a.limit,
        }),
      ]);
      return {
        found: true,
        ambiguous: false,
        member: {
          member_id: member.member_id,
          member_name: member.name,
          member_type: member.member_type,
          is_active: member.is_active,
        },
        summary: {
          total_loans: total,
          open_loans: open,
          overdue_loans: overdue,
          fines_recorded_on_returned_loans: round2(fines),
        },
        returned: rows.length,
        truncated: total > rows.length,
        items: rows.map((r) => ({
          issue_id: r.issue_id,
          book_id: r.book.book_id,
          book_title: r.book.title,
          issue_date: r.issue_date,
          due_date: r.due_date,
          return_date: r.return_date,
          status: loanStatus(r),
          fine: r.return_date ? round2(r.fine_amount) : calculateFine(r.due_date, null),
          fine_paid: r.return_date ? Boolean(r.fine_paid) : null,
        })),
      };
    },
  },

  getOutstandingFines: {
    description:
      'Outstanding fines: (1) fines currently accruing on overdue loans that are not yet returned, ' +
      'and (2) fines recorded on returned loans that are not marked as paid. ' +
      'Returns both totals, the combined total, and the largest individual fines.',
    params: { limit: limitParam },
    handler: async (a) => {
      const unpaidWhere = { return_date: { [Op.ne]: null }, fine_amount: { [Op.gt]: 0 }, fine_paid: false };
      const [accruingRows, unpaidCount, unpaidSum, unpaidRows] = await Promise.all([
        IssueLog.findAll({
          where: openOverdueWhere(),
          include: [
            { model: Member, as: 'member', attributes: ['member_id', 'name'], required: true },
            { model: Book, as: 'book', attributes: ['book_id', 'title'], required: true },
          ],
          limit: MAX_AGGREGATE_ROWS,
        }),
        IssueLog.count({ where: unpaidWhere }),
        IssueLog.sum('fine_amount', { where: unpaidWhere }),
        IssueLog.findAll({
          where: unpaidWhere,
          include: [
            { model: Member, as: 'member', attributes: ['member_id', 'name'], required: true },
            { model: Book, as: 'book', attributes: ['book_id', 'title'], required: true },
          ],
          order: [['fine_amount', 'DESC']],
          limit: a.limit,
        }),
      ]);

      const accruing = accruingRows
        .map((r) => ({
          kind: 'accruing_on_open_loan',
          issue_id: r.issue_id,
          member_id: r.member.member_id,
          member_name: r.member.name,
          book_title: r.book.title,
          due_date: r.due_date,
          fine: calculateFine(r.due_date, null),
        }))
        .filter((r) => r.fine > 0);
      const accruingTotal = accruing.reduce((s, r) => s + r.fine, 0);

      const unpaid = unpaidRows.map((r) => ({
        kind: 'unpaid_on_returned_loan',
        issue_id: r.issue_id,
        member_id: r.member.member_id,
        member_name: r.member.name,
        book_title: r.book.title,
        due_date: r.due_date,
        fine: round2(r.fine_amount),
      }));

      const items = [...accruing, ...unpaid].sort((x, y) => y.fine - x.fine).slice(0, a.limit);
      return {
        accruing_on_open_loans: {
          loans_with_fine: accruing.length,
          total: round2(accruingTotal),
          is_complete: accruingRows.length < MAX_AGGREGATE_ROWS,
        },
        unpaid_on_returned_loans: { loans: unpaidCount, total: round2(unpaidSum) },
        combined_total: round2(accruingTotal + num(unpaidSum)),
        returned: items.length,
        items,
      };
    },
  },
};

/* ------------------------------ validation ------------------------------- */

/**
 * Validate and normalise raw model-supplied arguments against a tool's params.
 * - unknown keys are dropped
 * - wrong types / bad enum values / missing required values are rejected
 * - integers outside [min,max] are clamped
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
const validateArgs = (params, raw) => {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = [];
  const value = {};

  for (const [key, rule] of Object.entries(params)) {
    let v = input[key];
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    if (empty) {
      if (rule.required) errors.push(`"${key}" is required`);
      else if (rule.default !== undefined) value[key] = rule.default;
      continue;
    }

    if (rule.type === 'string') {
      if (typeof v !== 'string') { errors.push(`"${key}" must be a string`); continue; }
      v = v.trim();
      if (v.length > (rule.max || 100)) { errors.push(`"${key}" is too long (max ${rule.max || 100} characters)`); continue; }
      value[key] = v;
    } else if (rule.type === 'integer') {
      const n = typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? parseInt(v, 10) : v;
      if (typeof n !== 'number' || !Number.isInteger(n)) { errors.push(`"${key}" must be an integer`); continue; }
      value[key] = Math.min(Math.max(n, rule.min ?? Number.MIN_SAFE_INTEGER), rule.max ?? Number.MAX_SAFE_INTEGER);
    } else if (rule.type === 'enum') {
      if (typeof v !== 'string' || !rule.values.includes(v)) {
        errors.push(`"${key}" must be one of: ${rule.values.join(', ')}`);
        continue;
      }
      value[key] = v;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
};

/* ------------------------------- public API ------------------------------- */

/** Provider-neutral tool definitions (name, description, params). */
const getToolDefinitions = () =>
  Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, params: t.params }));

const classifyError = (err) => {
  const name = err && err.name ? String(err.name) : '';
  if (name.startsWith('Sequelize')) return { code: 'DATABASE_ERROR', message: 'The library database could not be queried right now.' };
  return { code: 'INTERNAL_ERROR', message: 'The data lookup failed unexpectedly.' };
};

/**
 * Execute an approved tool. Never throws.
 * @returns {Promise<{ok:true,data:object,as_of:string}|{ok:false,error:{code:string,message:string}}>}
 */
const runTool = async (name, rawArgs) => {
  const tool = Object.prototype.hasOwnProperty.call(TOOLS, name) ? TOOLS[name] : null;
  if (!tool) {
    return { ok: false, error: { code: 'UNKNOWN_TOOL', message: `"${String(name).slice(0, 60)}" is not an available tool.` } };
  }
  const checked = validateArgs(tool.params, rawArgs);
  if (!checked.ok) {
    return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: checked.errors.join('; ') } };
  }
  try {
    const data = await tool.handler(checked.value);
    return { ok: true, data, as_of: new Date().toISOString() };
  } catch (err) {
    // Log only the error class + short message: never arguments, never row data.
    console.error(`[ai-tool] ${name} failed: ${err && err.name}: ${String(err && err.message).slice(0, 200)}`);
    return { ok: false, error: classifyError(err) };
  }
};

/**
 * Copy of a tool result that is safe to send to the external AI provider.
 * When shareMemberNames is false, member names are replaced with "Member #id".
 * (The unredacted result is still returned to the authenticated librarian's browser.)
 */
const toModelView = (result, { shareMemberNames = true } = {}) => {
  if (shareMemberNames) return result;
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      if ('member_name' in out && out.member_id !== undefined) out.member_name = `Member #${out.member_id}`;
      return out;
    }
    return node;
  };
  return walk(result);
};

module.exports = {
  getToolDefinitions,
  runTool,
  toModelView,
  // exported for unit tests
  validateArgs,
  todayStr,
  periodRange,
  previousRange,
  TOOLS,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
