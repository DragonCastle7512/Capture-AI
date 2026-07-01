const { app, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

// 파일 없이도 실행될 수 있도록 1x1 투명 PNG 이미지의 Base64 데이터를 사용하여 기본 트레이 아이콘 생성
const transparentIconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function createTray() {
  const icon = nativeImage.createFromDataURL(transparentIconBase64);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '캡처 실행 (Win+Shift+A)', click: () => { console.log('Tray menu capture triggered'); } },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('Capture AI Assistant');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createTray();
  
  // Win+Shift+A 단축키 등록
  const ret = globalShortcut.register('Super+Shift+A', () => {
    console.log('Win+Shift+A 단축키가 감지되었습니다!');
  });
  
  if (!ret) {
    console.error('단축키 등록에 실패했습니다.');
  } else {
    console.log('단축키 Win+Shift+A가 정상 등록되었습니다.');
  }
  
  console.log('Capture AI Assistant가 준비되었습니다.');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
