'use client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const STORAGE = 'demo-workshop-ticket';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function TicketDialog({ children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} aria-label="워크숍 티켓" onCancel={event => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}

function Experiment({ fixed, screen }) {
  const router = useRouter();
  const [open, setOpen] = useState(!screen);
  const [draft, setDraft] = useState('TICKET7');
  const [phase, setPhase] = useState('editing');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('');
  const [items, setItems] = useState(null);
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  const controller = useRef(null);

  function invalidate() {
    epoch.current += 1;
    controller.current?.abort();
  }
  function reset() {
    if (fixed) invalidate();
    setPhase('editing'); setBusy(false); setMessage('');
  }
  function close() { reset(); setOpen(false); }
  function choosePublic() {
    reset(); setOpen(false);
    if (fixed) router.push('/fixed/open');
    else setView('open');
  }
  async function verify(ticket, restoring = false) {
    if (fixed) invalidate();
    const mine = epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    const current = () => !fixed || mine === epoch.current;
    setBusy(true); setPhase('checking'); setMessage(''); setItems(null);
    try {
      const response = await fetch('/api/ticket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, delayMs: 900 }), signal: abort.signal,
      });
      if (!response.ok) throw new Error('티켓 확인을 완료하지 못했습니다.');
      const result = await response.json();
      if (!current()) return;
      setPhase('processing');
      // Simulate work that is not cancelled by AbortController.
      await pause(600);
      if (!current()) return;
      if (!result.accepted) {
        setPhase('invalid'); setMessage('등록되지 않은 티켓입니다.'); return;
      }
      if (fixed && !restoring) {
        sessionStorage.setItem(STORAGE, ticket);
        router.push('/fixed/ticket');
        return;
      }
      const listResponse = await fetch('/api/sessions', {
        headers: { 'X-Demo-Ticket': ticket }, signal: abort.signal,
      });
      if (!listResponse.ok) throw new Error('워크숍을 불러오지 못했습니다.');
      const list = await listResponse.json();
      if (!current()) return;
      setItems(list); setPhase('approved'); setView('ticket'); setOpen(false);
    } catch (error) {
      if (!current() || error.name === 'AbortError') return;
      setPhase('failed'); setMessage('요청을 완료하지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (current()) setBusy(false);
    }
  }
  useEffect(() => {
    if (fixed && screen === 'ticket') {
      try {
        const saved = sessionStorage.getItem(STORAGE);
        if (saved) void verify(saved, true);
        else { setPhase('invalid'); setMessage('티켓을 다시 입력해주세요.'); }
      } catch { setPhase('failed'); setMessage('저장된 티켓을 읽지 못했습니다.'); }
    }
    return () => { if (fixed) invalidate(); };
    // This keyed component mounts again for each pathname.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (screen === 'sign-in-error') return <><h1>로그인 요청을 완료하지 못했습니다.</h1><Link href={fixed ? '/fixed' : '/broken'}>실험 홈</Link></>;
  const publicView = fixed ? screen === 'open' : view === 'open';
  const ticketView = fixed ? screen === 'ticket' && phase === 'approved' : view === 'ticket';
  return <>
    <p className="eyebrow">02 / REQUEST LIFECYCLE / {fixed ? 'FIXED' : 'BROKEN'}</p>
    <h1>닫은 폼의 응답은 누구의 것일까?</h1>
    <p>900ms 서버 응답 + 600ms 후처리 사이에 입력을 바꾸거나 닫아보세요.</p>
    <div className="actions"><button onClick={() => { reset(); setOpen(true); }}>티켓 입력</button><Link href={fixed ? '/fixed/sign-in-error' : '/broken/sign-in-error'}>로그인 오류 화면</Link></div>
    <p data-testid="phase">상태: {phase}</p><p data-testid="busy">처리 중: {String(busy)}</p>
    {publicView && <section data-testid="public-list"><h2>공개 워크숍</h2><article>Open sketching</article></section>}
    {ticketView && <section data-testid="ticket-list"><h2>예약할 워크숍</h2>{items?.length ? items.map(item => <article key={item.id}>{item.title}</article>) : <p>예약할 워크숍이 없습니다.</p>}</section>}
    {!open && message && <p role="alert">{message}</p>}
    {open && <TicketDialog onClose={close}>
      <form onSubmit={event => { event.preventDefault(); void verify(draft); }}>
        <h2>워크숍 티켓</h2><p>제공받은 티켓이 있다면 입력하세요.</p>
        <label htmlFor="ticket">티켓<input id="ticket" value={draft} onChange={event => { reset(); setDraft(event.target.value); }} autoComplete="off" /></label>
        {message && <p role="alert">{message}</p>}
        <p data-testid="dialog-phase">상태: {phase}</p>
        <div className="actions"><button disabled={busy} type="submit">티켓 확인</button><button type="button" onClick={choosePublic}>공개 워크숍 보기</button><button type="button" onClick={close}>닫기</button></div>
      </form>
    </TicketDialog>}
  </>;
}
export default function LifecyclePage() {
  const { version, screen } = useParams();
  const path = usePathname();
  return <Experiment key={path} fixed={version === 'fixed'} screen={screen?.[0] ?? ''} />;
}
