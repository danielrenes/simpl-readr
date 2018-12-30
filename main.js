'use strict';

const url = require('url');
const path = require('path');

const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;
const ejs = require('ejs');

const EPUB = require('./epub.js').EPUB;

let mainWindow;
let imageWindows = [];
let epub;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        minWidth: 1200,
        minHeight: 600,
        center: true
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'views', 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.on('close', () => {
        for (let i in imageWindows) {
            imageWindows[i].close();
        }
    });

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

ipcMain.on('openImageInNewWindow', (event, arg) => {
    let imageWindow = new BrowserWindow({
        minWidth: 200,
        minHeight: 200,
        center: true
    });

    ejs.renderFile(path.join(__dirname, 'views', 'image.ejs'), {src: arg}, (err, str) => {
        if (!err) {
            imageWindow.loadURL('data:text/html;charset=utf-8,' + encodeURI(str));
        }
    });

    imageWindow.on('close', () => imageWindows.splice(imageWindows.indexOf(imageWindow), 1));

    imageWindows.push(imageWindow);
});