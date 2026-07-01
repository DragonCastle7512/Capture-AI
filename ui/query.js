const promptInput = document.getElementById('prompt-input');
const previewImg = document.getElementById('preview-img');
const responseBox = document.getElementById('response-box');
const sendBtn = document.getElementById('send-btn');
const closeBtn = document.getElementById('close-btn');
const startupCheckbox = document.getElementById('startup-checkbox');

let capturedImageBase64 = null;

// 이미지 데이터 바인딩 및 포커스 설정
window.electronAPI.onQueryImage((base64Data) => {
  capturedImageBase64 = base64Data;
  previewImg.src = base64Data;
  
  // 창 활성화 시 약간의 딜레이를 주어 확실하게 포커스가 맞춰지도록 함
  setTimeout(() => {
    promptInput.focus();
  }, 150);
});

// 시작 프로그램 초기 설정 로드
async function initStartupSetting() {
  try {
    const openAtLogin = await window.electronAPI.getStartupSetting();
    startupCheckbox.checked = openAtLogin;
  } catch (err) {
    console.error('시작 프로그램 정보 로드 실패:', err);
  }
}

// 시작 프로그램 설정 변경 핸들러
startupCheckbox.addEventListener('change', async () => {
  try {
    await window.electronAPI.setStartupSetting(startupCheckbox.checked);
  } catch (err) {
    console.error('시작 프로그램 등록 오류:', err);
    startupCheckbox.checked = !startupCheckbox.checked; // 롤백
  }
});

// 간단한 마크다운 파서 (코딩 결과 가시성을 극대화하기 위함)
function parseMarkdown(text) {
  if (!text) return '';
  
  // HTML 엔티티 이스케이프 (보안 및 렌더링 안정성)
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // 1. 코드 블록 변환: ```javascript ... ```
  escaped = escaped.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>');
  
  // 2. 인라인 코드 변환: `code`
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 3. 굵은 글씨 변환: **text**
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 4. 줄바꿈을 패러그래프로 변환 (pre태그 내부 줄바꿈은 제외)
  const blocks = escaped.split('\n\n');
  const formattedBlocks = blocks.map(block => {
    if (block.trim().startsWith('<pre>') || block.trim().endsWith('</pre>')) {
      return block;
    }
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  });
  
  return formattedBlocks.join('');
}

// 전송 핸들러
async function handleSend() {
  const prompt = promptInput.value.trim();
  if (!prompt || !capturedImageBase64) return;
  
  // UI 상태를 로딩으로 전환
  promptInput.disabled = true;
  sendBtn.disabled = true;
  responseBox.innerHTML = `
    <div class="loader-container">
      <div class="spinner"></div>
      <div class="loading-text">Gemini AI가 이미지를 분석하는 중입니다...</div>
    </div>
  `;
  responseBox.classList.remove('placeholder-text');
  
  try {
    const responseText = await window.electronAPI.askAI(prompt, capturedImageBase64);
    responseBox.innerHTML = parseMarkdown(responseText);
  } catch (err) {
    responseBox.innerHTML = `<span style="color: #ef4444; font-weight: 600;">오류가 발생했습니다:</span><br>${err.message}`;
  } finally {
    promptInput.disabled = false;
    sendBtn.disabled = false;
    promptInput.value = '';
    promptInput.focus();
  }
}

// 이벤트 리스너 등록
promptInput.addEventListener('keydown', (e) => {
  // Enter키 입력 시 전송 (Shift+Enter는 기본 동작인 개행 실행)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);
closeBtn.addEventListener('click', () => {
  window.electronAPI.closeQueryWindow();
});

// ESC 키로 질문 창 닫기
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.electronAPI.closeQueryWindow();
  }
});

// 초기 설정 로드 실행
initStartupSetting();
