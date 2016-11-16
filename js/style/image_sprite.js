'use strict';

const Evented = require('../util/evented');
const ajax = require('../util/ajax');
const browser = require('../util/browser');
const normalizeURL = require('../util/mapbox').normalizeSpriteURL;

class SpritePosition {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.width = 0;
        this.height = 0;
        this.pixelRatio = 1;
        this.sdf = false;
    }
}

function premultiply(imgData) {
    for (let i = 0; i < imgData.length; i += 4) {
        const alpha = imgData[i + 3] / 255;
        imgData[i + 0] *= alpha;
        imgData[i + 1] *= alpha;
        imgData[i + 2] *= alpha;
    }

    return imgData;
}

class ImageSprite extends Evented {

    constructor(baseUrlOrJson) {
        super();
        this.base = baseUrlOrJson;
        this.retina = browser.devicePixelRatio > 1;

        const format = this.retina ? '@2x' : '';

        if (baseUrlOrJson.charAt(0) !== "{") {
            this.loadRemote(baseUrlOrJson, format);
        } else {
            this.loadLocal(baseUrlOrJson);
        }
    }

    loadLocal(json) {
        const parsedBase = JSON.parse(json);
        this.data = parsedBase.data;

        const img = new Image();
        img.getData = function() {
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);
            return context.getImageData(0, 0, img.width, img.height).data;
        };

        img.onload = (function() {
            this.finalizeLoadImage(null, img);
        }).bind(this);

        img.src = parsedBase.url;
    }

    loadRemote(baseUrl, format) {
        ajax.getJSON(normalizeURL(baseUrl, format, '.json'), (err, data) => {
            this.data = data;
            if (this.imgData) this.fire('data', {dataType: 'style'});
        });

        ajax.getImage(normalizeURL(baseUrl, format, '.png'), this.finalizeLoadImage.bind(this));
    }

    finalizeLoadImage(err, img) {
        if (err) {
            this.fire('error', {error: err});
            return;
        }

        this.imgData = premultiply(browser.getImageData(img));
        this.width = img.width;

        if (this.data) this.fire('data', { dataType: 'style' });
    }

    toJSON() {
        return this.base;
    }

    loaded() {
        return !!(this.data && this.imgData);
    }

    resize(/*gl*/) {
        if (browser.devicePixelRatio > 1 !== this.retina) {
            const newSprite = new ImageSprite(this.base);
            newSprite.on('data', () => {
                this.data = newSprite.data;
                this.imgData = newSprite.imgData;
                this.width = newSprite.width;
                this.retina = newSprite.retina;
            });
        }
    }

    getSpritePosition(name) {
        if (!this.loaded()) return new SpritePosition();

        const pos = this.data && this.data[name];
        if (pos && this.imgData) return pos;

        return new SpritePosition();
    }
}

module.exports = ImageSprite;
