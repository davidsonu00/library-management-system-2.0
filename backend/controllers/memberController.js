const { Op } = require('sequelize');
const { Member, IssueLog, Book } = require('../models');

const getAllMembers = async (req, res, next) => {
  try {
    const { search, member_type, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const where = { is_active: true };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }
    if (member_type) where.member_type = member_type;

    const { count, rows } = await Member.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        members: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getMember = async (req, res, next) => {
  try {
    const member = await Member.findByPk(req.params.id, {
      include: [{
        model: IssueLog, as: 'issues',
        include: [{ model: Book, as: 'book', attributes: ['title', 'author', 'category'] }],
        order: [['issue_date', 'DESC']]
      }]
    });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
};

const createMember = async (req, res, next) => {
  try {
    const { name, email, phone, address, member_type } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }
    const member = await Member.create({ name, email, phone, address, member_type });
    res.status(201).json({ success: true, message: 'Member added successfully', data: member });
  } catch (error) {
    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    await member.update(req.body);
    res.json({ success: true, message: 'Member updated successfully', data: member });
  } catch (error) {
    next(error);
  }
};

const deleteMember = async (req, res, next) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const activeIssues = await IssueLog.count({
      where: { member_id: req.params.id, return_date: null }
    });
    if (activeIssues > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete member with active book issues' });
    }

    await member.update({ is_active: false });
    res.json({ success: true, message: 'Member deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllMembers, getMember, createMember, updateMember, deleteMember };
