(function() {

  var myRequestAnimFrame = (function() {
    return window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      function(callback) {
        window.setTimeout(callback, 1000 / 60);
      };
  })();

  function clone(obj) {
    var res = {};
    for (var k in obj) res[k] = obj[k];
    return res;
  }

  var defaults = {
    interactive: true,
    droppable: true,
    selectable: true,
    width: null,
    height: null,
    message: 'Drop an image or click to select one.',
    minZoom: 1,
    maxZoom: Infinity
  }

  function AvatarCropFilter(name, fn, defaults) {
    this.name = name;
    this.fn = fn;
    this.configs = defaults || {};
  }

  AvatarCropFilter.prototype.exec = function(self, canvas) {
    this.fn.call(this, self, canvas);
  }

  AvatarCropFilter.prototype.config = function(data) {
    for (var k in data) {
      this.configs[k] = data[k];
    }
  }

  function AvatarCrop(el, options) {
    if (!el) {
      throw 'Missing element.';
    }
    var self = this;
    this.canvas = AvatarCrop.createBoard();
    this._callbacks = {};
    this.filters = [];
    this.config(options);
    el.appendChild(this.canvas);
    this.clear();
  }

  AvatarCrop.DEFAULT_WIDTH = 256;
  AvatarCrop.DEFAULT_HEIGHT = 256;
  AvatarCrop.DEFAULT_WHEEL_FACTOR = 100;
  AvatarCrop.DEFAULT_ANIM_DURATE = 250;
  AvatarCrop.DEFAULT_MODE = 'fit';
  AvatarCrop.filters = {};
  AvatarCrop.Filter = AvatarCropFilter;

  AvatarCrop.addFilter = function(name, fn, config) {
    AvatarCrop.filters[name] = {
      fn: fn,
      defaults: config
    }
  }

  AvatarCrop.createBoard = function() {
    var c = document.createElement('canvas');
    c.style.border = 'solid 1px #DDD';
    c.style.backgroundColor = '#FFF';
    c.style.backgroundImage = 'url("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSIzMnB4IiBoZWlnaHQ9IjMycHgiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZW5hYmxlLWJhY2tncm91bmQ9Im5ldyAwIDAgMzIgMzIiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxyZWN0IGZpbGw9IiNDQ0NDQ0MiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIvPjxyZWN0IHg9IjE2IiB5PSIxNiIgZmlsbD0iI0NDQ0NDQyIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+PC9zdmc+")';
    c.style.userSelect = 'none';
    c.style.webkitUserSelect = 'none';
    return c;
  }

  AvatarCrop.prototype.config = function(options) {
    var old = clone(this.options || {});
    var opt = this.options || clone(defaults);
    if (options) {
      for (var k in options) {
        if (typeof opt[k] !== 'undefined') {
          opt[k] = options[k];
        }
      }
    }
    if (this.canvas) {
      this.canvas.width = opt.width || AvatarCrop.DEFAULT_WIDTH;
      this.canvas.height = opt.height || AvatarCrop.DEFAULT_HEIGHT;
      if (opt.interactive && !old.interactive) {
        this.bindInteractive();
      } else if (old.interactive) {
        this.unbindInteractive();
      }
      if (opt.droppable && !old.droppable) {
        this.bindDroppable();
      } else if (old.droppable) {
        this.unbindDroppable();
      }
      if (opt.selectable && !old.selectable) {
        this.bindSelectable();
      } else if (old.selectable) {
        this.unbindSelectable();
      }
    }
    this.options = opt;
  }

  AvatarCrop.prototype.addEventListener = function(name, fn) {
    this._callbacks[name] = this._callbacks[name] || [];
    this._callbacks[name].push(fn);
  }

  AvatarCrop.prototype.fire = function(evt) {
    var clbs = this._callbacks[evt] || [];
    for (var i = 0, len = clbs.length; i < len; i++) {
      clbs[i].apply(this);
    }
  }

  AvatarCrop.prototype.bindInteractive = function() {
    var self = this,
        canvas = this.canvas,
        ctx = canvas.getContext('2d'),
        canMouseX = 0,
        canMouseY = 0,
        wheel = 0,
        isDragging = false;

    function handleMouseDown(e) {
      if (self.data) {
        canMouseX = e.clientX + self._offsetX;
        canMouseY = e.clientY + self._offsetY;
        isDragging = true;
      }
    }

    function handleMouseUp(e) {
      isDragging = false;
    }

    function handleMouseMove(e) {
      if (isDragging) {
        self.move(e.clientX - canMouseX, e.clientY - canMouseY);
      }
    }

    function handleMouseWheel(e) {
      if (self.data) {
        if (isDragging) return true;
        e.stopPropagation();
        e.preventDefault();
        var delta = -(e.detail ? e.detail * (-120) : e.wheelDelta) / AvatarCrop.DEFAULT_WHEEL_FACTOR;
        self.zoom(self._zoom + delta);
        wheel = delta;
        return false;
      }
    }

    function handleDblClick(e) {
      if (self.data) {
        e.stopPropagation();
        e.preventDefault();
        if (self._zoom == 1) {
          if (self._offsetX == 0 && self._offsetY == 0) {
            self.fill();
          } else {
            self.center();
          }
        } else {
          self.fit();
        }
        return false;
      }
    }

    canvas.addEventListener('mousedown', handleMouseDown, false);
    canvas.addEventListener('mousemove', handleMouseMove, false);
    canvas.addEventListener('mouseup', handleMouseUp, false);
    canvas.addEventListener('mouseout', handleMouseUp, false);
    canvas.addEventListener('dblclick', handleDblClick, false);
    canvas.addEventListener('mousewheel', handleMouseWheel, false);
    canvas.addEventListener('DOMMouseScroll', handleMouseWheel, false);
  }

  AvatarCrop.prototype.unbindInteractive = function() {
    var canvas = this.canvas;
    canvas.removeEventListener('mousedown');
    canvas.removeEventListener('mousemove');
    canvas.removeEventListener('mouseup');
    canvas.removeEventListener('mouseout');
    canvas.removeEventListener('dblclick');
    canvas.removeEventListener('mousewheel');
    canvas.removeEventListener('DOMMouseScroll');
  }

  AvatarCrop.prototype.bindDroppable = function() {
    var self = this,
        canvas = this.canvas;
    if (typeof FileReader !== 'undefined') {
      canvas.addEventListener('drop', function(e) {
        e.preventDefault();
        var files = e.dataTransfer.files;
        if (files.length > 0) {
          self.handleFile(files[0]);
        }
      });

      canvas.addEventListener('dragover', function(e) {
        e.preventDefault();
      }, false);
    }
  }

  AvatarCrop.prototype.unbindDroppable = function() {
    var canvas = this.canvas;
    canvas.removeEventListener('dragover');
    canvas.removeEventListener('drop');
  }

  AvatarCrop.prototype.bindSelectable = function () {
    var self = this,
        canvas = this.canvas;
    canvas.addEventListener('click', function(e) {
      if (!self.data) {
        var input = document.createElement('input');
        input.type = 'file';
        input.style.visibility = 'hidden';
        document.body.appendChild(input);
        var ev = document.createEvent('MouseEvents');
        ev.initEvent('click', true, true);
        ev.synthetic = true;

        input.addEventListener('change', function(fileEv) {
          if (this.files && this.files[0]) {
            self.handleFile(this.files[0]);
          }
          if (input.parentNode) {
            document.body.removeChild(input);
          }
        });
        setTimeout(function() {
          if (input.parentNode) {
            document.body.removeChild(input);
          }
        }, 20 * 1000);

        input.dispatchEvent(ev, true);
      }
    });
  }

  AvatarCrop.prototype.unbindSelectable = function() {
    var canvas = this.canvas;
    canvas.removeEventListener('click');
  }

  AvatarCrop.prototype.setLoadState = function(load) {
    var self = this,
      start = Date.now(),
      lines = 16,
      canvas = this.canvas,
      cW = canvas.width,
      cH = canvas.height,
      context = canvas.getContext('2d');
    if (load) {

      self._loading = true;
      canvas.style.cursor = 'progress';
      var draw = function() {
        myRequestAnimFrame(function() {
          var rotation = parseInt(((new Date() - start) / 1000) * lines) / lines;
          context.save();
          context.clearRect(0, 0, cW, cH);
          context.translate(cW / 2, cH / 2);
          context.rotate(Math.PI * 2 * rotation);
          for (var i = 0; i < lines; i++) {
            context.beginPath();
            context.rotate(Math.PI * 2 / lines);
            context.moveTo(cW / 10, 0);
            context.lineTo(cW / 4, 0);
            context.lineWidth = cW / 30;
            context.strokeStyle = "rgba(0, 0, 0," + i / lines + ")";
            context.stroke();
          }
          context.restore();
          if (self._loading) {
            draw();
          }
        });
      }
      draw();
    } else {
      context.clearRect(0, 0, cW, cH);
      canvas.style.cursor = 'default';
      delete this._loading;
    }
  }

  AvatarCrop.prototype.handleFile = function(file) {
    if (file.type.indexOf('image') !== -1) {
      var self = this,
        reader = new FileReader();
      self.setLoadState(true);
      self.canvas.style.cursor = 'progress';
      reader.onload = function(e) {
        self.setLoadState(false);
        self.setSource(e.target.result);
      };
      reader.onerror = function() {
        self.setLoadState(false);
      }
      reader.readAsDataURL(file);
    }
  }

  AvatarCrop.prototype.setSource = function(data) {
    var self = this,
      canvas = this.canvas,
      image = new Image();

    self.setLoadState(true);
    image.addEventListener('load', function() {
      self.fire('load');
      self.setLoadState(false);
      self.data = image;
      self.reset();
      if (self.options.interactive) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    });
    img.addEventListener('error', function() {
      self.setLoadState(false);
    });
    image.src = data;
  }

  AvatarCrop.prototype.fit = function(durate) {
    this.moveAndZoom(0, 0, 1, durate || AvatarCrop.DEFAULT_ANIM_DURATE);
  }

  AvatarCrop.prototype.fill = function(durate) {
    if (this.data) {
      var image = this.data,
        imageW = image.width,
        imageH = image.height;
      if (imageH > imageW) {
        this.moveAndZoom(0, 0, imageH / imageW, durate || AvatarCrop.DEFAULT_ANIM_DURATE);
      } else {
        this.moveAndZoom(0, 0, imageW / imageH, durate || AvatarCrop.DEFAULT_ANIM_DURATE);
      }
    }
  }

  AvatarCrop.prototype.move = function(x, y, durate) {
    this.moveAndZoom(x, y, this._zoom, durate);
  }

  AvatarCrop.prototype.zoom = function(zoom, durate) {
    var x = (-this._offsetX / this._zoom) * zoom,
      y = (-this._offsetY / this._zoom) * zoom;
    this.moveAndZoom(x, y, zoom, durate);
  }

  AvatarCrop.prototype.moveAndZoom = function(x, y, zoom, durate) {
    if (this.data) {
      durate = durate || 0;
      x = -x;
      y = -y;
      var self = this,
        options = this.options,
        start = Date.now(),
        end = start + durate,
        startZoom = this._zoom,
        startX = this._offsetX,
        startY = this._offsetY,
        rangeZoom = zoom - startZoom,
        rangeX = x - startX,
        rangeY = y - startY;

      zoom = Math.min(Math.max(zoom, options.minZoom), options.maxZoom);

      function setVals(xTmp, yTmp, zoomTmp) {
        self._offsetX = xTmp;
        self._offsetY = yTmp;
        self._zoom = zoomTmp;
        self.render();
      }

      if (durate) {
        var animate = function() {
          myRequestAnimFrame(function() {
            var time = Date.now(),
              frame = Math.min(time - start, durate) / durate,
              fracZoom = rangeZoom * frame,
              zoomTmp = startZoom + fracZoom,
              fracX = rangeX * frame,
              xTmp = startX + fracX,
              fracY = rangeY * frame,
              yTmp = startY + fracY;

            setVals(xTmp, yTmp, zoomTmp);
            if (time < end) animate();
          }, 10);
        }
        animate();
      } else {
        setVals(x, y, zoom);
      }
    }
  }

  AvatarCrop.prototype.reset = function(durate) {
    if (typeof this[AvatarCrop.DEFAULT_MODE] == 'function') {
      this[AvatarCrop.DEFAULT_MODE].call(this, durate);
    }
  }

  AvatarCrop.prototype.center = function(durate) {
    this.moveAndZoom(0, 0, this._zoom, durate || AvatarCrop.DEFAULT_ANIM_DURATE);
  }

  AvatarCrop.prototype.clear = function() {
    this.filters = [];
    this._offsetX = 0;
    this._offsetY = 0;
    this._zoom = 1;
    this.data = null;
    var canvas = this.canvas,
        ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillText(this.options.message, canvas.width / 2, canvas.height / 2);
    if (this.options.selectable) {
      canvas.style.cursor = 'pointer';
    }
    this.fire('clear');
  }

  AvatarCrop.prototype.render = function() {
    if (this.data) {
      var self = this,
        image = this.data,
        zoom = this._zoom,
        canvas = this.canvas,
        ctx = canvas.getContext('2d'),
        imageW = image.width,
        imageH = image.height,
        rap = imageW / imageH,
        filters = this.filters;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (rap < 1) {
        var w = canvas.height * rap;
        ctx.drawImage(image, 0, 0, imageW, imageH, (canvas.width - w * zoom) / 2 - this._offsetX, (canvas.height - canvas.height * zoom) / 2 - this._offsetY, w * zoom, canvas.height * zoom);
      } else {
        var h = canvas.width / rap;
        ctx.drawImage(image, 0, 0, imageW, imageH, (canvas.width - canvas.width * zoom) / 2 - this._offsetX, (canvas.height - h * zoom) / 2 - this._offsetY, canvas.width * zoom, h * zoom);
      }

      for (var i = 0, len = filters.length; i < len; i++) {
        filters[i].exec(this, canvas);
      }
      clearTimeout(self.fireTimeout);
      self.fireTimeout = setTimeout(function() {
        self.fire('change');
        delete self.fireTimeout;
      }, 250);
    }
  }

  AvatarCrop.prototype.save = function() {
    if (this.data) {
      return this.canvas.toDataURL();
    }
  }

  AvatarCrop.prototype.hasFilter = function(name) {
    var filters = this.filters;
    for (var i = 0, len = filters.length; i < len; i++) {
      if (filters[i].name == name) {
        return true;
      }
    }
    return false;
  }

  AvatarCrop.prototype.addFilter = function(name, fn) {
    if (this.hasFilter(name)) {
      return;
    }
    if (typeof fn == 'function') {
      this.filters.push(new AvatarCrop.Filter(name, fn));
      this.render();
    } else if (AvatarCrop.filters[name]) {
      var filterDef = AvatarCrop.filters[name],
        filter = new AvatarCrop.Filter(name, filterDef.fn, filterDef.defaults);
      if (fn) {
        filter.config(fn);
      }
      this.filters.push(filter);
      this.render();
    }
  }

  AvatarCrop.prototype.removeFilter = function(name) {
    var filters = this.filters;
    for (var i = 0, len = filters.length; i < filters.length; i++) {
      if (filters[i].name == name) {
        this.filters.splice(i, 1);
        this.render();
        return true;
      }
    }
  }

  AvatarCrop.prototype.removeAllFilters = function() {
    this.filters = [];
    this.render();
  }

  AvatarCrop.prototype.updateFilter = function(name, options) {
    var filters = this.filters;
    for (var i = 0, len = filters.length; i < filters.length; i++) {
      if (filters[i].name == name) {
        filters[i].config(options);
        this.render();
      }
    }
  }

  if (typeof module != 'undefined') {
    module.exports = AvatarCrop;
  } else if (typeof define == 'function' && typeof define.amd == 'object') {
    define(function() {
      return {
        'AvatarCrop': AvatarCrop
      }
    });
  } else {
    window.AvatarCrop = AvatarCrop;
  }

})(window);