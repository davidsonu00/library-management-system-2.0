const { Op } = require('sequelize');
const { Book, IssueLog, Member } = require('../models');

const getAllBooks = async (req, res, next) => {
  try {
    const { search, category, availability, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { author: { [Op.like]: `%${search}%` } },
        { isbn: { [Op.like]: `%${search}%` } }
      ];
    }
    if (category) where.category = category;
    if (availability === 'available') where.available_copies = { [Op.gt]: 0 };
    if (availability === 'unavailable') where.available_copies = 0;

    const { count, rows } = await Book.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort, order.toUpperCase()]]
    });

    res.json({
      success: true,
      data: {
        books: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getBook = async (req, res, next) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
    res.json({ success: true, data: book });
  } catch (error) {
    next(error);
  }
};

const createBook = async (req, res, next) => {
  try {
    const { title, author, isbn, category, publisher, publish_year, total_copies, shelf_location, description } = req.body;

    if (!title || !author) {
      return res.status(400).json({ success: false, message: 'Title and author are required' });
    }

    const copies = parseInt(total_copies) || 1;
    const book = await Book.create({
      title, author, isbn, category, publisher, publish_year,
      total_copies: copies,
      available_copies: copies,
      shelf_location, description
    });

    res.status(201).json({ success: true, message: 'Book added successfully', data: book });
  } catch (error) {
    next(error);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

    const { title, author, isbn, category, publisher, publish_year, total_copies, shelf_location, description } = req.body;

    if (total_copies !== undefined) {
      const diff = parseInt(total_copies) - book.total_copies;
      req.body.available_copies = Math.max(0, book.available_copies + diff);
    }

    await book.update(req.body);
    res.json({ success: true, message: 'Book updated successfully', data: book });
  } catch (error) {
    next(error);
  }
};

const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

    const activeIssues = await IssueLog.count({
      where: { book_id: req.params.id, return_date: null }
    });

    if (activeIssues > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete book with active issues' });
    }

    await book.destroy();
    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await Book.findAll({
      attributes: ['category'],
      where: { category: { [Op.not]: null } },
      group: ['category'],
      raw: true
    });
    res.json({ success: true, data: categories.map(c => c.category) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllBooks, getBook, createBook, updateBook, deleteBook, getCategories };
