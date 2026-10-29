import { accepts, ticketSessions } from '../../../lib/workshop.js';
export async function GET(request) {
  const ticket = request.headers.get('X-Demo-Ticket');
  if (!accepts(ticket)) return Response.json({ message: '티켓을 확인해주세요.' }, { status: 403 });
  return Response.json(ticketSessions(ticket));
}
