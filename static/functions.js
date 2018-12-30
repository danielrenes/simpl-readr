'use strict';

const electron = require('electron');
const { ipcRenderer } = electron;
const { dialog } = electron.remote

const shortcuts = {
    'open': 'CTRL+O',
    'next': 'ARROW_RIGHT',
    'prev': 'ARROW_LEFT',
    'zoomIn': 'CTRL+ARROW_UP',
    'zoomOut': 'CTRL+ARROW_DOWN'
};

const keyCodes = {
    'CTRL': 17,
    'O': 79,
    'ARROW_UP': 38,
    'ARROW_DOWN': 40,
    'ARROW_LEFT': 37,
    'ARROW_RIGHT': 39
};

$(document).ready(() => {
    let ebookStyleTarget = $('#ebook-style-target');
    let open = $('#open-book');
    let next = $('#next-part');
    let prev = $('#prev-part');
    let zoomIn = $('#zoom-in');
    let zoomOut = $('#zoom-out');
    let ebookContentTarget = $('#ebook-content-target');

    const handlers = {
        'OPEN': () => {
            loadBook().then(result => {
                if (typeof result === 'undefined') {
                    return;
                }
                ebookStyleTarget.empty();
                ebookStyleTarget.append(result.styles);
                refreshContent(result.firstPart);
            });
        },
        'PREV': () => getPrevPart().then(result=> refreshContent(result)),
        'NEXT': () => getNextPart().then(result=> refreshContent(result)),
        'ZOOM_IN': () => ebookContentTarget.css('zoom', parseFloat(ebookContentTarget.css('zoom')) + 0.1),
        'ZOOM_OUT': () => ebookContentTarget.css('zoom', parseFloat(ebookContentTarget.css('zoom')) - 0.1)
    };

    $(document).keydown(e => {
        let isCtrl = e.ctrlKey;
        let keyCode = e.keyCode;
        let length;
        let command;

        if (isCtrl) {
            length = e.keyCode === keyCodes.CTRL ? 1 : 2;
        } else {
            length = 1;
        }

        for (let k in shortcuts) {
            let keys = shortcuts[k].split('+');
            let match = (length === keys.length);

            if (match) {
                for (let i in keys) {
                    let key = keys[i];
                    if (key === 'CTRL') {
                        if (!isCtrl) {
                            match = false;
                            break;
                        }
                    } else {
                        if (keyCode !== keyCodes[key]) {
                            match = false;
                            break;
                        }
                    }
                }
            }

            if (match) {
                command = k;
                break;
            }
        }

        switch (command) {
            case 'open':
                handlers.OPEN();
                break;
            case 'prev':
                handlers.PREV();
                break;
            case 'next':
                handlers.NEXT();
                break;
            case 'zoomIn':
                handlers.ZOOM_IN();
                break;
            case 'zoomOut':
                handlers.ZOOM_OUT();
                break;
        }
    });

    open.click(e => handlers.OPEN());

    next.click(e => handlers.NEXT());

    prev.click(e => handlers.PREV());

    zoomIn.click(e => handlers.ZOOM_IN());

    zoomOut.click(e => handlers.ZOOM_OUT());

    function refreshContent(html) {
        ebookContentTarget.empty();
        ebookContentTarget.append(html);
    }

    $(document).on('click', 'img', e => {
        if (e.ctrlKey) {
            ipcRenderer.send('openImageInNewWindow', e.target.src);
        }
    });
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