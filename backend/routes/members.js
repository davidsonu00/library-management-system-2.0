const express = require('express');
const router = express.Router();
const { getAllMembers, getMember, createMember, updateMember, deleteMember } = require('../controllers/memberController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', getAllMembers);
router.get('/:id', getMember);
router.post('/', createMember);
router.put('/:id', updateMember);
router.delete('/:id', deleteMember);

module.exports = router;
