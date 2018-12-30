const path = require('path');

const AdmZip = require('adm-zip');
const parseString = require('xml2js').parseString;
const JSDOM = require('jsdom').JSDOM;

function EPUB(filepath) {
    this.filepath = filepath;
    this.mimetype = undefined;
    this.rootfile = undefined;
    this.metadata = {};
    this.parts = [];
    this.stylesheets = [];
    this.images = [];
    this.currentPart = -1;

    let partsOrder = [];

    this.parse = () => {
        let zip = new AdmZip(this.filepath);
        let zipEntries = zip.getEntries();

        zipEntries.forEach(zipEntry => {
            if (zipEntry.entryName === 'mimetype') {
                this.mimetype = zipEntry.getData().toString('utf8');
            } else if (zipEntry.entryName === 'META-INF/container.xml') {
                parseString(zipEntry.getData().toString('utf8'), (err, res) => {
                    if (!err) {
                        let rootfiles = filter(res, 'rootfiles');
                        for (let i in rootfiles) {
                            if (filter(rootfiles[i].rootfile, 'media-type') === 'application/oebps-package+xml') {
                                this.rootfile = filter(rootfiles[i].rootfile, 'full-path');
                                break;
                            }
                        }
                    }
                });
            } else if (zipEntry.entryName === this.rootfile) {
                parseString(zipEntry.getData().toString('utf-8'), (err, res) => {
                    if (!err) {
                        parseMetadata(res.package.metadata);
                        let manifest = parseManifest(res.package.manifest);
                        for (let i in manifest) {
                            if (manifest[i]['media-type'].indexOf('html') > -1) {
                                let number = manifest[i].href.replace(/\D/g,'');
                                if (number.length !== 0) {
                                    this.parts.push(manifest[i].href);
                                }
                            } else if (manifest[i]['media-type'].indexOf('css') > -1) {
                                this.stylesheets.push(manifest[i].href);
                            } else if (manifest[i]['media-type'].indexOf('image') > -1) {
                                this.images.push(manifest[i].href);
                            }
                        }
                    }
                });
            }
        });

        partsOrder = createPartsOrder();
    };

    this.nextPart = () => {
        this.currentPart = (this.currentPart + 1) < this.parts.length ? (this.currentPart + 1) : (this.parts.length - 1);
        let zip = new AdmZip(this.filepath);
        let zipEntry = zip.getEntry(this.parts[partsOrder[this.currentPart]]);
        let html = zipEntry.getData().toString('utf8');
        return render(html, zip);
    };

    this.prevPart = () => {
        this.currentPart = (this.currentPart - 1) >= 0 ? (this.currentPart - 1) : 0;
        let zip = new AdmZip(this.filepath);
        let zipEntry = zip.getEntry(this.parts[partsOrder[this.currentPart]]);
        let html = zipEntry.getData().toString('utf8');
        return render(html, zip);
    };

    this.mergeStylesheets = () => {
        let styles = [];
        let zip = new AdmZip(this.filepath);
        for (let i in this.stylesheets) {
            let zipEntry = zip.getEntry(this.stylesheets[i]);
            let style = zipEntry.getData().toString('utf8');
            styles.push(style);
        }
        return styles.join('\n');
    };

    let parseMetadata = (obj) => {
        if (obj instanceof Array) {
            for (let i in obj) {
                for (let k in obj[i]) {
                    if (k.indexOf('dc:') > -1) {
                        addToObject(this.metadata, k.replace('dc:', ''), obj[i][k]);
                    }
                }
            }
        } else {
            for (let k in obj) {
                if (k.indexOf('dc:') > -1) {
                    addToObject(this.metadata, k.replace('dc:', ''), obj[k]);
                }
            }
        }
    };

    let parseManifest = (obj) => {
        let manifest = [];
        obj = simplifyObject(obj);
        if (obj instanceof Array) {
            for (let i in obj) {
                addToArray(manifest, simplifyObject(obj[i]));
            }
        } else {
            addToArray(manifest, simplifyObject(obj));
        }
        return manifest;
    };

    let addToObject = (target, key, value) => {
        let val;
        if (!(value instanceof Array) || value.length > 1) {
            val = value;
        } else {
            val = value[0];
        }
        target[key] = simplifyObject(removeKeys(val, ['$']));
    };

    let addToArray = (target, value) => {
        let val;
        if (!(value instanceof Array) || value.length > 1) {
            val = value;
        } else {
            val = value[0];
        }
        target.push(val);
    };

    let filter = (obj, key) => {
        let result = undefined;
        for (let k in obj) {
            if (k === key) {
                result = obj[k];
            }
        }
        if (typeof result !== 'undefined') {
            return result;
        } else {
            for (let k in obj) {
                if (typeof result === 'undefined') {
                    result = filter(obj[k], key);
                }
            }
        }
        return result;
    };

    let removeKeys = (obj, keys) => {
        if (obj instanceof Array) {
            for (let i in obj) {
                if (!(typeof obj[i] === 'undefined')) {
                    obj = removeKeys(obj[i], keys);
                }
            }
        } else if (typeof obj === 'object') {
            for (let i in keys) {
                for (let k in obj) {
                    if (k === keys[i]) {
                        delete obj[k];
                    }
                }
            }
        }
        return obj;
    };

    let simplifyObject = (obj) => {
        if (obj instanceof Array) {
            for (let i in obj) {
                if (!(typeof obj[i] === 'undefined')) {
                    obj = simplifyObject(obj[i]);
                }
            }
        } else if(typeof obj === 'object') {
            if (Object.keys(obj).length === 1) {
                obj = obj[Object.keys(obj)[0]];
            } else {
                for (let k in obj) {
                    obj[k] = simplifyObject[obj[k]];
                }
            }
        }
        return obj;
    };

    let render = (html, zip) => {
        let dom = new JSDOM(html);
        dom.window.document.querySelectorAll('link').forEach(e => e.parentNode.removeChild(e));
        dom.window.document.querySelectorAll('img').forEach(e => {
            for (let i in this.images) {
                if (e.src.indexOf(this.images[i]) > -1) {
                    let zipEntry = zip.getEntry(this.images[i]);
                    let fileformat = path.extname(this.images[i]).replace('.', '');
                    let img = zipEntry.getData().toString('binary');
                    let base64Encoded = Buffer.from(img, 'binary').toString('base64');
                    e.src = 'data:image/' + fileformat + ';charset=utf-8;base64,' + base64Encoded;
                    break;
                }
            }
        });
        return dom.serialize();
    }

    let createPartsOrder = () => {
        let order = [];
        let numberOfDigits = [];
        let values = [];
        for (let i in this.parts) {
            let filename = this.parts[i].substring(this.parts[i].lastIndexOf('/') + 1, this.parts[i].lastIndexOf('.'));
            let number = filename.replace(/\D/g,'');
            if (number.length !== 0) {
                numberOfDigits.push(number.length);
                values.push(parseInt(number));
            }
        }

        let sameLength = true;
        for(let i in numberOfDigits) {
            for (let j in numberOfDigits) {
                if(numberOfDigits[i] !== numberOfDigits[j]) {
                    sameLength = false;
                }
            }
        }

        if (sameLength) {
            for (let i in this.parts) {
                order.push(i);
            }
        } else {
            let valuesCopy = values.slice(0);
            values.sort((a, b) => a - b);
            for (let i in values) {
                order.push(valuesCopy.indexOf(values[i]));
            }
        }

        return order;
    }
}

module.exports.EPUB = EPUB;