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

    let rootfileFolder = undefined;

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
                                let separatorIndex = this.rootfile.lastIndexOf('/');
                                if (separatorIndex > -1) {
                                    rootfileFolder = this.rootfile.slice(0, separatorIndex);
                                }
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

        this.parts.sort(partsComparator);
    };

    this.nextPart = () => {
        this.currentPart = (this.currentPart + 1) < this.parts.length ? (this.currentPart + 1) : (this.parts.length - 1);
        let zip = new AdmZip(this.filepath);
        let zipEntry = getEntry(zip, this.parts[this.currentPart]);
        let html = zipEntry.getData().toString('utf8');
        return render(html, zip);
    };

    this.prevPart = () => {
        this.currentPart = (this.currentPart - 1) >= 0 ? (this.currentPart - 1) : 0;
        let zip = new AdmZip(this.filepath);
        let zipEntry = getEntry(zip, this.parts[this.currentPart]);
        let html = zipEntry.getData().toString('utf8');
        return render(html, zip);
    };

    this.mergeStylesheets = () => {
        let styles = [];
        let zip = new AdmZip(this.filepath);
        for (let i in this.stylesheets) {
            let zipEntry = getEntry(zip, this.stylesheets[i]);
            let style = zipEntry.getData().toString('utf8');
            styles.push(style);
        }
        return styles.join('\n');
    };

    let getEntry = (zip, entryName) => {
        let entry = zip.getEntry(entryName);
        if (entry === undefined || entry === null) {
            entry = zip.getEntry(appendRootFolder(entryName));
        }
        return entry;
    };

    let appendRootFolder = (path) => {
        if (path.indexOf(rootfileFolder) > -1) {
            return path;
        } else {
            if (path.indexOf('/') === 0) {
                return rootfileFolder + path;
            } else {
                return rootfileFolder + '/' + path;
            }
        }
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
            while (e.src.charAt(0) === '.') {
                e.src = e.src.substr(1);
            }
            for (let i in this.images) {
                if ((e.src.indexOf(this.images[i]) > -1) || (this.images[i].indexOf(e.src) > -1)) {
                    let zipEntry = getEntry(zip, this.images[i]);
                    let fileformat = path.extname(this.images[i]).replace('.', '');
                    let img = zipEntry.getData().toString('binary');
                    let base64Encoded = Buffer.from(img, 'binary').toString('base64');
                    e.src = 'data:image/' + fileformat + ';charset=utf-8;base64,' + base64Encoded;
                    break;
                }
            }
        });
        return dom.serialize();
    };

    let partsComparator = (entryName1, entryName2) => {
        let res1 = entryName1.match(/\d*/g).filter(e => e !== '');
        let res2 = entryName2.match(/\d*/g).filter(e => e !== '');
        for (let i in res1) {
            let diff = parseInt(res1[i]) - parseInt(res2[i]);
            if (diff !== 0) {
                return diff;
            }
        }
        return 0;
    };
}

module.exports.EPUB = EPUB;