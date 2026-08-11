// ---------- 상태 관리 ----------
let currentLevel = localStorage.getItem('currentLevel') || 'beginner';
let currentTab = 'vocab';
let recognition = null;
let isRecording = false;

const VOCAB_PER_ROUND = 5;

// ---------- 초기화 ----------
document.addEventListener('DOMContentLoaded', () => {
  updateStreak();
  setActiveLevelButton();
  setActiveTabButton();
  renderVocab();
  renderSpeaking();
  bindEvents();
});

function bindEvents(){
  document.querySelectorAll('.level-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      currentLevel = btn.dataset.level;
      localStorage.setItem('currentLevel', currentLevel);
      setActiveLevelButton();
      renderVocab();
      renderSpeaking();
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      currentTab = btn.dataset.tab;
      setActiveTabButton();
      document.getElementById('vocab-section').style.display = currentTab==='vocab' ? 'block':'none';
      document.getElementById('speaking-section').style.display = currentTab==='speaking' ? 'block':'none';
    });
  });

  document.getElementById('vocab-prev').addEventListener('click', ()=> changeRound('vocab', -1));
  document.getElementById('vocab-next').addEventListener('click', ()=> changeRound('vocab', 1));
  document.getElementById('speak-prev').addEventListener('click', ()=> changeRound('speak', -1));
  document.getElementById('speak-next').addEventListener('click', ()=> changeRound('speak', 1));
}

function setActiveLevelButton(){
  document.querySelectorAll('.level-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.level === currentLevel);
  });
}
function setActiveTabButton(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
}

// ---------- 날짜 / 연속 학습일 ----------
function getTodayString(){
  return new Date().toISOString().slice(0,10);
}

function updateStreak(){
  const today = getTodayString();
  const last = localStorage.getItem('lastVisit');
  let streak = parseInt(localStorage.getItem('streak')||'0',10);

  if(last === today){
    // 오늘 이미 방문함
  } else {
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
    if(last === yesterday){
      streak += 1;
    } else {
      streak = 1;
    }
    localStorage.setItem('lastVisit', today);
    localStorage.setItem('streak', streak.toString());
  }
  document.getElementById('streak-info').textContent = `🔥 연속 학습 ${streak}일째`;
}

// ---------- 회차(라운드) 관리 ----------
// kind: 'vocab' 또는 'speak'
function getTotalGroups(kind, level){
  if(kind === 'vocab'){
    return Math.ceil(vocabData[level].length / VOCAB_PER_ROUND);
  } else {
    return speakingData[level].length;
  }
}

function getRoundKey(kind, level){ return `${kind}Round_${level}`; }
function getDateKey(kind, level){ return `${kind}LastDate_${level}`; }

// 하루가 지나면 자동으로 다음 회차로 넘어가고, 그 회차 번호를 반환한다.
function ensureDailyAdvance(kind, level){
  const total = getTotalGroups(kind, level);
  const dateKey = getDateKey(kind, level);
  const roundKey = getRoundKey(kind, level);
  const today = getTodayString();
  const lastDate = localStorage.getItem(dateKey);
  let round = parseInt(localStorage.getItem(roundKey) || '0', 10);
  if(isNaN(round) || round < 0) round = 0;
  round = round % total;

  if(lastDate === null){
    // 이 레벨을 처음 이용하는 경우: 0회차부터 시작
    localStorage.setItem(dateKey, today);
    localStorage.setItem(roundKey, round.toString());
  } else if(lastDate !== today){
    // 날짜가 바뀌었으면 다음 회차로 자동 이동
    round = (round + 1) % total;
    localStorage.setItem(dateKey, today);
    localStorage.setItem(roundKey, round.toString());
  }
  return round;
}

// 이전/다음 회차 버튼을 눌렀을 때 호출
function changeRound(kind, direction){
  const level = currentLevel;
  const total = getTotalGroups(kind, level);
  let round = parseInt(localStorage.getItem(getRoundKey(kind, level)) || '0', 10);
  round = ((round + direction) % total + total) % total;
  localStorage.setItem(getRoundKey(kind, level), round.toString());

  if(kind === 'vocab') renderVocab();
  else renderSpeaking();
}

// ---------- 오늘의 단어 ----------
function getVocabForRound(level, round){
  const list = vocabData[level];
  const start = round * VOCAB_PER_ROUND;
  return list.slice(start, start + VOCAB_PER_ROUND);
}

