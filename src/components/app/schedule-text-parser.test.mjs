import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScheduleText } from './schedule-text-parser.ts';

test('extracts eligible schedule details without inferring a title', () => {
  const text = [
    '에어컨 청소 예약 안내',
    '2026년 8월 2일',
    '오후 2시 30분 ~ 오후 4시',
    '주소: 서울특별시 강남구 테헤란로 123',
    '고객 연락처 010 1234 5678',
    '예상 비용 18만원',
  ].join('\n');

  assert.deepEqual(parseScheduleText(text), {
    date: '2026-08-02',
    startTime: '14:30',
    endTime: '16:00',
    address: '서울특별시 강남구 테헤란로 123',
    customerPhone: '010-1234-5678',
    estimatedPrice: '180000',
    additionalInfo: text,
  });
});

test('leaves absent eligible values undefined while retaining reviewed text', () => {
  const text = '일정 확인 부탁드립니다.';

  assert.deepEqual(parseScheduleText(text), {
    additionalInfo: text,
  });
});
