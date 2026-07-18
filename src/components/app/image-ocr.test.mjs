import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateResizedDimensions, validateImageFile } from './image-ocr.ts';

test('limits local OCR images to a 2048px maximum edge', () => {
  assert.deepEqual(calculateResizedDimensions(4096, 2048), { width: 2048, height: 1024 });
  assert.deepEqual(calculateResizedDimensions(1200, 800), { width: 1200, height: 800 });
});

test('rejects non-images, empty images, and images larger than 10MB', () => {
  assert.equal(validateImageFile({ type: 'text/plain', size: 10 }), '이미지 파일만 선택할 수 있습니다.');
  assert.equal(validateImageFile({ type: 'image/png', size: 0 }), '비어 있는 이미지는 인식할 수 없습니다.');
  assert.equal(validateImageFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 }), '10MB 이하의 이미지를 선택해 주세요.');
  assert.equal(validateImageFile({ type: 'image/png', size: 1024 }), null);
});
