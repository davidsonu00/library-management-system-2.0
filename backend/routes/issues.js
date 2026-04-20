const express = require('express');
const router = express.Router();
const { getAllIssues, issueBook, returnBook, getIssueById, getDashboardStats } = require('../controllers/issueController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/dashboard', getDashboardStats);
router.get('/', getAllIssues);
router.get('/:id', getIssueById);
router.post('/', issueBook);
router.put('/:id/return', returnBook);

module.exports = router;
