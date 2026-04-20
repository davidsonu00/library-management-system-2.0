const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Book = sequelize.define('Book', {
  book_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  author: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  isbn: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  publisher: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  publish_year: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  total_copies: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  available_copies: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  shelf_location: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'books',
  timestamps: true
});

module.exports = Book;
