/**
 * Seed script: imports all exams and questions from
 * examtopics-practice/public/exams/ into MongoDB.
 *
 * Usage (from examtopics-backend folder):
 *   node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ── Models ────────────────────────────────────────────────────────────────────

const examSchema = new mongoose.Schema({
  name:          { type: mongoose.Schema.Types.Mixed, required: true },
  code:          { type: String, required: true, unique: true, index: true },
  slug:          { type: String },
  file:          { type: String },
  description:   { type: mongoose.Schema.Types.Mixed, required: true },
  category:      { type: String },
  difficulty:    { type: String },
  estimatedTime: { type: Number },
  tags:          [{ type: String }],
  questionCount: { type: Number, default: 0 },
  createdBy:     { type: String, required: false },
}, { timestamps: true });

const questionSchema = new mongoose.Schema({
  examId:          { type: String, required: true, index: true },
  question_number: { type: Number, required: true },
  topic_number:    { type: Number, default: 1 },
  title:           { type: String },
  question_text:   { type: String, required: true },
  answers:         { type: Map, of: String, required: true },
  suggested_answer:{ type: String, required: true },
  answer:          { type: String },
  link:            { type: String },
  multiple_choice: { type: Boolean, default: false },
  answer_images:   { type: [String], default: [] },
  question_images: { type: [String], default: [] },
}, { timestamps: true });

questionSchema.index(
  { examId: 1, topic_number: 1, question_number: 1 },
  { unique: true }
);

const Exam     = mongoose.model('Exam',     examSchema);
const Question = mongoose.model('Question', questionSchema);

// ── Config ────────────────────────────────────────────────────────────────────

// Path to examtopics-practice/public/exams/ relative to examtopics-backend/
const EXAMS_DIR = path.join(__dirname, '..', 'examtopics-practice', 'public', 'exams');
const EXAMS_MANIFEST = path.join(EXAMS_DIR, 'exams.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveCodeFromId(id) {
  // exams.json uses "id" like "aws-saa-c03" → use as code
  return id;
}

async function seedExam(examMeta) {
  const code = deriveCodeFromId(examMeta.id);

  // Upsert exam record
  await Exam.findOneAndUpdate(
    { code },
    {
      code,
      name:          examMeta.name,
      slug:          examMeta.slug,
      file:          examMeta.file,
      description:   examMeta.description,
      category:      examMeta.category,
      difficulty:    examMeta.difficulty,
      estimatedTime: Number(examMeta.estimatedTime) || 0,
      tags:          examMeta.tags || [],
      questionCount: examMeta.questionCount || 0,
    },
    { upsert: true, new: true }
  );

  // Load individual exam JSON (questions)
  const examFile = path.join(EXAMS_DIR, path.basename(examMeta.file));
  if (!fs.existsSync(examFile)) {
    console.warn(`  ⚠  Question file not found, skipping questions: ${examFile}`);
    return 0;
  }

  const raw = JSON.parse(fs.readFileSync(examFile, 'utf8'));

  // The JSON can be an array of questions directly, or { questions: [...] }
  const questions = Array.isArray(raw) ? raw : (raw.questions || []);

  if (questions.length === 0) {
    console.warn(`  ⚠  No questions found in ${examFile}`);
    return 0;
  }

  let inserted = 0;
  let skipped  = 0;

  for (const q of questions) {
    // Normalise answers: could be object or Map-like
    let answers = q.answers || {};
    if (answers instanceof Map) answers = Object.fromEntries(answers);

    const doc = {
      examId:          code,
      question_number: q.question_number ?? q.questionNumber ?? q.number ?? 0,
      topic_number:    q.topic_number    ?? q.topicNumber    ?? 1,
      title:           q.title           ?? '',
      question_text:   q.question_text   ?? q.questionText   ?? q.text ?? '',
      answers,
      suggested_answer: String(q.suggested_answer ?? q.suggestedAnswer ?? q.correct_answer ?? ''),
      answer:           q.answer         ?? null,
      link:             q.link           ?? '',
      multiple_choice:  q.multiple_choice ?? q.multipleChoice ?? false,
      answer_images:    q.answer_images   ?? q.answerImages   ?? [],
      question_images:  q.question_images ?? q.questionImages ?? [],
    };

    // Skip if question_text is empty (malformed entry)
    if (!doc.question_text) { skipped++; continue; }

    try {
      await Question.findOneAndUpdate(
        { examId: code, topic_number: doc.topic_number, question_number: doc.question_number },
        doc,
        { upsert: true, new: true }
      );
      inserted++;
    } catch (err) {
      console.error(`  ✗ Q${doc.question_number}: ${err.message}`);
      skipped++;
    }
  }

  // Update questionCount to actual number seeded
  await Exam.findOneAndUpdate({ code }, { questionCount: inserted });

  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  if (!fs.existsSync(EXAMS_MANIFEST)) {
    console.error(`exams.json not found at: ${EXAMS_MANIFEST}`);
    process.exit(1);
  }

  const examList = JSON.parse(fs.readFileSync(EXAMS_MANIFEST, 'utf8'));
  console.log(`Found ${examList.length} exams in exams.json\n`);

  let totalQuestions = 0;

  for (const examMeta of examList) {
    process.stdout.write(`Seeding [${examMeta.id}] ${typeof examMeta.name === 'object' ? examMeta.name.en : examMeta.name} ... `);
    try {
      const count = await seedExam(examMeta);
      console.log(`✓ ${count} questions`);
      totalQuestions += count;
    } catch (err) {
      console.error(`✗ ERROR: ${err.message}`);
    }
  }

  console.log(`\nDone! Seeded ${examList.length} exams, ${totalQuestions} questions total.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
