const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(path.join(__dirname, 'clues.db'));
db.pragma('journal_mode = WAL');

function cleanText(str) {
  if (!str) return str;
  return str.replace(/\\"/g, '"').replace(/\\/g, '');
}

// ============================================================
// DAILY FIVE - Same 5 categories, 3 clues each, for everyone
// ============================================================

function getDailySeed() {
  // Seed based on date so everyone gets the same puzzle
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  return dateStr;
}

function seededRandom(seed) {
  // Simple seeded PRNG
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  let state = hash;
  return function() {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function seededShuffle(arr, rng) {
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled;
}

// Get all normalized categories with enough clues
const categoryList = db.prepare(
  "SELECT normalized_category, COUNT(*) as cnt FROM clues WHERE is_media_dependent = 0 AND normalized_category != 'Other' GROUP BY normalized_category HAVING cnt >= 50 ORDER BY cnt DESC"
).all();

app.get('/api/daily', (req, res) => {
  const dateStr = getDailySeed();
  const rng = seededRandom(dateStr);

  // Pick 5 categories deterministically for today
  const shuffledCats = seededShuffle(categoryList, rng);
  const selectedCats = shuffledCats.slice(0, 5);

  const dailyClues = [];

  for (const cat of selectedCats) {
    // Get clues for this category, mix difficulties
    const allClues = db.prepare(
      "SELECT id, category, normalized_category, answer, question, difficulty, clue_value, round FROM clues WHERE normalized_category = ? AND is_media_dependent = 0 ORDER BY id"
    ).all(cat.normalized_category);

    // Deterministically pick 3 clues of varying difficulty
    const shuffledClues = seededShuffle(allClues, rng);

    // Try to get one easy, one medium, one hard
    const easy = shuffledClues.find(c => c.difficulty <= 2);
    const medium = shuffledClues.find(c => c.difficulty === 3);
    const hard = shuffledClues.find(c => c.difficulty >= 4);

    const picked = [
      easy || shuffledClues[0],
      medium || shuffledClues[1],
      hard || shuffledClues[2]
    ].filter(Boolean);

    // Fill to 3 if needed
    while (picked.length < 3) {
      const next = shuffledClues.find(c => !picked.includes(c));
      if (next) picked.push(next);
      else break;
    }

    dailyClues.push({
      category: cat.normalized_category,
      originalCategory: picked[0] ? picked[0].category : cat.normalized_category,
      clues: picked.map(c => ({
        id: c.id,
        clue: cleanText(c.answer),
        correctResponse: cleanText(c.question),
        difficulty: c.difficulty,
        value: c.clue_value
      }))
    });
  }

  res.json({
    date: dateStr,
    categories: dailyClues
  });
});

// ============================================================
// TRAINING SESSION - Coach-decided session based on user profile
// ============================================================

app.get('/api/session', (req, res) => {
  // For now: generate a mixed training session
  // Later: personalized based on user's weakness profile
  const rng = seededRandom(Date.now().toString() + Math.random().toString());

  const shuffledCats = seededShuffle(categoryList, rng);
  const selectedCats = shuffledCats.slice(0, 6);

  const sessionClues = [];

  for (const cat of selectedCats) {
    const allClues = db.prepare(
      "SELECT id, category, normalized_category, answer, question, difficulty, clue_value, round FROM clues WHERE normalized_category = ? AND is_media_dependent = 0 ORDER BY RANDOM() LIMIT 5"
    ).all(cat.normalized_category);

    sessionClues.push({
      category: cat.normalized_category,
      originalCategory: allClues[0] ? allClues[0].category : cat.normalized_category,
      clues: allClues.map(c => ({
        id: c.id,
        clue: cleanText(c.answer),
        correctResponse: cleanText(c.question),
        difficulty: c.difficulty,
        value: c.clue_value
      }))
    });
  }

  res.json({ categories: sessionClues });
});

// ============================================================
// CATEGORY LIST - For mastery map
// ============================================================

app.get('/api/categories', (req, res) => {
  res.json({ categories: categoryList });
});

// ============================================================
// CATEGORY DRILL - Get clues for a specific category
// ============================================================

app.get('/api/category/:name', (req, res) => {
  const count = parseInt(req.query.count) || 20;
  const difficulty = req.query.difficulty ? parseInt(req.query.difficulty) : null;

  let query = "SELECT id, category, normalized_category, answer, question, difficulty, clue_value FROM clues WHERE normalized_category = ? AND is_media_dependent = 0";
  const params = [req.params.name];

  if (difficulty) {
    query += " AND difficulty = ?";
    params.push(difficulty);
  }

  query += " ORDER BY RANDOM() LIMIT ?";
  params.push(count);

  const clues = db.prepare(query).all(...params);

  res.json({
    category: req.params.name,
    clues: clues.map(c => ({
      id: c.id,
      clue: cleanText(c.answer),
      correctResponse: cleanText(c.question),
      difficulty: c.difficulty,
      value: c.clue_value,
      originalCategory: c.category
    }))
  });
});

// ============================================================
// STATS
// ============================================================

app.get('/api/stats', (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as count FROM clues WHERE is_media_dependent = 0").get();
  const byCategory = db.prepare(
    "SELECT normalized_category, COUNT(*) as count FROM clues WHERE is_media_dependent = 0 AND normalized_category != 'Other' GROUP BY normalized_category ORDER BY count DESC"
  ).all();
  const byDifficulty = db.prepare(
    "SELECT difficulty, COUNT(*) as count FROM clues WHERE is_media_dependent = 0 GROUP BY difficulty ORDER BY difficulty"
  ).all();

  res.json({
    totalClues: total.count,
    byCategory,
    byDifficulty
  });
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('JeopardyCoach running on http://localhost:' + PORT);
});
