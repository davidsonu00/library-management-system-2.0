const express = require('express');
const router = express.Router();
const { getAllBooks, getBook, createBook, updateBook, deleteBook, getCategories } = require('../controllers/bookController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/categories', getCategories);
router.get('/', getAllBooks);
router.get('/:id', getBook);
router.post('/', createBook);
router.put('/:id', updateBook);
router.delete('/:id', deleteBook);

module.exports = router;
