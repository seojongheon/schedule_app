'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ServiceRole } from '@/domain/authorization/capabilities';

type AdminSection = 'users' | 'rooms' | 'reports' | 'inquiries' | 'sanctions' | 'roles' | 'audit' | 'ip-blocks' | 'request-policies';
type Result = { rows: Array<Record<string, unknown>>; total: number; error?: string };
type Section = { id: AdminSection; label: string; endpoint: string; roles: ServiceRole[] };

const allRoles: ServiceRole[] = ['super_admin', 'operations_admin', 'support_admin', 'auditor'];
const operationsRoles: ServiceRole[] = ['super_admin', 'operations_admin', 'auditor'];
const sections: Section[] = [
  { id: 'users', label: '사용자', endpoint: '/api/admin/users', roles: allRoles },
  { id: 'rooms', label: '공간', endpoint: '/api/admin/rooms', roles: operationsRoles },
  { id: 'reports', label: '신고', endpoint: '/api/admin/reports', roles: operationsRoles },
  { id: 'inquiries', label: '문의', endpoint: '/api/admin/inquiries', roles: allRoles },
  { id: 'sanctions', label: '제재', endpoint: '/api/admin/sanctions', roles: operationsRoles },
  { id: 'roles', label: '관리 역할', endpoint: '/api/admin/roles', roles: ['super_admin'] },
  { id: 'audit', label: '감사 기록', endpoint: '/api/admin/audit', roles: allRoles },
  { id: 'ip-blocks', label: '접근 차단', endpoint: '/api/admin/ip-blocks', roles: operationsRoles },
  { id: 'request-policies', label: '요청 기준', endpoint: '/api/admin/ip-blocks/policy', roles: operationsRoles },
];

const roleLabels: Record<ServiceRole, string> = {
  super_admin: '총괄 관리자', operations_admin: '운영 관리자', support_admin: '지원 관리자', auditor: '감사 열람',
};

function labelFor(key: string) {
  const labels: Record<string, string> = {
    id: '식별자', displayName: '표시 이름', accountState: '계정 상태', name: '이름',
    restriction_state: '제한 상태', status: '상태', reason_code: '사유 코드',
    sanction_type: '제재 유형', starts_at: '시작', ends_at: '종료', event_type: '이벤트',
    result: '결과', occurred_at: '기록 시각', blocked_until: '차단 종료', source: '구분',
    action: '처리', policy: '정책', hard_limit: '차단 기준', soft_limit: '지연 기준', window_seconds: '구간(초)',
  };
  return labels[key] ?? key.replaceAll('_', ' ');
}

function valueFor(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return '세부 정보';
  return String(value);
}

