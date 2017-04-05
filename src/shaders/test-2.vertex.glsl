attribute vec2 aVertCoord;
uniform mat3 uTransformMatrix;
varying vec2 vTextureCoord;

void main(void) {
  vTextureCoord = aVertCoord;
  vec3 transformedCoords = uTransformMatrix * vec3(aVertCoord,1.0);
  gl_Position = vec4(transformedCoords.xy, 0.0, 1.0);
}
