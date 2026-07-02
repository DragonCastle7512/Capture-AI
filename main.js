const { app, globalShortcut, Tray, Menu, nativeImage, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

let tray = null;
let captureWin = null;
let queryWin = null;
const settingsFilePath = path.join(app.getPath('userData'), 'window-settings.json');

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

  let width = 760;
  let height = 580;
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8');
      const settings = JSON.parse(data);
      if (settings.width && settings.height) {
        width = settings.width;
        height = settings.height;
      }
    }
  } catch (err) {
    console.error('창 크기 설정 불러오기 오류:', err);
  }

  queryWin = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  queryWin.on('close', () => {
    try {
      const bounds = queryWin.getBounds();
      const settings = {
        width: bounds.width,
        height: bounds.height
      };
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings), 'utf-8');
      console.log('창 크기 저장 성공:', settings);
    } catch (err) {
      console.error('창 크기 저장 중 오류 발생:', err);
    }
  });

  queryWin.on('closed', () => {
    queryWin = null;
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
    queryWin.close();
  }
});

ipcMain.on('minimize-query-window', () => {
  if (queryWin) {
    queryWin.minimize();
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

function getStartupFilePath() {
  return path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'capture-ai-startup.vbs');
}

ipcMain.handle('get-startup-setting', () => {
  return fs.existsSync(getStartupFilePath());
});

ipcMain.handle('set-startup-setting', (event, openAtLogin) => {
  const filePath = getStartupFilePath();
  try {
    if (openAtLogin) {
      const { execSync } = require('child_process');
      const homePath = app.getPath('home');
      let projectDir = __dirname;
      
      // 사용자 홈 디렉토리 한글 이름 깨짐 문제를 방지하기 위해 %USERPROFILE% 환경변수로 치환
      if (projectDir.toLowerCase().startsWith(homePath.toLowerCase())) {
        projectDir = '%USERPROFILE%' + projectDir.substring(homePath.length);
      }
      
      let npmPath = 'npm';
      try {
        const npmPathOutput = execSync('where npm').toString().trim().split(/[\r\n]+/)[0];
        if (npmPathOutput && fs.existsSync(npmPathOutput)) {
          npmPath = npmPathOutput;
          // npm 경로 또한 사용자 홈 디렉토리 내에 깔려있을 경우를 대비해 변수 치환 적용
          if (npmPath.toLowerCase().startsWith(homePath.toLowerCase())) {
            npmPath = '%USERPROFILE%' + npmPath.substring(homePath.length);
          }
        }
      } catch (e) {
        console.error('npm 절대경로 획득 실패:', e);
      }

      // 백슬래시 인코딩 호환성을 고려한 경로 조합
      const logFilePath = projectDir + '\\startup_log.txt';
      const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run "cmd.exe /c cd /d ""${projectDir}"" && ""${npmPath}"" start > ""${logFilePath}"" 2>&1", 0, False\n`;
      
      fs.writeFileSync(filePath, vbsContent, 'utf-8');
      console.log('시작 프로그램 등록 완료:', filePath);
    } else {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('시작 프로그램 해제 완료');
      }
    }
    return true;
  } catch (err) {
    console.error('시작 프로그램 설정 오류:', err);
    throw err;
  }
});

app.whenReady().then(() => {
  createTray();
  
  // 기존에 레지스트리에 잘못 등록되었을 수 있는 중복 항목 강제 제거 (충돌 방지)
  try {
    app.setLoginItemSettings({
      openAtLogin: false
    });
  } catch (err) {
    console.error('레지스트리 시작프로그램 정리 오류:', err);
  }
  
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
