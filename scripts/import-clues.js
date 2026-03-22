const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const TSV_PATH = path.join(__dirname, '..', 'data', 'jeopardy_dataset_seasons_1-41', 'combined_season1-41.tsv');
const DB_PATH = path.join(__dirname, '..', 'clues.db');

// Category normalization: map creative Jeopardy category names to ~50 core knowledge domains
const CATEGORY_MAP = {
  // Literature & Language
  'literature': 'Literature', 'authors': 'Literature', 'novels': 'Literature', 'fiction': 'Literature',
  'nonfiction': 'Literature', 'books': 'Literature', 'best sellers': 'Literature', 'classic literature': 'Literature',
  'poetry': 'Literature', 'poets': 'Literature', 'poems': 'Literature',
  'shakespeare': 'Shakespeare', 'the bard': 'Shakespeare', 'shakespearean characters': 'Shakespeare',
  'word origins': 'Word Origins', 'etymology': 'Word Origins', 'word history': 'Word Origins',
  'words': 'Vocabulary', 'vocabulary': 'Vocabulary', 'definitions': 'Vocabulary',
  'foreign words & phrases': 'Languages', 'languages': 'Languages', 'french': 'Languages',
  'spanish': 'Languages', 'latin': 'Languages', 'italian': 'Languages',

  // History
  'american history': 'American History', 'u.s. history': 'American History', 'colonial america': 'American History',
  'the civil war': 'American History', 'the american revolution': 'American History',
  'world history': 'World History', 'ancient history': 'World History', 'medieval times': 'World History',
  'european history': 'World History', 'asian history': 'World History',
  'history': 'History', 'historic people': 'History', 'historic events': 'History',
  'the bible': 'The Bible', 'biblical': 'The Bible', 'the old testament': 'The Bible',
  'the new testament': 'The Bible', 'biblical figures': 'The Bible',

  // Science & Nature
  'science': 'Science', 'scientists': 'Science', 'inventions': 'Science',
  'biology': 'Biology', 'zoology': 'Biology', 'botany': 'Biology',
  'animals': 'Animals', 'animal world': 'Animals', 'birds': 'Animals', 'mammals': 'Animals',
  'chemistry': 'Chemistry', 'the elements': 'Chemistry', 'chemical elements': 'Chemistry',
  'physics': 'Physics', 'physical science': 'Physics',
  'astronomy': 'Astronomy', 'the solar system': 'Astronomy', 'space': 'Astronomy', 'planets': 'Astronomy',
  'nature': 'Nature', 'trees': 'Nature', 'flowers': 'Nature', 'plants': 'Nature',
  'medicine': 'Medicine', 'health': 'Medicine', 'the human body': 'Medicine', 'anatomy': 'Medicine',
  'math': 'Math', 'mathematics': 'Math', 'numbers': 'Math',

  // Geography
  'geography': 'Geography', 'world geography': 'Geography',
  'u.s. geography': 'U.S. Geography', 'american geography': 'U.S. Geography',
  'state capitals': 'U.S. Geography', 'u.s. states': 'U.S. Geography', 'u.s. cities': 'U.S. Geography',
  'world capitals': 'World Geography', 'countries of the world': 'World Geography',
  'islands': 'Geography', 'rivers': 'Geography', 'lakes & rivers': 'Geography', 'mountains': 'Geography',
  'africa': 'World Geography', 'asia': 'World Geography', 'europe': 'World Geography',
  'south america': 'World Geography', 'australia': 'World Geography',

  // Arts & Entertainment
  'opera': 'Opera', 'operas': 'Opera', 'at the opera': 'Opera',
  'classical music': 'Classical Music', 'composers': 'Classical Music', 'symphonies': 'Classical Music',
  'music': 'Music', 'rock & roll': 'Music', 'pop music': 'Music', 'rock music': 'Music',
  'jazz': 'Music', 'country music': 'Music', 'musical instruments': 'Music',
  'movies': 'Movies', 'movie stars': 'Movies', 'at the movies': 'Movies', 'film': 'Movies',
  'oscar winners': 'Movies', 'oscar-winning films': 'Movies', 'directors': 'Movies',
  'television': 'Television', 'tv': 'Television', 'tv shows': 'Television', 'sitcoms': 'Television',
  'broadway': 'Theater', 'musicals': 'Theater', 'the tony awards': 'Theater', 'theatre': 'Theater',
  'art': 'Art', 'artists': 'Art', 'painters': 'Art', 'painting': 'Art', 'sculpture': 'Art',
  'ballet': 'Dance', 'dance': 'Dance',

  // Sports
  'sports': 'Sports', 'baseball': 'Sports', 'football': 'Sports', 'basketball': 'Sports',
  'the olympics': 'Sports', 'olympic games': 'Sports', 'tennis': 'Sports', 'golf': 'Sports',
  'hockey': 'Sports', 'boxing': 'Sports', 'soccer': 'Sports',

  // Government & Politics
  'u.s. presidents': 'U.S. Presidents', 'presidents': 'U.S. Presidents', 'the presidency': 'U.S. Presidents',
  'first ladies': 'U.S. Presidents', 'presidential': 'U.S. Presidents',
  'politics': 'Government & Politics', 'government': 'Government & Politics',
  'the u.s. constitution': 'Government & Politics', 'the supreme court': 'Government & Politics',
  'world leaders': 'Government & Politics', 'royalty': 'Government & Politics',

  // Food & Drink
  'food': 'Food & Drink', 'food & drink': 'Food & Drink', 'potent potables': 'Food & Drink',
  'cooking': 'Food & Drink', 'cuisine': 'Food & Drink', 'desserts': 'Food & Drink',
  'wine': 'Food & Drink', 'beer': 'Food & Drink', 'beverages': 'Food & Drink',

  // Mythology & Religion
  'mythology': 'Mythology', 'greek mythology': 'Mythology', 'roman mythology': 'Mythology',
  'norse mythology': 'Mythology', 'myths & legends': 'Mythology',
  'religion': 'Religion', 'world religions': 'Religion',

  // Colleges & Education
  'colleges & universities': 'Colleges', 'college life': 'Colleges', 'universities': 'Colleges',

  // Wordplay & Puzzles
  'before & after': 'Wordplay', 'rhyme time': 'Wordplay', 'common bonds': 'Wordplay',
  'stupid answers': 'Wordplay', 'anagram': 'Wordplay', 'starts with': 'Wordplay',

  // Potpourri
  'potpourri': 'Potpourri', 'hodgepodge': 'Potpourri', 'grab bag': 'Potpourri',
  'miscellaneous': 'Potpourri', 'mixed bag': 'Potpourri',

  // Business & Economics
  'business & industry': 'Business', 'the economy': 'Business', 'brands': 'Business',
  'corporations': 'Business', 'wall street': 'Business',

  // Technology
  'technology': 'Technology', 'computers': 'Technology', 'the internet': 'Technology',
  'science & technology': 'Technology',

  // Fashion & Lifestyle
  'fashion': 'Lifestyle', 'toys & games': 'Lifestyle', 'holidays': 'Lifestyle',

  // Law
  'law': 'Law', 'crime': 'Law', 'crime & punishment': 'Law', 'lawyers': 'Law',
};

