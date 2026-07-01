let isDrawing = false;
let startX, startY, endX, endY;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let bgImage = new Image();

// 메인 프로세스로부터 전체화면 이미지 경로 전달받기
window.electronAPI.onCaptureImage((imagePath) => {
  // 로컬 파일 경로를 file:// 스키마와 함께 로드
  bgImage.src = 'file:///' + imagePath.replace(/\\/g, '/');
  bgImage.onload = () => {
    // 캔버스 크기를 물리적 해상도에 맞게 조정 (Windows DPI 배율 대응)
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(ratio, ratio);
    
    drawCanvas();
  };
});

function drawCanvas() {
  const wWidth = window.innerWidth;
  const wHeight = window.innerHeight;
  
  ctx.clearRect(0, 0, wWidth, wHeight);
  
  // 1. 원본 전체 화면 그리기
  ctx.drawImage(bgImage, 0, 0, wWidth, wHeight);
  
  // 2. 전체 화면에 어두운 반투명 오버레이 덮기
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, wWidth, wHeight);

  if (isDrawing) {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(startX - endX);
    const h = Math.abs(startY - endY);

    if (w > 0 && h > 0) {
      // 3. 드래그한 선택 영역만 밝게 (어두운 레이어 구멍 뚫기)
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(bgImage, 0, 0, wWidth, wHeight);
      ctx.restore();

      // 4. 세련된 네온 블루 보더 라인 추가
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      
      // 코너 모서리 표시로 세련미 추가 (Premium Design)
      ctx.fillStyle = '#00d2ff';
      const cornerSize = 4;
      ctx.fillRect(x - 1, y - 1, cornerSize, cornerSize);
      ctx.fillRect(x + w - cornerSize + 1, y - 1, cornerSize, cornerSize);
      ctx.fillRect(x - 1, y + h - cornerSize + 1, cornerSize, cornerSize);
      ctx.fillRect(x + w - cornerSize + 1, y + h - cornerSize + 1, cornerSize, cornerSize);
    }
  }
}

canvas.addEventListener('mousedown', (e) => {
  // 마우스 왼쪽 버튼 클릭 시
  if (e.button === 0) {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    endX = e.clientX;
    endY = e.clientY;
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  endX = e.clientX;
  endY = e.clientY;
  drawCanvas();
});

canvas.addEventListener('mouseup', (e) => {
  if (!isDrawing) return;
  isDrawing = false;

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(startX - endX);
  const h = Math.abs(startY - endY);

  // 너무 작은 영역 드래그는 노이즈 클릭으로 감지하여 취소 처리
  if (w > 10 && h > 10) {
    const ratio = window.devicePixelRatio || 1;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w * ratio;
    cropCanvas.height = h * ratio;
    const cropCtx = cropCanvas.getContext('2d');

    // 고품질 드로잉 보장
    cropCtx.imageSmoothingEnabled = true;
    cropCtx.imageSmoothingQuality = 'high';

    // 원본 이미지에서 캡처한 배율(DPI)에 맞게 크롭하여 그리기
    const originalWidth = bgImage.naturalWidth;
    const originalHeight = bgImage.naturalHeight;
    
    // 윈도우 스케일과 내츄럴 이미지 크기 간 비율 계산
    const scaleX = originalWidth / window.innerWidth;
    const scaleY = originalHeight / window.innerHeight;

    cropCtx.drawImage(
      bgImage,
      x * scaleX, y * scaleY, w * scaleX, h * scaleY, // 원본 크기 좌표
      0, 0, w * ratio, h * ratio                    // 타겟 크기 좌표
    );

    const croppedDataUrl = cropCanvas.toDataURL('image/png');
    window.electronAPI.sendCaptureDone(croppedDataUrl);
  } else {
    window.electronAPI.sendCaptureCancel();
  }
});

// ESC 키가 눌렸을 때 취소 처리
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.electronAPI.sendCaptureCancel();
  }
});
