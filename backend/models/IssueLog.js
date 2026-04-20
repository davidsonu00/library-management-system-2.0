const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IssueLog = sequelize.define('IssueLog', {
  issue_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'members', key: 'member_id' }
  },
  book_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'books', key: 'book_id' }
  },
  issued_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'admins', key: 'admin_id' }
  },
  issue_date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  return_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  fine_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  fine_paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('issued', 'returned', 'overdue'),
    defaultValue: 'issued'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'issue_log',
  timestamps: true
});

module.exports = IssueLog;
