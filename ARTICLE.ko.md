# Next.js 폼 검증 중 목록이 잠깐 보이는 이유: 제출과 승인을 분리하기

잘못된 값을 제출했는데 검색 폼과 목록이 잠깐 보였다가 사라진다. 마지막 화면에는 오류 메시지가 제대로 표시되므로, 제출 후 최종 화면만 검사하는 테스트는 이 문제를 놓치기 쉽다.

이 글에서는 실제 서비스와 무관하게 새로 만든 가상의 워크숍 예약 화면으로 문제를 재현한다. 예제의 티켓과 워크숍은 모두 공개된 학습용 데이터다.

[실행 가능한 전체 예제 · topic/01-render-gate](https://github.com/tongnamuu/fe-form-state-lab/tree/topic/01-render-gate)

## 재현 환경과 순서

프로젝트의 `topic/01-render-gate` 브랜치를 사용한다. Node 24.13.1, Next.js 15.5.12, React 19.1.0, Playwright 1.58.2에서 확인했다. 버전은 실험 환경을 고정하기 위한 정보다.

```sh
git clone https://github.com/tongnamuu/fe-form-state-lab.git
cd fe-form-state-lab
git switch topic/01-render-gate
npm install
npm run dev
```

1. `http://127.0.0.1:3193/broken`을 연다.
2. 기본값 `NOENTRY`를 그대로 두고 **티켓 확인**을 누른다.
3. 서버의 검증 응답을 기다리는 약 900ms 동안 **예약할 워크숍**과 검색 입력창이 나타난다.
4. 검증이 끝나면 목록 영역이 사라지고 **등록되지 않은 티켓입니다.**가 표시된다.
5. `/fixed`에서 반복하면 검증 중에도 목록 영역이 나타나지 않는다.

Network 탭도 함께 보면 `/broken`에서는 검증 완료 전에 `/api/sessions` 요청이 발생한다. 서버는 미등록 티켓의 목록 요청을 403으로 거절한다. 실제 데이터가 노출되지 않아도, UI가 잘못 열리고 불필요한 요청이 발생하는 버그는 남는다.

## 원인은 제출을 승인으로 취급한 조건이다

문제를 만드는 핵심은 다음 조건이다. `submitted`는 사용자가 제출했다는 뜻인데, 화면은 그것을 목록을 열어도 된다는 뜻으로 해석한다.

```jsx
const showList = Boolean(submitted)
  && phase !== 'invalid'
  && phase !== 'failed';

async function submit(event) {
  event.preventDefault();
  setSubmitted(draft);
  setPhase('checking');

  const response = await fetch('/api/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: draft }),
  });
  const result = await response.json();
  setPhase(result.accepted ? 'approved' : 'invalid');
}
```

`submitted`에 값이 있고 `phase`가 `checking`이면 위 조건은 참이다. 검증 결과를 기다리는 렌더에서도 목록이 만들어진다. 목록 컴포넌트 안의 Effect는 마운트에 반응해 데이터를 요청한다.

React의 상태 업데이트는 다음 렌더를 요청한다. 이벤트 핸들러와 렌더는 해당 시점의 상태 스냅샷을 사용한다. 따라서 함수 안에 검증 코드가 있다는 사실만으로 검증 전 렌더가 차단되지는 않는다. [React: State as a Snapshot](https://react.dev/learn/state-as-a-snapshot)

이 실험의 원인은 Next.js가 임의의 폼을 끼워 넣거나 hydration이 무조건 실패해서가 아니다. 애플리케이션이 `checking` 상태에도 목록 렌더를 허용한 것이다. 개발 모드의 Strict Mode는 Effect 실행 횟수에 영향을 줄 수 있지만, 이 잘못된 조건은 production 빌드에도 남는다.

## 승인 상태에서만 목록을 만든다

수정 예제는 목록을 열 수 있는 상태를 하나로 제한한다.

```jsx
const showList = phase === 'approved';

return (
  <>
    <TicketForm />
    {phase === 'checking' && <p>티켓을 확인하는 중입니다.</p>}
    {message && <p role="alert">{message}</p>}
    {showList && <WorkshopList ticket={submitted} />}
  </>
);
```

위 코드는 렌더 조건을 설명하는 발췌다. 실행 가능한 브랜치에는 폼, API, 오류 처리와 목록 컴포넌트가 모두 포함되어 있다.

상태 전이는 `editing → checking → approved | invalid | failed`다. `invalid`는 검증 결과가 거절된 경우이고, `failed`는 요청 자체를 정상 처리하지 못한 경우다. 목록을 먼저 만든 다음 Effect에서 숨기는 방식은 중간 렌더를 허용한다. 별도의 표시 상태를 Effect로 동기화하기보다 현재 검증 상태에서 표시 여부를 계산하면 이런 불일치를 줄일 수 있다. [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

여기서 목록의 길이는 검증 결과가 아니다. `EMPTY77`은 승인되지만 워크숍이 없는 티켓이다. 이때는 **예약할 워크숍이 없습니다.**를 보여준다. 빈 배열을 잘못된 티켓으로 취급하면 유효한 빈 결과와 권한 오류가 섞인다.

## 테스트는 응답을 붙잡고 중간 화면을 검사한다

고정된 시간만 기다리는 테스트는 빠른 컴퓨터에서 문제를 놓칠 수 있다. 예제 테스트는 Playwright로 검증 응답을 보류한 뒤, 그 동안의 DOM과 목록 요청을 확인한다.

```js
let release;
const held = new Promise(resolve => { release = resolve; });

await page.route('**/api/ticket', async route => {
  await held;
  await route.fulfill({ json: { accepted: false } });
});

await page.goto('/fixed');
await page.getByRole('button', { name: '티켓 확인' }).click();
await expect(page.getByTestId('phase')).toHaveText('상태: checking');
await expect(page.getByTestId('workshop-list')).toHaveCount(0);
release();
```

전체 테스트에는 MutationObserver로 목록이 한 번이라도 만들어졌는지 기록하는 검사와 `/api/sessions` 요청 수 검사도 있다. `/broken`에서는 노출과 조기 요청이 발생해야 통과하고, `/fixed`에서는 둘 다 없어야 통과한다. 버그를 관찰하는 테스트와 수정을 검증하는 테스트를 같은 입력으로 비교하는 것이다.

```sh
npx playwright install chromium
npm test
npm run build
npm start
```

검사 항목은 중간 렌더 비교 2개, 실제 API를 통한 성공·빈 결과 2개, 서버의 직접 요청 거절 1개다. 개발 모드의 Effect 재실행을 고려해 잘못된 요청의 정확한 횟수 대신 발생 여부를 검사한다.

클라이언트의 렌더 조건은 사용자 경험을 위한 장치다. 서버는 목록 요청마다 티켓을 다시 검사해야 한다. 예제 역시 클라이언트 화면을 건너뛰고 직접 요청해도 미등록 티켓을 거절한다.
