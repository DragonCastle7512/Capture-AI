const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Capture Window IPC
  onCaptureImage: (callback) => ipcRenderer.on('capture-image', (event, value) => callback(value)),
  sendCaptureDone: (dataUrl) => ipcRenderer.send('capture-done', dataUrl),
  sendCaptureCancel: () => ipcRenderer.send('capture-cancel'),

  // Query Window IPC
  onQueryImage: (callback) => ipcRenderer.on('query-image', (event, value) => callback(value)),
  closeQueryWindow: () => ipcRenderer.send('close-query-window'),
  askAI: (prompt, base64Image) => ipcRenderer.invoke('ask-ai', { prompt, base64Image }),
  
  // Startup setting IPC
  getStartupSetting: () => ipcRenderer.invoke('get-startup-setting'),
  setStartupSetting: (openAtLogin) => ipcRenderer.invoke('set-startup-setting', openAtLogin)
});
