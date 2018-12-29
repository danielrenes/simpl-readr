'use strict';

const url = require('url');
const path = require('path');

const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;

const EPUB = require('./epub.js').EPUB;

let mainWindow;
let epub;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        minWidth: 1200,
        minHeight: 600,
        center: true
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.on('closed', () => {
        app.quit();
    });
});

ipcMain.on('loadBook', (event, arg) => {
    epub = new EPUB(arg);
    epub.parse();
    let firstPart = epub.nextPart();
    let styles = epub.mergeStylesheets();
    event.sender.send('loadBookResult', {firstPart: firstPart, styles: styles});
});

ipcMain.on('getNextPart', (event, arg) => event.sender.send('getNextPartResult', epub.nextPart()));

ipcMain.on('getPrevPart', (event, arg) => event.sender.send('getPrevPartResult', epub.prevPart()));