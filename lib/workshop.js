export const sessions = [
  { id: 'paper', title: 'Paper circuits', category: 'Electronics' },
  { id: 'clay', title: 'Clay animation', category: 'Animation' },
];
export function isTicket(value) { return typeof value === 'string' && /^[A-Z0-9]{7}$/.test(value); }
export function accepts(value) { return value === 'TICKET7' || value === 'EMPTY77'; }
export function ticketSessions(value) { return value === 'EMPTY77' ? [] : sessions; }
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
