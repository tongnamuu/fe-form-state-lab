import './style.css';
export const metadata = { title: 'Form State Lab', description: 'Small, intentionally broken and repaired form experiments.' };
export default function Layout({ children }) {
  return <html lang="ko"><body><header><a href="/">FORM STATE LAB</a><span>가상의 워크숍 · 학습용 데이터</span></header><main>{children}</main></body></html>;
}
