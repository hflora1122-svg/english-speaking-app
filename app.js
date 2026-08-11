// ---------- 상태 관리 ----------
let currentLevel = localStorage.getItem('currentLevel') || 'beginner';
let currentTab = 'vocab';
let recognition = null;
let isRecording = false;

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
function getDayIndex(){
  return Math.floor(Date.now()/86400000);
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

// ---------- 오늘의 단어 ----------
function getTodayVocab(){
  const list = vocabData[currentLevel];
  const perDay = 5;
  const totalGroups = Math.ceil(list.length/perDay);
  const groupIndex = getDayIndex() % totalGroups;
  const start = groupIndex*perDay;
  return list.slice(start, start+perDay);
}

function getLearnedKey(){
  return `learned_${currentLevel}_${getDayIndex()}`;
}

function renderVocab(){
  const todayWords = getTodayVocab();
  const learnedKey = getLearnedKey();
  const learned = JSON.parse(localStorage.getItem(learnedKey)||'[]');

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
      updateVocabProgress();
    });
  });

  updateVocabProgress();
}

function updateVocabProgress(){
  const todayWords = getTodayVocab();
  const learned = JSON.parse(localStorage.getItem(getLearnedKey())||'[]');
  document.getElementById('vocab-progress').textContent =
    `오늘의 단어 ${learned.length} / ${todayWords.length} 학습 완료`;
}

// ---------- 오늘의 말하기 문장 ----------
function getTodaySentence(){
  const list = speakingData[currentLevel];
  const index = getDayIndex() % list.length;
  return list[index];
}

function renderSpeaking(){
  const item = getTodaySentence();
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
