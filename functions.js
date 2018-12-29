'use strict';

const electron = require('electron');
const { ipcRenderer } = electron;
const { dialog } = electron.remote

$(document).ready(() => {
    let ebookStyleTarget = $('#ebook-style-target');
    let open = $('#open-book');
    let next = $('#next-part');
    let prev = $('#prev-part');
    let zoomIn = $('#zoom-in');
    let zoomOut = $('#zoom-out');
    let ebookContentTarget = $('#ebook-content-target');

    open.click(e => loadBook().then(result => {
        if (typeof result === 'undefined') {
            return;
        }
        ebookStyleTarget.empty();
        ebookStyleTarget.append(result.styles);
        refreshContent(result.firstPart);
    }));

    next.click(e => getNextPart().then(result=> refreshContent(result)));

    prev.click(e => getPrevPart().then(result => refreshContent(result)));

    zoomIn.click(e => ebookContentTarget.css('zoom', parseFloat(ebookContentTarget.css('zoom')) + 0.1));

    zoomOut.click(e => ebookContentTarget.css('zoom', parseFloat(ebookContentTarget.css('zoom')) - 0.1));

    function refreshContent(html) {
        ebookContentTarget.empty();
        ebookContentTarget.append(html);
    }
});

function loadBook() {
    let filepaths = dialog.showOpenDialog({filters: [{name: 'EPUB', extensions: ['epub']}]});
    if (typeof filepaths === 'undefined') {
        return Promise.resolve();
    }
    return new Promise(resolve => {
        ipcRenderer.send('loadBook', filepaths[0]);
        ipcRenderer.on('loadBookResult', (event, arg) => {
            resolve(arg);
        });
    });
}

function getNextPart() {
    return new Promise(resolve => {
        ipcRenderer.send('getNextPart');
        ipcRenderer.on('getNextPartResult', (event, arg) => {
            resolve(arg);
        });
    });
}

function getPrevPart() {
    return new Promise(resolve => {
        ipcRenderer.send('getPrevPart');
        ipcRenderer.on('getPrevPartResult', (event, arg) => {
            resolve(arg);
        });
    });
}