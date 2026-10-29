'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { sessions } from '../../lib/workshop.js';

const RETRY = '일시적으로 요청을 처리하지 못했습니다. 다시 시도해주세요.';
async function checkTicket(ticket, outage) {
  try {
    const response = await fetch('/api/ticket', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, outage, delayMs: 0 }),
    });
    if (response.status === 400) return { kind: 'format', message: '올바른 티켓 형식이 아닙니다.' };
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return { kind: 'unavailable', message: RETRY };
    }
    const result = await response.json();
    if (typeof result.accepted !== 'boolean') return { kind: 'unavailable', message: RETRY };
    return result.accepted
      ? { kind: 'accepted', message: '티켓이 확인되었습니다.' }
      : { kind: 'unknown', message: '등록되지 않은 티켓입니다.' };
  } catch { return { kind: 'unavailable', message: RETRY }; }
}

export default function InputContract() {
  const { version } = useParams();
  const fixed = version === 'fixed';
  const [ticket, setTicket] = useState('한글티켓');
  const [outage, setOutage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState('');
  const matches = sessions.filter(item => `${item.title} ${item.category}`.toLowerCase().includes(applied.toLowerCase()));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setResult(null);
    try {
      if (fixed) { setResult(await checkTicket(ticket, outage)); return; }
      const response = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Demo-Ticket': ticket },
        body: JSON.stringify({ ticket, outage, delayMs: 0 }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setResult(data.accepted
        ? { kind: 'accepted', message: '티켓이 확인되었습니다.' }
        : { kind: 'format', message: '영문 대문자와 숫자 7자로 입력해주세요.' });
    } catch (error) { setResult({ kind: 'raw', message: error.message }); }
    finally { setBusy(false); }
  }
  function clearSearch() { setDraft(''); if (fixed) setApplied(''); }
  return <>
    <p className="eyebrow">03 / INPUT CONTRACT / {fixed ? 'FIXED' : 'BROKEN'}</p>
    <h1>입력 오류와 통신 오류를 구분하기</h1>
    <p>한글티켓 → NOENTRY → TICKET7 순서로 확인하고, 502 응답도 비교하세요.</p>
    <form onSubmit={submit}>
      <label htmlFor="ticket">워크숍 티켓</label>
      <input id="ticket" value={ticket} disabled={busy} onChange={event => { setTicket(event.target.value); setResult(null); }} autoComplete="off" spellCheck="false" />
      <label><input type="checkbox" checked={outage} disabled={busy} onChange={event => setOutage(event.target.checked)} /> 502 HTML 응답 재현</label>
      <button disabled={busy} type="submit">티켓 확인</button>
    </form>
    {result && <p role={result.kind === 'accepted' ? 'status' : 'alert'} data-testid="result" data-kind={result.kind}>{result.message}</p>}
    <hr /><h2>별도 실험: 공개 워크숍 검색</h2>
    <p>티켓 검증과 독립된 공개 샘플입니다. 없는 단어를 검색한 뒤 입력을 비워보세요.</p>
    <form onSubmit={event => { event.preventDefault(); setApplied(draft.trim()); }}>
      <label htmlFor="search">이름·카테고리 검색</label>
      <input id="search" value={draft} onChange={event => { const value = event.target.value; setDraft(value); if (fixed && !value.trim()) setApplied(''); }} />
      <div className="actions"><button type="submit">검색</button><button type="button" onClick={clearSearch}>검색어 지우기</button></div>
    </form>
    <p data-testid="applied">적용된 검색어: {applied || '(없음)'}</p>
    <section aria-label="검색 결과" className="list">{matches.length ? matches.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.category}</p></article>) : <p>검색 결과가 없습니다.</p>}</section>
  </>;
}