async function mutate(url: string, method: 'POST' | 'PATCH', body: Record<string, unknown>) {
  const response = await fetch(url, {
    method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json() as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? '처리할 수 없습니다.');
}

export function AdminWorkspace({ roles }: { roles: ServiceRole[] }) {
  const visibleSections = sections.filter((item) => item.roles.some((role) => roles.includes(role)));
  const [section, setSection] = useState<AdminSection>(visibleSections[0]?.id ?? 'users');
  const [result, setResult] = useState<Result | null>(null);
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const selected = visibleSections.find((item) => item.id === section) ?? visibleSections[0];
  const canOperate = roles.some((role) => role === 'super_admin' || role === 'operations_admin');
  const canSupport = roles.some((role) => role === 'super_admin' || role === 'support_admin');
  const isSuper = roles.includes('super_admin');

  useEffect(() => {
    if (!selected) return;
    if (selected.id === 'users' && roles.includes('support_admin') && !roles.some((role) => role === 'super_admin' || role === 'operations_admin' || role === 'auditor') && query.trim().length < 2) {
      setResult({ rows: [], total: 0 });
      return;
    }
    let active = true;
    setResult(null);
    const endpoint = selected.id === 'users' && query.trim() ? `${selected.endpoint}?q=${encodeURIComponent(query.trim())}` : selected.endpoint;
    fetch(endpoint, { credentials: 'same-origin' })
      .then(async (response) => {
        const payload = await response.json() as Result & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? '목록을 불러올 수 없습니다.');
        return payload;
      })
      .then((payload) => active && setResult({ rows: payload.rows ?? [], total: payload.total ?? 0 }))
      .catch((error: unknown) => active && setResult({ rows: [], total: 0, error: error instanceof Error ? error.message : '목록을 불러올 수 없습니다.' }));
    return () => { active = false; };
  }, [query, reload, roles, selected]);

  async function perform(action: () => Promise<void>) {
    try {
      await action();
      setReload((value) => value + 1);
    } catch (error) {
      setResult((current) => ({ rows: current?.rows ?? [], total: current?.total ?? 0, error: error instanceof Error ? error.message : '처리할 수 없습니다.' }));
    }
  }

  function actionFor(row: Record<string, unknown>) {
    const id = String(row.id ?? '');
    if (section === 'users' && isSuper) {
      return <div className="flex gap-2"><button className="text-xs font-medium text-app-blue" onClick={() => void perform(async () => {
        const role = window.prompt('부여할 역할을 입력하세요: operations_admin, support_admin, auditor');
        const reason = window.prompt('역할 부여 사유를 입력하세요.');
        if (!role || !reason || !['operations_admin', 'support_admin', 'auditor'].includes(role)) return;
        await mutate(`/api/admin/users/${id}/roles`, 'PATCH', { operation: 'grant', role, reason });
      })}>역할 부여</button><button className="text-xs font-medium text-app-danger" onClick={() => void perform(async () => {
        const reason = window.prompt('계정 제한 사유를 입력하세요.');
        if (!reason) return;
        await mutate('/api/admin/sanctions', 'POST', { targetType: 'account', targetId: id, sanctionType: 'restrict', reason, endsAt: null });
      })}>제한 적용</button></div>;
    }
    if (section === 'rooms' && canOperate) return <button className="text-xs font-medium text-app-danger" onClick={() => void perform(async () => {
      const reason = window.prompt('공간 제한 사유를 입력하세요.');
      if (!reason) return;
      await mutate('/api/admin/sanctions', 'POST', { targetType: 'room', targetId: id, sanctionType: 'restrict', reason, endsAt: null });
    })}>제한 적용</button>;
    if (section === 'reports' && canOperate) return <button className="text-xs font-medium text-app-blue" onClick={() => void perform(async () => {
      const status = window.prompt('상태를 입력하세요: investigating, resolved, dismissed', 'investigating');
      const reasonCode = window.prompt('처리 사유 코드를 입력하세요.');
      if (!status || !reasonCode || !['investigating', 'resolved', 'dismissed'].includes(status)) return;
      await mutate(`/api/admin/reports/${id}`, 'PATCH', { status, reasonCode });
    })}>신고 처리</button>;
    if (section === 'inquiries' && canSupport) return <div className="flex gap-2">
      {row.status !== 'closed' ? <button className="text-xs font-medium text-app-blue" onClick={() => void perform(() => mutate(`/api/inquiries/${id}/claim`, 'POST', {}))}>문의 배정</button> : null}
      <Link className="text-xs font-medium text-app-blue underline" href={`/support/${encodeURIComponent(id)}`}>문의 처리</Link>
    </div>;
    if (section === 'sanctions' && canOperate && !row.released_at) return <button className="text-xs font-medium text-app-blue" onClick={() => void perform(async () => {
      const reason = window.prompt('제재 해제 사유를 입력하세요.');
      if (!reason) return;
      await mutate(`/api/admin/sanctions/${id}/release`, 'POST', { reason });
    })}>제재 해제</button>;
    if (section === 'ip-blocks' && canOperate && row.record_type === 'block' && row.status === 'active') return <button className="text-xs font-medium text-app-blue" onClick={() => void perform(async () => {
      const reason = window.prompt('차단 해제 사유를 입력하세요.');
      if (!reason) return;
      await mutate(`/api/admin/ip-blocks/${id}/release`, 'POST', { reason });
    })}>차단 해제</button>;
    if (section === 'request-policies' && canOperate) return <button className="text-xs font-medium text-app-blue" onClick={() => void perform(async () => {
      const numberValue = (key: string) => Number(window.prompt(`${labelFor(key)} 값을 입력하세요.`, String(row[key] ?? '')));
      const reason = window.prompt('기준 조정 사유를 입력하세요.');
      if (!reason) return;
      await mutate('/api/admin/ip-blocks/policy', 'PATCH', {
        policy: row.policy, windowSeconds: numberValue('window_seconds'), softLimit: numberValue('soft_limit'), hardLimit: numberValue('hard_limit'),
        repeatedExcessLimit: numberValue('repeated_excess_limit'), repeatedExcessWindowSeconds: numberValue('repeated_excess_window_seconds'),
        blockSeconds: numberValue('block_seconds'), delayMinMs: numberValue('delay_min_ms'), delayMaxMs: numberValue('delay_max_ms'), reason,
      });
    })}>기준 조정</button>;
    return null;
  }

  if (!selected) return <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6"><section className="w-full rounded-app border border-app-border bg-white p-10 shadow-soft"><p className="text-sm text-app-muted">운영 관리</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">접근 권한이 없습니다</h1><p className="mt-3 text-sm leading-6 text-app-muted">현재 계정에는 운영 관리 역할이 배정되지 않았습니다.</p></section></main>;

  const columns = result?.rows[0] ? Object.keys(result.rows[0]).filter((column) => column !== 'record_type') : [];
  const hasActions = result?.rows.some((row) => actionFor(row) !== null) ?? false;
  return <main className="min-h-screen bg-app-background px-6 py-8 text-slate-900"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex items-start justify-between gap-6 rounded-app border border-app-border bg-white px-7 py-6 shadow-soft"><div><p className="text-sm text-app-muted">운영 관리</p><h1 className="mt-1 text-2xl font-semibold">서비스 운영 현황</h1><p className="mt-2 text-sm text-app-muted">권한 범위 안에서 사용자·공간·보안 운영 기록을 확인합니다.</p></div><div className="flex max-w-sm flex-wrap justify-end gap-2">{roles.map((role) => <span key={role} className="rounded-full bg-app-blueSoft px-3 py-1 text-xs font-medium text-app-blue">{roleLabels[role]}</span>)}</div></header>
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]"><nav aria-label="관리 메뉴" className="rounded-app border border-app-border bg-white p-3 shadow-soft">{visibleSections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`mb-1 w-full rounded-xl px-4 py-3 text-left text-sm transition ${section === item.id ? 'bg-app-blue text-white' : 'text-slate-700 hover:bg-app-blueSoft'}`}>{item.label}</button>)}</nav>
      <section className="overflow-hidden rounded-app border border-app-border bg-white shadow-soft"><div className="flex items-center justify-between gap-4 border-b border-app-border px-7 py-5"><div><h2 className="text-lg font-semibold">{selected.label}</h2><p className="mt-1 text-sm text-app-muted">표시 가능한 운영 정보와 승인된 처리만 제공합니다.</p></div>{section === 'users' && roles.includes('support_admin') ? <input aria-label="사용자 이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 2자 이상" className="rounded-lg border border-app-border px-3 py-2 text-sm" /> : <span className="text-sm text-app-muted">{result?.total ?? '…'}건</span>}</div>
        {result?.error ? <p className="p-7 text-sm text-app-danger">{result.error}</p> : !result ? <p className="p-7 text-sm text-app-muted">목록을 불러오는 중입니다.</p> : result.rows.length === 0 ? <p className="p-7 text-sm text-app-muted">표시할 항목이 없습니다.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-medium text-app-muted"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-5 py-3">{labelFor(column)}</th>)}{hasActions ? <th className="px-5 py-3">관리</th> : null}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-app-border">{columns.map((column) => <td key={column} className="max-w-64 truncate px-5 py-4 text-slate-700">{valueFor(row[column])}</td>)}{hasActions ? <td className="whitespace-nowrap px-5 py-4">{actionFor(row)}</td> : null}</tr>)}</tbody></table></div>}
      </section></div>
  </div></main>;
}
