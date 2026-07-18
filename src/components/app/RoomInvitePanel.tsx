'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';

type InviteResponse = {
  inviteId: string;
  tokenHint: string;
  url: string;
  expiresAt: string;
  maxUses: number;
};

function initialExpiry() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

async function responsePayload(response: Response) {
  return response.json().catch(() => ({})) as Promise<InviteResponse & { message?: string }>;
}

export function RoomInvitePanel({ open, roomId, onClose }: { open: boolean; roomId: string; onClose: () => void }) {
  const [grantRole, setGrantRole] = useState<'member' | 'viewer'>('member');
  const [expiresAt, setExpiresAt] = useState(initialExpiry);
  const [maxUses, setMaxUses] = useState('1');
  const [reason, setReason] = useState('초대 링크 재발급');
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const payload = () => ({
    expiresAt: new Date(expiresAt).toISOString(),
    maxUses: Number(maxUses),
  });

  const createInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload(), grantRole }),
      });
      const result = await responsePayload(response);
      if (!response.ok) throw new Error(result.message ?? '초대 링크를 만들 수 없습니다.');
      setInvite(result);
      setMessage('새 초대 링크가 준비되었습니다. 링크는 지금 복사해 보관하세요.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '초대 링크를 만들 수 없습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const replaceInvite = async () => {
    if (!invite) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(invite.inviteId)}/replace`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload(), reason }),
      });
      const result = await responsePayload(response);
      if (!response.ok) throw new Error(result.message ?? '초대 링크를 재발급할 수 없습니다.');
      setInvite(result);
      setMessage('기존 링크를 취소하고 새 초대 링크를 발급했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '초대 링크를 재발급할 수 없습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const revokeInvite = async () => {
    if (!invite) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(invite.inviteId)}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const result = await responsePayload(response);
      if (!response.ok) throw new Error(result.message ?? '초대 링크를 취소할 수 없습니다.');
      setInvite(null);
      setMessage('초대 링크를 취소했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '초대 링크를 취소할 수 없습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setMessage('초대 링크를 복사했습니다.');
    } catch {
      setMessage('링크를 복사하지 못했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <Sheet open={open} title="초대 링크 관리" description="링크는 필요한 범위와 기간으로만 발급하세요." onClose={onClose}>
      <form className="space-y-4" onSubmit={createInvite}>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900">참여 권한</p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={grantRole === 'member' ? 'secondary' : 'outline'} onClick={() => setGrantRole('member')}>구성원</Button>
            <Button type="button" variant={grantRole === 'viewer' ? 'secondary' : 'outline'} onClick={() => setGrantRole('viewer')}>보기 전용</Button>
          </div>
        </div>
        <Field label="만료 일시" name="expiresAt" type="datetime-local" value={expiresAt} min={new Date().toISOString().slice(0, 16)} onChange={(event) => setExpiresAt(event.target.value)} required />
        <Field label="사용 가능 횟수" name="maxUses" type="number" min="1" max="1000" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} required />
        <Button className="w-full" disabled={isSubmitting}>초대 링크 만들기</Button>
      </form>

      {invite ? (
        <Card className="mt-5 space-y-3">
          <div>
            <p className="text-xs font-bold text-gray-500">현재 발급 링크</p>
            <p className="mt-1 break-all text-sm font-semibold text-gray-900">{invite.url}</p>
          </div>
          <p className="text-xs text-gray-600">힌트: ···{invite.tokenHint} · {new Date(invite.expiresAt).toLocaleString('ko-KR')}까지 · {invite.maxUses}회</p>
          <Button type="button" variant="outline" className="w-full" onClick={copyInvite}>초대 링크 복사</Button>
          <Field label="변경 또는 취소 사유" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting || !reason.trim()} onClick={replaceInvite}>링크 재발급</Button>
            <Button type="button" variant="danger" disabled={isSubmitting || !reason.trim()} onClick={revokeInvite}>링크 취소</Button>
          </div>
        </Card>
      ) : null}
      {message ? <p className="mt-4 text-sm font-semibold text-app-blue" aria-live="polite">{message}</p> : null}
    </Sheet>
  );
}
