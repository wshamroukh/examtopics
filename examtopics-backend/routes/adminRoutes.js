/**
 * Admin Routes — no authentication required (internal use only)
 * Mount at /admin in index.js:
 *   const adminRoutes = require('./routes/adminRoutes');
 *   app.use('/admin', adminRoutes);
 *
 * Also add to CORS origins in getCorsOrigins():
 *   'http://localhost:5500',   // if opening admin.html via Live Server
 *   'null',                    // if opening admin.html directly (file://)
 */

const express = require('express');
const router = express.Router();
const examService = require('../services/examService');

// GET all exams
router.get('/exams', async (req, res, next) => {
  try {
    const exams = await examService.getAllExams();
    res.json({ success: true, count: exams.length, exams });
  } catch (e) { next(e); }
});

// GET exam by code
router.get('/exams/:code', async (req, res, next) => {
  try {
    const exam = await examService.getExamByCode(req.params.code);
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });
    res.json({ success: true, exam });
  } catch (e) { next(e); }
});

// POST create exam
router.post('/exams', async (req, res, next) => {
  try {
    const { questions, ...examData } = req.body;
    if (!examData.name || !examData.description) {
      return res.json({ success: false, message: 'Name and description are required' });
    }
    const exam = await examService.createExamWithQuestions(examData, questions, null);
    res.status(201).json({ success: true, exam });
  } catch (e) {
    if (e.code === 11000) {
      return res.json({ success: false, message: 'Exam code already exists.' });
    }
    next(e);
  }
});

// PUT update exam
router.put('/exams/:code', async (req, res, next) => {
  try {
    const { questions, ...updateData } = req.body;
    const exam = await examService.updateExamWithQuestions(req.params.code, updateData, questions);
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });
    res.json({ success: true, exam });
  } catch (e) { next(e); }
});

// DELETE exam
router.delete('/exams/:code', async (req, res, next) => {
  try {
    const exam = await examService.deleteExam(req.params.code);
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (e) { next(e); }
});

// GET questions for an exam
router.get('/questions/:code', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 50;
    const result = await examService.getQuestionsByExamCode(req.params.code, page, limit);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

// PUT update a specific question's answer
router.put('/questions/:examId/:topicNumber/:questionNumber', async (req, res, next) => {
  try {
    const Question = require('../models/Question');
    const { examId, topicNumber, questionNumber } = req.params;
    const update = req.body;

    const question = await Question.findOneAndUpdate(
      {
        examId,
        topic_number: parseInt(topicNumber),
        question_number: parseInt(questionNumber)
      },
      { $set: update },
      { new: true }
    );

    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    res.json({ success: true, question });
  } catch (e) { next(e); }
});

module.exports = router;
