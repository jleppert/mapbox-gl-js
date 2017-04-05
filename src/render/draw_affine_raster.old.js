'use strict';

const glMatrix = require('@mapbox/gl-matrix');
const Buffer = require('../data/buffer');
const VertexArrayObject = require('./vertex_array_object');
const PosArray = require('../data/pos_array');
const pattern = require('./pattern');
const mat3 = glMatrix.mat3;
const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

const util = require('../util/util');

module.exports = drawRaster;

function drawRaster(painter, sourceCache, layer, coords) {
    if (painter.isOpaquePass) return;

    console.log('got here', arguments);
    const gl = painter.gl;

    const program = painter.useProgram('test');
    
    var shaderProgram = program.program;
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");

    initBuffers();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    gl.viewportWidth = gl.drawingBufferWidth;
    gl.viewportHeight = gl.drawingBufferHeight;

    var mvMatrix = mat4.create();
    var pMatrix = mat4.create();
    var triangleVertexPositionBuffer;
    var squareVertexPositionBuffer;

    drawScene();

    function initBuffers() {
      triangleVertexPositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
      var vertices = [
        0.0,  1.0,  0.0,
        -1.0, -1.0,  0.0,
        1.0, -1.0,  0.0
          ];
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      triangleVertexPositionBuffer.itemSize = 3;
      triangleVertexPositionBuffer.numItems = 3;

      squareVertexPositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexPositionBuffer);
      vertices = [
        1.0,  1.0,  0.0,
        -1.0,  1.0,  0.0,
        1.0, -1.0,  0.0,
        -1.0, -1.0,  0.0
          ];
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      squareVertexPositionBuffer.itemSize = 3;
      squareVertexPositionBuffer.numItems = 4;
    }

    function drawScene() {
      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      mat4.perspective(pMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

      mat4.identity(mvMatrix);

      mat4.translate(mvMatrix, mvMatrix, [-1.5, 0.0, -7.0]);
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, triangleVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
      setMatrixUniforms();
      gl.drawArrays(gl.TRIANGLES, 0, triangleVertexPositionBuffer.numItems);


      mat4.translate(mvMatrix, mvMatrix, [3.0, 0.0, 0.0]);
      gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexPositionBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, squareVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
      setMatrixUniforms();
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, squareVertexPositionBuffer.numItems);
    }

    function setMatrixUniforms() {
      gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
      gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
    }




    
    /*const gl = painter.gl;
    
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);

    painter.depthMask(true);
    
    const texture = new AffineTexture(gl, painter, layer);
    texture.bindFramebuffer();
    
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    // Change depth function to prevent double drawing in areas where tiles overlap.
    gl.depthFunc(gl.LESS);

    const minTileZ = coords.length && coords[0].z;

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        // set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        painter.setDepthSublayer(coord.z - minTileZ);
        drawRasterTile(painter, sourceCache, layer, coord);
    }

    gl.depthFunc(gl.LEQUAL);

    texture.unbindFramebuffer();
    texture.renderToMap();*/
}

function AffineTexture(gl, painter, layer) {
  this.gl = gl;
  this.width = painter.width;
  this.height = painter.height;
  this.painter = painter;
  this.layer = layer;

  this.texture = null;
  this.fbo = null;
  this.fbos = this.painter.preFbos[this.width] && this.painter.preFbos[this.width][this.height];
}

AffineTexture.prototype.bindFramebuffer = function() {
  const gl = this.gl;

  this.texture = this.painter.getViewportTexture(this.width, this.height);

  gl.activeTexture(gl.TEXTURE1);
  if (!this.texture) {
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.texture.width = this.width;
      this.texture.height = this.height;
  } else {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  if (!this.fbos) {
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      const colorRenderbuffer = gl.createRenderbuffer();
      const depthRenderBuffer = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, colorRenderbuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, this.width, this.height);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRenderbuffer);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
  } else {
      this.fbo = this.fbos.pop();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
  }
};

AffineTexture.prototype.unbindFramebuffer = function() {
    this.painter.bindDefaultFramebuffer();
    if (this.fbos) {
        this.fbos.push(this.fbo);
    } else {
        if (!this.painter.preFbos[this.width]) this.painter.preFbos[this.width] = {};
        this.painter.preFbos[this.width][this.height] = [this.fbo];
    }
    this.painter.saveViewportTexture(this.texture);
};

