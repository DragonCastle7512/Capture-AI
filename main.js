const { app, globalShortcut, Tray, Menu, nativeImage, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

let tray = null;
let captureWin = null;
let queryWin = null;

const transparentIconBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function createTray() {
  const icon = nativeImage.createFromDataURL(transparentIconBase64);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '캡처 실행 (Win+Shift+A)', click: () => { triggerCaptureFlow(); } },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('Capture AI Assistant');
  tray.setContextMenu(contextMenu);
}

async function triggerCaptureFlow() {
  console.log('화면 캡처 시작...');
  const tempPath = path.join(app.getPath('userData'), 'temp_screen.png');
  try {
    await screenshot({ format: 'png', filename: tempPath });
    console.log('화면 캡처 성공:', tempPath);
    showCaptureWindow(tempPath);
  } catch (err) {
    console.error('화면 캡처 실패:', err);
  }
}

function showCaptureWindow(imagePath) {
  if (captureWin) {
    captureWin.destroy();
    captureWin = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  captureWin = new BrowserWindow({
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    width: width,
    height: height,
    fullscreen: true,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  captureWin.setIgnoreMouseEvents(false);
  captureWin.loadFile(path.join(__dirname, 'ui', 'capture.html'));
  
  captureWin.webContents.once('did-finish-load', () => {
    captureWin.webContents.send('capture-image', imagePath);
  });
}

function showQueryWindow(base64Image) {
  if (queryWin) {
    queryWin.destroy();
    queryWin = null;
  }

  queryWin = new BrowserWindow({
    width: 760,
    height: 580,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  queryWin.loadFile(path.join(__dirname, 'ui', 'query.html'));

  queryWin.webContents.once('did-finish-load', () => {
    queryWin.webContents.send('query-image', base64Image);
  });
}

// IPC 통신 설정
ipcMain.on('capture-done', (event, base64Data) => {
  if (captureWin) {
    captureWin.destroy();
    captureWin = null;
  }
  showQueryWindow(base64Data);
});

ipcMain.on('capture-cancel', () => {
  if (captureWin) {
    captureWin.destroy();
    captureWin = null;
  }
});

ipcMain.on('close-query-window', () => {
  if (queryWin) {
    queryWin.destroy();
    queryWin = null;
  }
});

ipcMain.handle('ask-ai', async (event, { prompt, base64Image }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('시스템 환경변수 GEMINI_API_KEY가 설정되어 있지 않습니다.\nWindows 제어판 또는 시스템 속성에서 GEMINI_API_KEY 환경변수를 설정하고 앱을 재실행해 주세요.');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const base64DataOnly = base64Image.split(',')[1];

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [
      prompt,
      {
        inlineData: {
          data: base64DataOnly,
          mimeType: 'image/png'
        }
      }
    ]
  });

  return response.text;
});

ipcMain.handle('get-startup-setting', () => {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
});

ipcMain.handle('set-startup-setting', (event, openAtLogin) => {
  app.setLoginItemSettings({
    openAtLogin: openAtLogin,
    openAsHidden: true
  });
  return true;
});

app.whenReady().then(() => {
  createTray();
  
  const ret = globalShortcut.register('Super+Shift+A', () => {
    triggerCaptureFlow();
  });
  
  if (!ret) {
    console.error('단축키 등록에 실패했습니다.');
  } else {
    console.log('단축키 Win+Shift+A가 정상 등록되었습니다.');
  }
  
  console.log('Capture AI Assistant가 준비되었습니다.');
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    triggerCaptureFlow();
  });
}

app.on('window-all-closed', () => {
  // 트레이 상주
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