function renderVocab(){
  const level = currentLevel;
  const round = ensureDailyAdvance('vocab', level);
  const total = getTotalGroups('vocab', level);
  const todayWords = getVocabForRound(level, round);
  const learnedKey = `learned_vocab_${level}_${round}`;
  const learned = JSON.parse(localStorage.getItem(learnedKey) || '[]');

  document.getElementById('vocab-round-label').textContent = `${round + 1} / ${total} 회차`;

  const container = document.getElementById('vocab-list');
  container.innerHTML = '';

  todayWords.forEach(item=>{
    const isLearned = learned.includes(item.word);
    const card = document.createElement('div');
    card.className = 'vocab-card' + (isLearned ? ' learned':'');
    card.innerHTML = `
      <div class="vocab-word">
        ${item.word}
        <button class="icon-btn" title="발음 듣기">🔊</button>
      </div>
      <div class="vocab-meaning">뜻: ${item.meaning}</div>
      <div class="vocab-example">${item.example}</div>
      <div class="card-actions">
        <button class="small-btn toggle-meaning">뜻 보기</button>
        <button class="small-btn toggle-learned ${isLearned?'done':''}">${isLearned?'학습완료 ✔':'학습완료로 표시'}</button>
      </div>
    `;
    container.appendChild(card);

    card.querySelector('.icon-btn').addEventListener('click', ()=> speak(item.word));
    card.querySelector('.toggle-meaning').addEventListener('click', (e)=>{
      const meaningEl = card.querySelector('.vocab-meaning');
      meaningEl.classList.toggle('show');
      e.target.textContent = meaningEl.classList.contains('show') ? '뜻 숨기기' : '뜻 보기';
    });
    card.querySelector('.toggle-learned').addEventListener('click', (e)=>{
      let arr = JSON.parse(localStorage.getItem(learnedKey)||'[]');
      if(arr.includes(item.word)){
        arr = arr.filter(w=>w!==item.word);
        card.classList.remove('learned');
        e.target.classList.remove('done');
        e.target.textContent = '학습완료로 표시';
      } else {
        arr.push(item.word);
        card.classList.add('learned');
        e.target.classList.add('done');
        e.target.textContent = '학습완료 ✔';
      }
      localStorage.setItem(learnedKey, JSON.stringify(arr));
      updateVocabProgress(level, round, todayWords);
    });
  });

  updateVocabProgress(level, round, todayWords);
}

function updateVocabProgress(level, round, todayWords){
  const learnedKey = `learned_vocab_${level}_${round}`;
  const learned = JSON.parse(localStorage.getItem(learnedKey)||'[]');
  document.getElementById('vocab-progress').textContent =
    `이번 회차 단어 ${learned.length} / ${todayWords.length} 학습 완료`;
}

// ---------- 오늘의 말하기 문장 ----------
function getSpeakingForRound(level, round){
  return speakingData[level][round];
}

function renderSpeaking(){
  const level = currentLevel;
  const round = ensureDailyAdvance('speak', level);
  const total = getTotalGroups('speak', level);
  const item = getSpeakingForRound(level, round);

  document.getElementById('speak-round-label').textContent = `${round + 1} / ${total} 회차`;

  const container = document.getElementById('speaking-card');
  container.innerHTML = `
    <div class="speaking-sentence">${item.sentence}</div>
    <div class="speaking-meaning">${item.meaning}</div>
    <div class="speaking-buttons">
      <button class="big-btn listen-btn" id="listen-btn">🔊 듣기</button>
      <button class="big-btn record-btn" id="record-btn">🎤 말하기 연습</button>
    </div>
    <div class="result-box" id="result-box"></div>
  `;

  document.getElementById('listen-btn').addEventListener('click', ()=> speak(item.sentence));
  document.getElementById('record-btn').addEventListener('click', ()=> startRecording(item.sentence));
}

// ---------- 텍스트를 음성으로 (듣기 기능) ----------
function speak(text){
  if(!('speechSynthesis' in window)){
    alert('이 브라우저는 음성 재생을 지원하지 않아요. 크롬 브라우저를 사용해보세요.');
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

// ---------- 음성 인식 (말하기 연습 채점) ----------
function startRecording(targetSentence){
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const resultBox = document.getElementById('result-box');
  const recordBtn = document.getElementById('record-btn');

  if(!SpeechRecognitionClass){
    resultBox.innerHTML = `<p>😢 이 브라우저는 음성 인식을 지원하지 않아요.<br>PC/안드로이드는 <b>크롬(Chrome)</b> 브라우저를 이용해주세요.</p>`;
    return;
  }

  if(isRecording){
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognitionClass();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = ()=>{
    isRecording = true;
    recordBtn.classList.add('recording');
    recordBtn.textContent = '🎤 듣고 있어요... (다시 누르면 중지)';
    resultBox.innerHTML = '<p>말씀해주세요 🎧</p>';
  };

  recognition.onresult = (event)=>{
    const transcript = event.results[0][0].transcript;
    showResult(transcript, targetSentence);
  };

  recognition.onerror = (event)=>{
    resultBox.innerHTML = `<p>⚠️ 인식 중 오류가 발생했어요 (${event.error}). 마이크 권한을 확인해주세요.</p>`;
  };

  recognition.onend = ()=>{
    isRecording = false;
    recordBtn.classList.remove('recording');
    recordBtn.textContent = '🎤 말하기 연습';
  };

  recognition.start();
}

function showResult(transcript, target){
  const resultBox = document.getElementById('result-box');
  const accuracy = calcAccuracy(transcript, target);

  let scoreClass = 'score-low';
  let comment = '다시 한 번 연습해볼까요? 💪';
  if(accuracy >= 85){ scoreClass='score-good'; comment='아주 훌륭해요! 완벽해요 🎉'; }
  else if(accuracy >= 60){ scoreClass='score-mid'; comment='잘하고 있어요! 조금만 더 연습해봐요 🙂'; }

  resultBox.innerHTML = `
    <div class="result-transcript">인식된 문장: "${transcript}"</div>
    <div class="result-score ${scoreClass}">정확도 ${accuracy}%</div>
    <div>${comment}</div>
  `;
}

function normalize(str){
  return str.toLowerCase().replace(/[.,!?'"]/g,'').trim().split(/\s+/).filter(Boolean);
}

function calcAccuracy(spoken, target){
  const spokenWords = normalize(spoken);
  const targetWords = normalize(target);
  if(targetWords.length === 0) return 0;

  const spokenPool = [...spokenWords];
  let matched = 0;
  targetWords.forEach(word=>{
    const idx = spokenPool.indexOf(word);
    if(idx !== -1){
      matched++;
      spokenPool.splice(idx,1);
    }
  });
  return Math.round((matched/targetWords.length)*100);
}