AffineTexture.prototype.renderToMap = function() {
  const gl = this.gl;
  const painter = this.painter;
  const program = painter.useProgram('extrusionTexture');

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.texture);

  gl.uniform1f(program.u_opacity, this.layer.paint['fill-extrusion-opacity']);
  gl.uniform1i(program.u_image, 1);

  gl.uniformMatrix4fv(program.u_matrix, false, mat4.ortho(
      mat4.create(),
      0,
      painter.width,
      painter.height,
      0,
      0,
      1)
  );

  gl.disable(gl.DEPTH_TEST);

  gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

  const array = new PosArray();
  array.emplaceBack(0, 0);
  array.emplaceBack(1, 0);
  array.emplaceBack(0, 1);
  array.emplaceBack(1, 1);
  const buffer = Buffer.fromStructArray(array, Buffer.BufferType.VERTEX);

  const vao = new VertexArrayObject();
  vao.bind(gl, program, buffer);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  gl.enable(gl.DEPTH_TEST);
};




function drawRasterTile(painter, sourceCache, layer, coord) {

    const gl = painter.gl;

    gl.disable(gl.STENCIL_TEST);

    const tile = sourceCache.getTile(coord);
    const posMatrix = painter.transform.calculatePosMatrix(coord, sourceCache.getSource().maxzoom);

    tile.registerFadeDuration(painter.style.animationLoop, layer.paint['raster-fade-duration']);

    const program = painter.useProgram('raster');
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);

    // color parameters
    gl.uniform1f(program.u_brightness_low, layer.paint['raster-brightness-min']);
    gl.uniform1f(program.u_brightness_high, layer.paint['raster-brightness-max']);
    gl.uniform1f(program.u_saturation_factor, saturationFactor(layer.paint['raster-saturation']));
    gl.uniform1f(program.u_contrast_factor, contrastFactor(layer.paint['raster-contrast']));
    gl.uniform3fv(program.u_spin_weights, spinWeights(layer.paint['raster-hue-rotate']));

    const parentTile = tile.sourceCache && tile.sourceCache.findLoadedParent(coord, 0, {}),
        fade = getFadeValues(tile, parentTile, layer, painter.transform);

    let parentScaleBy, parentTL;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);

    gl.activeTexture(gl.TEXTURE1);

    if (parentTile) {
        gl.bindTexture(gl.TEXTURE_2D, parentTile.texture);
        parentScaleBy = Math.pow(2, parentTile.coord.z - tile.coord.z);
        parentTL = [tile.coord.x * parentScaleBy % 1, tile.coord.y * parentScaleBy % 1];

    } else {
        gl.bindTexture(gl.TEXTURE_2D, tile.texture);
    }

    // cross-fade parameters
    gl.uniform2fv(program.u_tl_parent, parentTL || [0, 0]);
    gl.uniform1f(program.u_scale_parent, parentScaleBy || 1);
    gl.uniform1f(program.u_buffer_scale, 1);
    gl.uniform1f(program.u_fade_t, fade.mix);
    gl.uniform1f(program.u_opacity, fade.opacity * layer.paint['raster-opacity']);
    gl.uniform1i(program.u_image0, 0);
    gl.uniform1i(program.u_image1, 1);

    const buffer = tile.boundsBuffer || painter.rasterBoundsBuffer;
    const vao = tile.boundsVAO || painter.rasterBoundsVAO;
    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.length);
}

function spinWeights(angle) {
    angle *= Math.PI / 180;
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return [
        (2 * c + 1) / 3,
        (-Math.sqrt(3) * s - c + 1) / 3,
        (Math.sqrt(3) * s - c + 1) / 3
    ];
}

function contrastFactor(contrast) {
    return contrast > 0 ?
        1 / (1 - contrast) :
        1 + contrast;
}

function saturationFactor(saturation) {
    return saturation > 0 ?
        1 - 1 / (1.001 - saturation) :
        -saturation;
}

function getFadeValues(tile, parentTile, layer, transform) {
    const fadeDuration = layer.paint['raster-fade-duration'];

    if (tile.sourceCache && fadeDuration > 0) {
        const now = Date.now();
        const sinceTile = (now - tile.timeAdded) / fadeDuration;
        const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

        const source = tile.sourceCache.getSource();
        const idealZ = transform.coveringZoomLevel({
            tileSize: source.tileSize,
            roundZoom: source.roundZoom
        });

        // if no parent or parent is older, fade in; if parent is younger, fade out
        const fadeIn = !parentTile || Math.abs(parentTile.coord.z - idealZ) > Math.abs(tile.coord.z - idealZ);

        const childOpacity = (fadeIn && tile.refreshedUponExpiration) ? 1 : util.clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);

        // we don't crossfade tiles that were just refreshed upon expiring:
        // once they're old enough to pass the crossfading threshold
        // (fadeDuration), unset the `refreshedUponExpiration` flag so we don't
        // incorrectly fail to crossfade them when zooming
        if (tile.refreshedUponExpiration && sinceTile >= 1) tile.refreshedUponExpiration = false;

        if (parentTile) {
            return {
                opacity: 1,
                mix: 1 - childOpacity
            };
        } else {
            return {
                opacity: childOpacity,
                mix: 0
            };
        }
    } else {
        return {
            opacity: 1,
            mix: 0
        };
    }
}