function normalizeCategory(rawCategory) {
  const lower = rawCategory.toLowerCase().trim().replace(/["\u201C\u201D]/g, '').replace(/!/g, '');

  // Direct match
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];

  // Substring matching for common patterns
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) && key.length > 3) return value;
  }

  // If no match, return 'Other'
  return 'Other';
}

function isLikelyMediaDependent(answer) {
  const mediaPatterns = [
    /\bseen here\b/i, /\bshown here\b/i, /\bpictured here\b/i,
    /\bin this (clip|scene|photo|picture|video)\b/i,
  ];
  return mediaPatterns.some(function(p) { return p.test(answer); });
}

function getDifficulty(round, clueValue) {
  if (round === 3) return 5;
  if (round === 1) {
    if (clueValue <= 200) return 1;
    if (clueValue <= 400) return 2;
    if (clueValue <= 600) return 3;
    if (clueValue <= 800) return 4;
    return 5;
  }
  // Round 2
  if (clueValue <= 400) return 1;
  if (clueValue <= 800) return 2;
  if (clueValue <= 1200) return 3;
  if (clueValue <= 1600) return 4;
  return 5;
}

console.log('Reading TSV...');
const raw = fs.readFileSync(TSV_PATH, 'utf-8');
const lines = raw.split('\n');
const header = lines[0].split('\t');
console.log('Header: ' + header.join(', '));
console.log('Total lines: ' + (lines.length - 1));

