const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Check if we are in development mode
const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac-like title bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
      devTools: isDev
    },
    // icon: path.join(__dirname, 'public/icon.png') // Add icon path here
  });

  // Load the app
  if (isDev) {
    // In dev mode, wait for Vite server
    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built file
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
  
  // Open external links in browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});