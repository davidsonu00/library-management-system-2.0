const { Op, fn, col, literal } = require('sequelize');
const { IssueLog, Book, Member, Admin } = require('../models');
const sequelize = require('../config/database');

const FINE_PER_DAY = parseFloat(process.env.FINE_PER_DAY) || 5;
const LOAN_DAYS = parseInt(process.env.LOAN_DAYS) || 14;

const calculateFine = (dueDate, returnDate) => {
  const due = new Date(dueDate);
  const ret = returnDate ? new Date(returnDate) : new Date();
  const diffDays = Math.floor((ret - due) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays * FINE_PER_DAY : 0;
};

const getAllIssues = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status === 'issued') where.return_date = null;
    else if (status === 'returned') where.return_date = { [Op.not]: null };
    else if (status === 'overdue') {
      where.return_date = null;
      where.due_date = { [Op.lt]: new Date() };
    }

    const memberWhere = {};
    const bookWhere = {};
    if (search) {
      memberWhere.name = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await IssueLog.findAndCountAll({
      where,
      include: [
        { model: Member, as: 'member', attributes: ['member_id', 'name', 'email', 'phone'], where: search ? memberWhere : undefined, required: !!search },
        { model: Book, as: 'book', attributes: ['book_id', 'title', 'author', 'category'] },
        { model: Admin, as: 'issuer', attributes: ['name', 'email'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['issue_date', 'DESC']]
    });

    const issuesWithFine = rows.map(issue => {
      const obj = issue.toJSON();
      if (!obj.return_date) {
        obj.current_fine = calculateFine(obj.due_date, null);
        obj.is_overdue = new Date(obj.due_date) < new Date();
      } else {
        obj.current_fine = obj.fine_amount;
        obj.is_overdue = false;
      }
      return obj;
    });

    res.json({
      success: true,
      data: {
        issues: issuesWithFine,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
};

const issueBook = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { member_id, book_id, loan_days } = req.body;

    if (!member_id || !book_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Member ID and Book ID are required' });
    }

    const book = await Book.findByPk(book_id, { transaction: t, lock: true });
    if (!book) { await t.rollback(); return res.status(404).json({ success: false, message: 'Book not found' }); }
    if (book.available_copies <= 0) { await t.rollback(); return res.status(400).json({ success: false, message: 'Book not available — all copies are issued' }); }

    const member = await Member.findByPk(member_id, { transaction: t });
    if (!member) { await t.rollback(); return res.status(404).json({ success: false, message: 'Member not found' }); }

    // Check if member already has this book
    const existingIssue = await IssueLog.findOne({
      where: { member_id, book_id, return_date: null },
      transaction: t
    });
    if (existingIssue) { await t.rollback(); return res.status(400).json({ success: false, message: 'Member already has this book issued' }); }

    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (loan_days || LOAN_DAYS));

    const issue = await IssueLog.create({
      member_id,
      book_id,
      issued_by: req.admin.admin_id,
      issue_date: issueDate,
      due_date: dueDate,
      status: 'issued'
    }, { transaction: t });

    await book.update({ available_copies: book.available_copies - 1 }, { transaction: t });

    await t.commit();

    const fullIssue = await IssueLog.findByPk(issue.issue_id, {
      include: [
        { model: Member, as: 'member', attributes: ['name', 'email', 'phone'] },
        { model: Book, as: 'book', attributes: ['title', 'author', 'category'] }
      ]
    });

    res.status(201).json({ success: true, message: 'Book issued successfully', data: fullIssue });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

const returnBook = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const issue = await IssueLog.findOne({
      where: { issue_id: req.params.id },
      transaction: t,
      lock: {
        level: t.LOCK.UPDATE,
        of: IssueLog
      }
    });

    if (!issue) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Issue record not found' });
    }

    if (issue.return_date) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Book already returned' });
    }

    const returnDate = new Date();
    const fine = calculateFine(issue.due_date, returnDate);

    await issue.update({
      return_date: returnDate,
      fine_amount: fine,
      status: 'returned'
    }, { transaction: t });

    await Book.increment('available_copies', {
      by: 1,
      where: { book_id: issue.book_id },
      transaction: t
    });

    await t.commit();

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: { fine_amount: fine }
    });

  } catch (error) {
    await t.rollback();
    next(error);
  }
};

const getIssueById = async (req, res, next) => {
  try {
    const issue = await IssueLog.findByPk(req.params.id, {
      include: [
        { model: Member, as: 'member' },
        { model: Book, as: 'book' },
        { model: Admin, as: 'issuer', attributes: ['name', 'email'] }
      ]
    });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const obj = issue.toJSON();
    if (!obj.return_date) {
      obj.current_fine = calculateFine(obj.due_date, null);
      obj.is_overdue = new Date(obj.due_date) < new Date();
    }

    res.json({ success: true, data: obj });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalBooks, totalMembers, totalIssued, overdueCount] = await Promise.all([
      Book.count(),
      Member.count({ where: { is_active: true } }),
      IssueLog.count({ where: { return_date: null } }),
      IssueLog.count({ where: { return_date: null, due_date: { [Op.lt]: new Date() } } })
    ]);

    const availableBooks = await Book.sum('available_copies');

    // Monthly issue trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await IssueLog.findAll({
      attributes: [
  [fn('TO_CHAR', col('issue_date'), 'YYYY-MM'), 'month'],
  [fn('COUNT', col('issue_id')), 'count']
],
group: [fn('TO_CHAR', col('issue_date'), 'YYYY-MM')],
order: [[fn('TO_CHAR', col('issue_date'), 'YYYY-MM'), 'ASC']],
      raw: true
    });

    const recentIssues = await IssueLog.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Member, as: 'member', attributes: ['name'] },
        { model: Book, as: 'book', attributes: ['title'] }
      ]
    });

    res.json({
      success: true,
      data: {
        stats: { totalBooks, availableBooks, totalMembers, totalIssued, overdueCount },
        monthlyTrend,
        recentIssues
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllIssues, issueBook, returnBook, getIssueById, getDashboardStats };
