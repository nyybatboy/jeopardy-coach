// ============================================================
// JeopardyCoach - Speak & Reveal Model
// ============================================================

(function() {
  'use strict';

  var appEl = document.getElementById('app');
  var TIMER_SECONDS = 8;
  var FAST_THRESHOLD_MS = 3000;
  var state = {
    mode: 'daily',
    categories: [],
    currentCatIndex: 0,
    currentClueIndex: 0,
    results: [],
    phase: 'loading', // loading, reading, revealed, summary
    timerInterval: null,
    timerStart: 0,
    dailyDate: '',
    dailyCompleted: false
  };

  function checkDailyCompleted() {
    var saved = localStorage.getItem('jc_daily_completed');
    if (saved) {
      try {
        var data = JSON.parse(saved);
        var today = new Date().toISOString().split('T')[0];
        if (data.date === today) {
          state.dailyCompleted = true;
          state.results = data.results || [];
          return true;
        }
      } catch(e) { /* ignore */ }
    }
    return false;
  }

  function saveDailyCompleted() {
    localStorage.setItem('jc_daily_completed', JSON.stringify({
      date: state.dailyDate,
      results: state.results
    }));
  }

  // ===== SAFE DOM HELPERS =====

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        if (key === 'className') node.className = attrs[key];
        else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        else if (key === 'style' && typeof attrs[key] === 'object') {
          Object.keys(attrs[key]).forEach(function(sk) { node.style[sk] = attrs[key][sk]; });
        } else node.setAttribute(key, attrs[key]);
      });
    }
    if (children !== undefined && children !== null) {
      if (Array.isArray(children)) {
        children.forEach(function(c) {
          if (c === null || c === undefined) return;
          if (typeof c === 'string') node.appendChild(document.createTextNode(c));
          else node.appendChild(c);
        });
      } else if (typeof children === 'string') {
        node.appendChild(document.createTextNode(children));
      } else {
        node.appendChild(children);
      }
    }
    return node;
  }

  function txt(str) { return document.createTextNode(str || ''); }

  // ===== RENDERING =====

  function render() {
    appEl.textContent = '';
    if (state.phase === 'loading') {
      appEl.appendChild(buildLoading());
    } else if (state.phase === 'reading') {
      appEl.appendChild(buildReading());
      startTimer();
    } else if (state.phase === 'revealed') {
      appEl.appendChild(buildRevealed());
    } else if (state.phase === 'summary') {
      appEl.appendChild(buildSummary());
    }
  }

  function buildHeader() {
    return el('div', {className: 'header'}, [
      el('h1', null, 'JeopardyCoach'),
      el('p', {className: 'subtitle'}, state.mode === 'daily' ? 'Daily Five' : 'Training Run')
    ]);
  }

  function buildLoading() {
    var frag = document.createDocumentFragment();
    frag.appendChild(buildHeader());
    frag.appendChild(el('div', {className: 'loading'}, [
      el('div', {className: 'spinner'}),
      txt('Loading clues...')
    ]));
    return frag;
  }

  function buildModeTabs() {
    return el('div', {className: 'mode-tabs'}, [
      el('button', {
        className: 'mode-tab' + (state.mode === 'daily' ? ' active' : ''),
        onClick: function() { switchMode('daily'); }
      }, 'Daily Five'),
      el('button', {
        className: 'mode-tab' + (state.mode === 'practice' ? ' active' : ''),
        onClick: function() { switchMode('practice'); }
      }, 'Practice')
    ]);
  }

  function buildDifficultyDots(difficulty) {
    var dots = [];
    for (var d = 1; d <= 5; d++) {
      dots.push(el('div', {className: 'dot' + (d <= difficulty ? ' filled' : '')}));
    }
    return el('div', {className: 'clue-difficulty'}, dots);
  }

  function buildProgressBar() {
    var totalClues = 0;
    var completedClues = state.results.length;
    state.categories.forEach(function(c) { totalClues += c.clues.length; });

    var pips = [];
    var idx = 0;
    for (var c = 0; c < state.categories.length; c++) {
      for (var q = 0; q < state.categories[c].clues.length; q++) {
        var cls = 'progress-pip';
        if (idx < completedClues) {
          var r = state.results[idx];
          if (r.correct && r.fast) cls += ' fast';
          else if (r.correct) cls += ' correct';
          else cls += ' missed';
        } else if (idx === completedClues) {
          cls += ' current';
        }
        pips.push(el('div', {className: cls}));
        idx++;
      }
      // Add category separator (except after last)
      if (c < state.categories.length - 1) {
        pips.push(el('div', {className: 'progress-sep'}));
      }
    }
    return el('div', {className: 'progress-bar'}, pips);
  }

  // ===== READING PHASE: Clue shown, timer running, tap to buzz =====

  function buildReading() {
    var ci = state.currentCatIndex;
    var qi = state.currentClueIndex;
    var cat = state.categories[ci];
    var clue = cat.clues[qi];
    var totalClues = 0;
    state.categories.forEach(function(c) { totalClues += c.clues.length; });

    var frag = document.createDocumentFragment();
    frag.appendChild(buildHeader());
    frag.appendChild(buildModeTabs());
    frag.appendChild(buildProgressBar());

    // Category banner
    frag.appendChild(el('div', {className: 'daily-banner'}, [
      el('div', null, el('span', {className: 'label'}, cat.category)),
      el('div', {className: 'date'}, '$' + (clue.value || '???'))
    ]));

    // The clue card
    var card = el('div', {className: 'clue-card active'});
    card.appendChild(buildDifficultyDots(clue.difficulty));
    card.appendChild(el('div', {className: 'clue-text'}, clue.clue));

    // Timer bar
    var timerFill = el('div', {className: 'fill', id: 'timer-fill', style: {width: '100%'}});
    card.appendChild(el('div', {className: 'timer-bar'}, timerFill));

    // The big buzz button
    var buzzBtn = el('button', {className: 'buzz-btn', id: 'buzz-btn', onClick: function() {
      clearTimer();
      state.buzzTime = Date.now() - state.timerStart;
      state.phase = 'revealed';
      render();
    }}, [
      el('span', {className: 'buzz-text'}, 'I KNOW IT'),
      el('span', {className: 'buzz-sub'}, 'space')
    ]);
    card.appendChild(buzzBtn);

    frag.appendChild(card);

    // Category list
    frag.appendChild(buildCategoryPreview(ci));

    // Keyboard handler
    setTimeout(function() {
      document.onkeydown = function(e) {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          clearTimer();
          state.buzzTime = Date.now() - state.timerStart;
          state.phase = 'revealed';
          render();
        }
      };
    }, 50);

    return frag;
  }

  // ===== REVEALED PHASE: Answer shown, self-assess =====

  function buildRevealed() {
    var ci = state.currentCatIndex;
    var qi = state.currentClueIndex;
    var cat = state.categories[ci];
    var clue = cat.clues[qi];
    var buzzTime = state.buzzTime || 0;
    var timedOut = buzzTime === 0 || buzzTime >= (TIMER_SECONDS * 1000);

    var frag = document.createDocumentFragment();
    frag.appendChild(buildHeader());
    frag.appendChild(buildModeTabs());
    frag.appendChild(buildProgressBar());

    // Category banner
    frag.appendChild(el('div', {className: 'daily-banner'}, [
      el('div', null, el('span', {className: 'label'}, cat.category)),
      el('div', {className: 'date'}, '$' + (clue.value || '???'))
    ]));

    // The clue card with answer revealed
    var card = el('div', {className: 'clue-card'});
    card.appendChild(buildDifficultyDots(clue.difficulty));
    card.appendChild(el('div', {className: 'clue-text', style: {opacity: '0.6', fontSize: '14px'}}, clue.clue));

    // The answer - big and bold
    var answerBox = el('div', {className: 'revealed-answer'}, [
      el('div', {className: 'answer-label'}, timedOut ? 'TIME\'S UP' : 'THE ANSWER'),
      el('div', {className: 'answer-text'}, clue.correctResponse)
    ]);
    card.appendChild(answerBox);

    if (!timedOut && buzzTime) {
      card.appendChild(el('div', {className: 'buzz-time'}, 'Buzz: ' + (buzzTime / 1000).toFixed(1) + 's'));
    }

    // Self-assessment buttons — Z correct, X wrong
    var assessDiv = el('div', {className: 'assess-buttons'});

    if (timedOut) {
      assessDiv.appendChild(el('button', {className: 'assess-btn missed', onClick: function() {
        recordResult(false, false, true);
      }}, [
        el('span', {className: 'assess-icon'}, 'X'),
        el('span', null, 'Wrong'),
        el('span', {className: 'assess-key'}, 'X')
      ]));
    } else {
      assessDiv.appendChild(el('button', {className: 'assess-btn nailed', onClick: function() {
        recordResult(true, false, false);
      }}, [
        el('span', {className: 'assess-icon'}, '\u2713'),
        el('span', null, 'Correct'),
        el('span', {className: 'assess-key'}, 'Z')
      ]));

      assessDiv.appendChild(el('button', {className: 'assess-btn missed', onClick: function() {
        recordResult(false, false, false);
      }}, [
        el('span', {className: 'assess-icon'}, '\u2717'),
        el('span', null, 'Wrong'),
        el('span', {className: 'assess-key'}, 'X')
      ]));
    }

    card.appendChild(assessDiv);
    frag.appendChild(card);

    // Keyboard shortcuts: Z = correct, X = wrong
    setTimeout(function() {
      document.onkeydown = function(e) {
        if (timedOut) {
          if (e.key === 'x' || e.key === 'X' || e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            recordResult(false, false, true);
          }
          return;
        }
        if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); recordResult(true, false, false); }
        else if (e.key === 'x' || e.key === 'X') { e.preventDefault(); recordResult(false, false, false); }
      };
    }, 50);

    frag.appendChild(buildCategoryPreview(ci));

    return frag;
  }

  function recordResult(correct, fast, timedOut) {
    var ci = state.currentCatIndex;
    var qi = state.currentClueIndex;
    var buzzTime = state.buzzTime || TIMER_SECONDS * 1000;

    // Fast = correct and buzzed within threshold
    var isFast = correct && buzzTime > 0 && buzzTime < FAST_THRESHOLD_MS;

    state.results.push({
      catIndex: ci,
      clueIndex: qi,
      correct: correct,
      fast: isFast,
      timedOut: timedOut,
      timeMs: buzzTime
    });

    // Advance
    advanceClue();
  }

  function buildCategoryPreview(currentCatIndex) {
    var preview = el('div', {style: {marginTop: '24px'}});
    for (var c = 0; c < state.categories.length; c++) {
      var catResults = state.results.filter(function(r) { return r.catIndex === c; });
      var catCorrect = catResults.filter(function(r) { return r.correct; }).length;
      var catTotal = state.categories[c].clues.length;

      var statusText = '';
      if (c < currentCatIndex) statusText = catCorrect + '/' + catTotal;
      else if (c === currentCatIndex) statusText = 'NOW';
      else statusText = '...';

      var opacity = c === currentCatIndex ? '1' : (c < currentCatIndex ? '0.5' : '0.3');
      var statusColor = c === currentCatIndex ? 'var(--gold)' : 'var(--text-muted)';

      preview.appendChild(el('div', {style: {display: 'flex', justifyContent: 'space-between', padding: '8px 16px', opacity: opacity, fontSize: '13px'}}, [
        el('span', {style: {color: 'var(--text-dim)'}}, state.categories[c].category),
        el('span', {style: {color: statusColor, fontWeight: '600'}}, statusText)
      ]));
    }
    return preview;
  }

  // ===== SUMMARY =====

  function buildSummary() {
    var totalClues = 0;
    state.categories.forEach(function(c) { totalClues += c.clues.length; });

    var correct = state.results.filter(function(r) { return r.correct; }).length;
    var nailed = state.results.filter(function(r) { return r.correct && r.fast; }).length;
    var gotIt = correct - nailed;
    var missed = totalClues - correct;
    var avgBuzz = 0;
    var buzzResults = state.results.filter(function(r) { return !r.timedOut && r.timeMs; });
    if (buzzResults.length > 0) {
      var totalBuzz = buzzResults.reduce(function(sum, r) { return sum + r.timeMs; }, 0);
      avgBuzz = Math.round(totalBuzz / buzzResults.length / 100) / 10;
    }

    var frag = document.createDocumentFragment();
    frag.appendChild(buildHeader());

    var summary = el('div', {className: 'summary'});
    summary.appendChild(el('h2', null, getPerformanceTitle(correct, totalClues)));
    summary.appendChild(el('div', {className: 'score-big'}, correct + '/' + totalClues));

    var breakdown = el('div', {className: 'breakdown'}, [
      el('div', {className: 'stat'}, [
        el('div', {className: 'num green'}, '' + correct),
        el('div', {className: 'label'}, 'Correct')
      ]),
      el('div', {className: 'stat'}, [
        el('div', {className: 'num green', style: {opacity: '0.6'}}, '' + nailed),
        el('div', {className: 'label'}, 'Fast')
      ]),
      el('div', {className: 'stat'}, [
        el('div', {className: 'num red'}, '' + missed),
        el('div', {className: 'label'}, 'Missed')
      ])
    ]);
    summary.appendChild(breakdown);

    if (avgBuzz > 0) {
      summary.appendChild(el('div', {style: {color: 'var(--text-dim)', fontSize: '13px', marginBottom: '16px'}},
        'Avg buzz: ' + avgBuzz + 's'));
    }

    // Share grid
    var shareGrid = el('div', {className: 'share-grid'});
    for (var c = 0; c < state.categories.length; c++) {
      var row = el('div', {className: 'row'});
      var catResults = state.results.filter(function(r) { return r.catIndex === c; });
      for (var q = 0; q < catResults.length; q++) {
        var r = catResults[q];
        var symbol = '';
        if (r.correct && r.fast) symbol = '\uD83D\uDFE9';
        else if (r.correct) symbol = '\uD83D\uDFE8';
        else symbol = '\u2B1B';
        row.appendChild(el('span', null, symbol));
      }
      row.appendChild(el('span', {className: 'cat-label'}, state.categories[c].category));
      shareGrid.appendChild(row);
    }
    summary.appendChild(shareGrid);

    // Share button
    var shareBtn = el('button', {className: 'share-btn', onClick: function() {
      var text = generateShareText();
      navigator.clipboard.writeText(text).then(function() {
        shareBtn.textContent = 'Copied!';
        shareBtn.className = 'share-btn copied';
        setTimeout(function() {
          shareBtn.textContent = 'Copy Results';
          shareBtn.className = 'share-btn';
        }, 2000);
      });
    }}, 'Copy Results');
    summary.appendChild(shareBtn);

    summary.appendChild(el('br'));

    summary.appendChild(el('button', {className: 'play-again-btn', onClick: function() {
      state.mode = 'practice';
      state.results = [];
      state.currentCatIndex = 0;
      state.currentClueIndex = 0;
      state.phase = 'loading';
      render();
      loadClues();
    }}, 'Practice Round'));

    frag.appendChild(summary);

    // Category breakdown
    var breakdownSection = el('div', {style: {marginTop: '24px'}});
    for (var c2 = 0; c2 < state.categories.length; c2++) {
      var cat = state.categories[c2];
      var catBlock = el('div', {className: 'category-block'});
      var cr = state.results.filter(function(r) { return r.catIndex === c2; });
      var catCorrect = cr.filter(function(r) { return r.correct; }).length;

      catBlock.appendChild(el('div', {className: 'category-header'}, [
        el('span', {className: 'cat-name'}, cat.category),
        el('span', {className: 'cat-score'}, catCorrect + '/' + cat.clues.length)
      ]));

      for (var q2 = 0; q2 < cat.clues.length; q2++) {
        var clue = cat.clues[q2];
        var result = cr[q2];
        var card = el('div', {className: 'clue-card revealed', style: {opacity: '0.8'}});
        card.appendChild(el('div', {className: 'clue-text', style: {fontSize: '14px', marginBottom: '8px'}}, clue.clue));

        var resultDiv;
        if (result && result.correct) {
          var rText = clue.correctResponse;
          if (result.timeMs) rText += ' (' + (result.timeMs / 1000).toFixed(1) + 's)';
          resultDiv = el('div', {className: 'result correct', style: {animation: 'none'}}, rText);
        } else if (result && result.timedOut) {
          resultDiv = el('div', {className: 'result timeout', style: {animation: 'none'}}, 'Time\'s up. ' + clue.correctResponse);
        } else if (result) {
          resultDiv = el('div', {className: 'result incorrect', style: {animation: 'none'}}, clue.correctResponse);
        }
        if (resultDiv) card.appendChild(resultDiv);
        catBlock.appendChild(card);
      }
      breakdownSection.appendChild(catBlock);
    }
    frag.appendChild(breakdownSection);

    return frag;
  }

  function getPerformanceTitle(correct, total) {
    var pct = correct / total;
    if (pct >= 0.93) return 'Champion Material';
    if (pct >= 0.8) return 'Strong Performance';
    if (pct >= 0.6) return 'Getting There';
    if (pct >= 0.4) return 'Building Knowledge';
    return 'Keep Training';
  }

  // ===== TIMER =====

  function startTimer() {
    state.timerStart = Date.now();
    clearTimer();

    var timerFill = document.getElementById('timer-fill');
    if (!timerFill) return;

    state.timerInterval = setInterval(function() {
      var elapsed = (Date.now() - state.timerStart) / 1000;
      var remaining = Math.max(0, TIMER_SECONDS - elapsed);
      var pct = (remaining / TIMER_SECONDS) * 100;
      timerFill.style.width = pct + '%';

      if (remaining > 3) timerFill.className = 'fill';
      else if (remaining > 1.5) timerFill.className = 'fill warning';
      else timerFill.className = 'fill danger';

      if (remaining <= 0) {
        clearTimer();
        state.buzzTime = 0;
        state.phase = 'revealed';
        render();
      }
    }, 50);
  }

  function clearTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    document.onkeydown = null;
  }

  // ===== NAVIGATION =====

  function switchMode(newMode) {
    if (newMode !== state.mode) {
      state.mode = newMode;
      clearTimer();
      state.results = [];
      state.currentCatIndex = 0;
      state.currentClueIndex = 0;
      state.phase = 'loading';
      render();
      loadClues();
    }
  }

  function advanceClue() {
    var ci = state.currentCatIndex;
    var qi = state.currentClueIndex;
    var cat = state.categories[ci];

    if (qi + 1 < cat.clues.length) {
      state.currentClueIndex = qi + 1;
    } else if (ci + 1 < state.categories.length) {
      state.currentCatIndex = ci + 1;
      state.currentClueIndex = 0;
    } else {
      state.phase = 'summary';
      if (state.mode === 'daily') {
        state.dailyCompleted = true;
        saveDailyCompleted();
      }
      render();
      return;
    }
    state.phase = 'reading';
    render();
  }

  // ===== SHARE =====

  function generateShareText() {
    var correct = state.results.filter(function(r) { return r.correct; }).length;
    var total = state.results.length;

    var text = 'JeopardyCoach ' + state.dailyDate + '\n';
    text += correct + '/' + total + '\n\n';

    for (var c = 0; c < state.categories.length; c++) {
      var catResults = state.results.filter(function(r) { return r.catIndex === c; });
      var row = '';
      for (var q = 0; q < catResults.length; q++) {
        var r = catResults[q];
        if (r.correct && r.fast) row += '\uD83D\uDFE9';
        else if (r.correct) row += '\uD83D\uDFE8';
        else row += '\u2B1B';
      }
      text += row + ' ' + state.categories[c].category + '\n';
    }

    return text;
  }

  // ===== DATA LOADING =====

  function loadClues() {
    var endpoint = state.mode === 'daily' ? '/api/daily' : '/api/session';

    fetch(endpoint)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        state.categories = data.categories;
        state.dailyDate = data.date || '';
        state.currentCatIndex = 0;
        state.currentClueIndex = 0;

        if (state.mode === 'daily' && checkDailyCompleted()) {
          state.phase = 'summary';
        } else {
          state.phase = 'reading';
        }
        render();
      });
  }

  // ===== INIT =====

  loadClues();
  render();

})();
