'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function WorkshopList({ ticket }) {
  const [result, setResult] = useState({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    fetch('/api/sessions', { headers: { 'X-Demo-Ticket': ticket } })
      .then(async response => {
        if (!response.ok) throw new Error('목록 요청이 거절되었습니다.');
        return response.json();
      })
      .then(items => { if (active) setResult({ kind: 'ready', items }); })
      .catch(error => { if (active) setResult({ kind: 'error', message: error.message }); });
    return () => { active = false; };
  }, [ticket]);
  return <section data-testid="workshop-list"><h2>예약할 워크숍</h2>
    <label>워크숍 검색<input placeholder="아직 나오면 안 되는 검색 폼" /></label>
    {result.kind === 'loading' && <p>목록을 불러오는 중</p>}
    {result.kind === 'error' && <p role="alert">{result.message}</p>}
    {result.kind === 'ready' && (result.items.length ? <div className="list">{result.items.map(item => <article key={item.id}>{item.title}</article>)}</div> : <p role="status">예약할 워크숍이 없습니다.</p>)}
  </section>;
}

export default function RenderGate() {
  const { version } = useParams();
  const fixed = version === 'fixed';
  const [draft, setDraft] = useState('NOENTRY');
  const [submitted, setSubmitted] = useState('');
  const [phase, setPhase] = useState('editing');
  const [message, setMessage] = useState('');
  // The broken branch mistakes "submitted" for "approved".
  const showList = fixed ? phase === 'approved' : Boolean(submitted) && phase !== 'invalid' && phase !== 'failed';
  async function submit(event) {
    event.preventDefault();
    setSubmitted(draft);
    setPhase('checking');
    setMessage('');
    try {
      const response = await fetch('/api/ticket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: draft }),
      });
      if (!response.ok) throw new Error('티켓 확인 요청을 처리하지 못했습니다.');
      const result = await response.json();
      setPhase(result.accepted ? 'approved' : 'invalid');
      if (!result.accepted) setMessage('등록되지 않은 티켓입니다.');
    } catch (error) {
      setPhase('failed'); setMessage(error.message);
    }
  }
  return <>
    <p className="eyebrow">01 / RENDER GATE / {fixed ? 'FIXED' : 'BROKEN'}</p>
    <h1>제출한 순간, 열어도 될까?</h1>
    <p>NOENTRY를 제출하면 900ms 뒤 거절됩니다. 그 사이 검색 폼과 목록 요청을 관찰하세요.</p>
    <form onSubmit={submit}><label htmlFor="ticket">워크숍 티켓</label><input id="ticket" value={draft} disabled={phase === 'checking'} onChange={event => { setDraft(event.target.value); setSubmitted(''); setPhase('editing'); setMessage(''); }} autoComplete="off" /><button type="submit" disabled={phase === 'checking'}>티켓 확인</button></form>
    <p className="status" data-testid="phase">상태: {phase}</p>
    {message && <p role="alert">{message}</p>}
    {showList && <WorkshopList ticket={submitted} />}
    <footer>성공: TICKET7 · 유효한 빈 목록: EMPTY77 · 실패: NOENTRY</footer>
  </>;
}
