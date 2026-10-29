import Link from 'next/link';
export default function Page() {
  return <><p className="eyebrow">REPRODUCIBLE FRONTEND EXPERIMENTS</p><h1>작은 폼에서 시작하는<br />상태 디버깅</h1><p>각 주제 브랜치에서 같은 동작의 실패 버전과 수정 버전을 비교합니다.</p><nav><Link href="/broken">문제 버전</Link><Link href="/fixed">수정 버전</Link></nav><p>실제 서비스의 코드나 데이터 없이 새로 작성한 교육용 프로젝트입니다.</p></>;
}
