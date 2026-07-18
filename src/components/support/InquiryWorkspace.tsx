'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, TextareaField } from '@/components/ui/field';

type InquirySummary = {
  id: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'answered' | 'closed';
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

type InquiryDetail = {
  id: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'answered' | 'closed';
  body: string;
  createdAt?: string;
  messages: Array<{ id: string; authorKind: 'user' | 'admin'; body: string; createdAt: string }>;
};

const categoryLabels: Record<string, string> = {
  general: '서비스 이용', account: '계정', consent: '동의', privacy: '개인정보', appeal: '이의 제기',
};
const statusLabels: Record<InquirySummary['status'], string> = {
  open: '접수됨', in_progress: '확인 중', answered: '답변 완료', closed: '종료됨',
};

function dateText(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ko-KR');
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? '요청을 처리할 수 없습니다.');
  return body;
}

export function InquiryWorkspace({ inquiryId }: { inquiryId?: string }) {
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setNotice(null);
    try {
      if (inquiryId) {
        const payload = await requestJson(`/api/inquiries/${inquiryId}`) as { inquiry: InquiryDetail };
        setInquiry(payload.inquiry);
      } else {
        const payload = await requestJson('/api/inquiries') as { inquiries: InquirySummary[] };
        setInquiries(payload.inquiries);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '문의를 불러올 수 없습니다.');
    }
  }, [inquiryId]);

  useEffect(() => { void load(); }, [load]);

  async function submitInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const payload = await requestJson('/api/inquiries', { method: 'POST', body: JSON.stringify({ category, subject, body }) }) as { inquiryId: string };
      window.location.assign(`/support/${payload.inquiryId}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '문의를 등록할 수 없습니다.'); }
    finally { setBusy(false); }
  }

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!inquiryId) return; setBusy(true); setNotice(null);
    try {
      await requestJson(`/api/inquiries/${inquiryId}/replies`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply(''); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : '답변을 등록할 수 없습니다.'); }
    finally { setBusy(false); }
  }

  async function closeInquiry() {
    if (!inquiryId) return; setBusy(true); setNotice(null);
    try {
      await requestJson(`/api/inquiries/${inquiryId}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : '문의를 종료할 수 없습니다.'); }
    finally { setBusy(false); }
  }

  if (!inquiryId) {
    return <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4"><div><h1 className="text-2xl font-bold text-gray-900">문의 내역</h1><p className="mt-1 text-sm text-gray-600">등록한 문의의 진행 상태와 답변을 확인할 수 있습니다.</p></div>
        {notice ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{notice}</p> : null}
        {inquiries.length === 0 ? <Card><p className="text-sm text-gray-600">아직 등록한 문의가 없습니다.</p></Card> : inquiries.map((item) => <Link key={item.id} href={`/support/${item.id}`} className="block"><Card className="transition hover:border-blue-300"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-app-blue">{categoryLabels[item.category] ?? item.category}</p><h2 className="mt-1 font-semibold text-gray-900">{item.subject}</h2><p className="mt-2 text-xs text-gray-500">{dateText(item.updated_at ?? item.updatedAt ?? item.created_at ?? item.createdAt)}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{statusLabels[item.status]}</span></div></Card></Link>)}</section>
      <Card><h2 className="text-lg font-bold text-gray-900">새 문의</h2><form className="mt-4 space-y-4" onSubmit={submitInquiry}><label className="block space-y-2"><span className="text-xs font-semibold text-gray-700">유형</span><select className="h-11 w-full rounded-xl border border-app-border bg-white px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="general">서비스 이용</option><option value="account">계정</option><option value="consent">동의</option><option value="privacy">개인정보</option><option value="appeal">이의 제기</option></select></label><Field label="제목" value={subject} maxLength={160} required onChange={(event) => setSubject(event.target.value)} /><TextareaField label="내용" value={body} maxLength={10_000} required onChange={(event) => setBody(event.target.value)} /><Button className="w-full" type="submit" disabled={busy}>{busy ? '등록 중…' : '문의 등록'}</Button></form></Card>
    </main>;
  }

  return <main className="mx-auto max-w-3xl px-4 py-8"><Link href="/support" className="text-sm font-semibold text-app-blue">← 문의 내역</Link>{notice ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{notice}</p> : null}{inquiry ? <div className="mt-4 space-y-4"><Card><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-app-blue">{categoryLabels[inquiry.category] ?? inquiry.category}</p><h1 className="mt-1 text-2xl font-bold text-gray-900">{inquiry.subject}</h1><p className="mt-2 text-xs text-gray-500">{dateText(inquiry.createdAt)}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{statusLabels[inquiry.status]}</span></div><p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-gray-800">{inquiry.body}</p></Card>{inquiry.messages.map((message) => <Card key={message.id} className={message.authorKind === 'admin' ? 'border-blue-200 bg-blue-50' : ''}><p className="text-xs font-semibold text-gray-600">{message.authorKind === 'admin' ? '지원팀' : '나'} · {dateText(message.createdAt)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">{message.body}</p></Card>)}{inquiry.status !== 'closed' ? <Card><form className="space-y-4" onSubmit={submitReply}><TextareaField label="추가 내용" value={reply} maxLength={10_000} required onChange={(event) => setReply(event.target.value)} /><Button type="submit" disabled={busy}>{busy ? '등록 중…' : '내용 추가'}</Button></form></Card> : null}{inquiry.status === 'answered' ? <Button variant="outline" type="button" disabled={busy} onClick={closeInquiry}>문의 종료</Button> : null}</div> : <p className="mt-6 text-sm text-gray-600">문의 내용을 불러오는 중입니다.</p>}</main>;
}
