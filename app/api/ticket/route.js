import { accepts, delay, isTicket } from '../../../lib/workshop.js';
export async function POST(request) {
  const { ticket, delayMs = 900, outage = false } = await request.json();
  await delay(Math.min(2000, Math.max(0, Number(delayMs) || 0)));
  if (outage) return new Response('<!doctype html><h1>Gateway unavailable</h1>', { status: 502, headers: { 'Content-Type': 'text/html' } });
  if (!isTicket(ticket)) return Response.json({ message: '올바른 티켓 형식이 아닙니다.' }, { status: 400 });
  return Response.json({ accepted: accepts(ticket) });
}
