const sequelize = require('../config/database');
const Admin = require('./Admin');
const Member = require('./Member');
const Book = require('./Book');
const IssueLog = require('./IssueLog');

// Associations
Member.hasMany(IssueLog, { foreignKey: 'member_id', as: 'issues' });
IssueLog.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

Book.hasMany(IssueLog, { foreignKey: 'book_id', as: 'issues' });
IssueLog.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

Admin.hasMany(IssueLog, { foreignKey: 'issued_by', as: 'issued_logs' });
IssueLog.belongsTo(Admin, { foreignKey: 'issued_by', as: 'issuer' });

module.exports = { sequelize, Admin, Member, Book, IssueLog };