// Create database
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE clues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round INTEGER NOT NULL,
    clue_value INTEGER,
    daily_double_value INTEGER,
    category TEXT NOT NULL,
    normalized_category TEXT NOT NULL,
    comments TEXT,
    answer TEXT NOT NULL,
    question TEXT NOT NULL,
    air_date TEXT,
    notes TEXT,
    difficulty INTEGER NOT NULL,
    is_media_dependent INTEGER DEFAULT 0,
    season INTEGER
  );

  CREATE INDEX idx_normalized_category ON clues(normalized_category);
  CREATE INDEX idx_difficulty ON clues(difficulty);
  CREATE INDEX idx_round ON clues(round);
  CREATE INDEX idx_air_date ON clues(air_date);
  CREATE INDEX idx_is_media_dependent ON clues(is_media_dependent);
`);

const insert = db.prepare(
  'INSERT INTO clues (round, clue_value, daily_double_value, category, normalized_category, comments, answer, question, air_date, notes, difficulty, is_media_dependent, season) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

const insertMany = db.transaction(function(rows) {
  for (var i = 0; i < rows.length; i++) {
    insert.run.apply(insert, rows[i]);
  }
});

function extractSeason(airDate) {
  if (!airDate) return null;
  var parts = airDate.split('-');
  var year = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  // Jeopardy seasons start in September
  if (month >= 9) return year - 1983;
  return year - 1984;
}

var imported = 0;
var skipped = 0;
var mediaDep = 0;
var batch = [];
var categoryCounts = {};

for (var i = 1; i < lines.length; i++) {
  var line = lines[i].trim();
  if (!line) continue;

  var parts = line.split('\t');
  if (parts.length < 7) { skipped++; continue; }

  var round = parts[0], clueValue = parts[1], dailyDoubleValue = parts[2];
  var category = parts[3], comments = parts[4], answer = parts[5];
  var question = parts[6], airDate = parts[7], notes = parts[8];

  if (!answer || !question || !category) { skipped++; continue; }

  var normalizedCat = normalizeCategory(category);
  var mediaFlag = isLikelyMediaDependent(answer) ? 1 : 0;
  if (mediaFlag) mediaDep++;

  var difficulty = getDifficulty(parseInt(round) || 1, parseInt(clueValue) || 0);
  var season = extractSeason(airDate);

  categoryCounts[normalizedCat] = (categoryCounts[normalizedCat] || 0) + 1;

  batch.push([
    parseInt(round) || 1,
    parseInt(clueValue) || 0,
    parseInt(dailyDoubleValue) || 0,
    category,
    normalizedCat,
    comments || '',
    answer,
    question,
    airDate || '',
    notes || '',
    difficulty,
    mediaFlag,
    season
  ]);

  if (batch.length >= 10000) {
    insertMany(batch);
    imported += batch.length;
    batch = [];
    process.stdout.write('\rImported: ' + imported);
  }
}

if (batch.length > 0) {
  insertMany(batch);
  imported += batch.length;
}

console.log('\n\nDone!');
console.log('Imported: ' + imported);
console.log('Skipped: ' + skipped);
console.log('Media-dependent flagged: ' + mediaDep);
console.log('\nCategory distribution:');

var sorted = Object.entries(categoryCounts).sort(function(a, b) { return b[1] - a[1]; });
for (var j = 0; j < Math.min(30, sorted.length); j++) {
  console.log('  ' + sorted[j][0] + ': ' + sorted[j][1]);
}
if (sorted.length > 30) {
  console.log('  ... and ' + (sorted.length - 30) + ' more categories');
}
