import { NextResponse } from 'next/server';

export function privacyError(requestId: string, code: string, status: number) {
  const messages: Record<string, string> = {
    authentication_required: '인증이 필요합니다.',
    recent_reauthentication_required: '최근 본인 확인이 필요합니다.',
    privacy_operation_failed: '개인정보 요청을 처리할 수 없습니다.',
  };
  return NextResponse.json({
    error: { code, message: messages[code] ?? messages.privacy_operation_failed, requestId },
  }, { status, headers: { 'X-Request-Id': requestId } });
}

export function privacySuccess(body: Record<string, unknown>, requestId: string, status = 200) {
  return NextResponse.json({ ...body, requestId }, { status, headers: { 'X-Request-Id': requestId } });
}

export function privacyFailureFor(error: unknown, requestId: string) {
  const message = error instanceof Error ? error.message : '';
  if (/authentication is required/i.test(message)) return privacyError(requestId, 'authentication_required', 401);
  if (/reauthentication/i.test(message)) return privacyError(requestId, 'recent_reauthentication_required', 403);
  return privacyError(requestId, 'privacy_operation_failed', 400);
}
