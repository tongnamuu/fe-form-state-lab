# Form State Lab

실제 서비스 소스와 데이터 없이 새로 만든 Next.js 재현 프로젝트입니다. 가상 워크숍 티켓만 사용합니다.

| 브랜치 | 실험 |
| --- | --- |
| `topic/01-render-gate` | 검증 전 컴포넌트 노출과 조기 요청 |
| `topic/02-request-lifecycle` | 늦은 응답, 닫기, URL과 새로고침 |
| `topic/03-input-contract` | Unicode 헤더, 오류 분류, 검색 입력 초기화 |

각 브랜치에는 독립 실행 가능한 코드와 `ARTICLE.ko.md`가 있습니다. `/broken`과 `/fixed`를 비교하세요.

```sh
git clone https://github.com/tongnamuu/fe-form-state-lab.git
cd fe-form-state-lab
git switch topic/01-render-gate
npm install
npm run dev
# http://127.0.0.1:3193
```

테스트: `npx playwright install chromium` 후 `npm test`. 운영 빌드 재현: `npm run build && npm start`.

검증 버전: Node 24.13.1, Next.js 15.5.12, React 19.1.0, Playwright 1.58.2. package.json의 버전은 재현 당시 환경이며 최신 운영 버전 권장이라는 뜻은 아닙니다.

`TICKET7`은 목록이 있는 티켓, `EMPTY77`은 유효하지만 목록이 빈 티켓, `NOENTRY`는 미등록 티켓입니다. 모두 공개된 학습용 값입니다. 실제 인증·권한 모델을 구현한 예제가 아니며 외부 API·DB·환경변수는 필요하지 않습니다. 개발 서버는 루프백 주소에만 바인딩합니다.

비밀값, 다른 저장소의 파일·이력, 운영 데이터, node_modules 및 빌드 결과물은 배포 대상에 포함하지 않습니다.

## 검증 결과

- `topic/01-render-gate`: Playwright 5개 통과, production build 통과.
- `topic/02-request-lifecycle`: Playwright 9개 통과, production build 통과.
- `topic/03-input-contract`: Playwright 17개 통과, production build 통과.

각 테스트에는 의도적으로 잘못된 동작을 관찰하는 `/broken` 검사와 수정된 `/fixed` 검사가 함께 포함됩니다. 테스트가 통과한다는 말이 `/broken` 화면이 올바르다는 뜻은 아닙니다.

직접 의존성 버전은 고정했지만 lockfile은 포함하지 않았습니다. 전이 의존성까지 동일한 바이트로 재현하는 환경은 아니며, 브라우저별 오류 문구도 달라질 수 있습니다.

## 읽을거리

1. [Next.js 폼 검증 중 목록이 잠깐 보이는 이유](https://concretecode.dev/post/6) — [실험 브랜치](https://github.com/tongnamuu/fe-form-state-lab/tree/topic/01-render-gate)
2. [닫은 모달이 늦은 응답으로 다시 움직일 때](https://concretecode.dev/post/7) — [실험 브랜치](https://github.com/tongnamuu/fe-form-state-lab/tree/topic/02-request-lifecycle)
3. [한글 입력이 fetch를 깨뜨릴 때](https://concretecode.dev/post/8) — [실험 브랜치](https://github.com/tongnamuu/fe-form-state-lab/tree/topic/03-input-contract)
