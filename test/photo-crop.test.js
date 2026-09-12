import test from 'node:test';
import assert from 'node:assert/strict';
import { cropRectangle } from '../public/photo-crop.js';
test('recorte mantém limites e escala em retrato, paisagem e zoom', () => {
 assert.deepEqual(cropRectangle(1200,800),{x:200,y:0,side:800});
 assert.deepEqual(cropRectangle(800,1200),{x:0,y:200,side:800});
 assert.deepEqual(cropRectangle(1200,800,2,100,100),{x:800,y:400,side:400});
 assert.deepEqual(cropRectangle(1200,800,1,-100,200),{x:0,y:0,side:800});
});
