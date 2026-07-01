const { app, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const fs = require('fs');

let tray = null;
const transparentIconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function createTray() {
  const icon = nativeImage.createFromDataURL(transparentIconBase64);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '캡처 실행 (Win+Shift+A)', click: () => { handleCapture(); } },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('Capture AI Assistant');
  tray.setContextMenu(contextMenu);
}

async function handleCapture() {
  console.log('화면 캡처를 시작합니다...');
  const tempPath = path.join(app.getPath('userData'), 'temp_screen.png');
  try {
    // screenshot-desktop으로 전체 화면 캡처
    await screenshot({ format: 'png', filename: tempPath });
    console.log('화면 캡처 완료:', tempPath);
    return tempPath;
  } catch (err) {
    console.error('화면 캡처 실패:', err);
    return null;
  }
}

app.whenReady().then(() => {
  createTray();
  
  const ret = globalShortcut.register('Super+Shift+A', () => {
    handleCapture();
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
