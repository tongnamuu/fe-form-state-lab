# 닫은 모달이 늦은 응답으로 다시 움직일 때: 요청 수명과 새로고침 설계

모달을 닫는 것은 화면에서 창 하나를 지우는 동작처럼 보인다. 하지만 폼을 제출한 뒤 닫았다면 아직 완료되지 않은 요청도 남아 있다. 그 요청이 나중에 성공하면, 이미 취소한 선택을 저장하거나 다른 화면으로 이동시킬 수 있다.

이번 실험은 가상의 워크숍 티켓 화면이다. 입력 수정, 닫기, 공개 목록 선택을 요청의 수명이 끝나는 사건으로 취급하고, 새로고침은 URL별로 다른 계약을 갖도록 만든다. 실제 서비스의 코드나 데이터는 사용하지 않았다.

[실행 가능한 전체 예제 · topic/02-request-lifecycle](https://github.com/tongnamuu/fe-form-state-lab/tree/topic/02-request-lifecycle)

## 직접 재현하기

`topic/02-request-lifecycle` 브랜치에는 수정 전후 화면과 테스트가 함께 들어 있다. 실행 환경은 Node 24.13.1, Next.js 15.5.12, React 19.1.0, Playwright 1.58.2다.

```sh
git clone https://github.com/tongnamuu/fe-form-state-lab.git
cd fe-form-state-lab
git switch topic/02-request-lifecycle
npm install
npm run dev
```

`http://127.0.0.1:3193/broken`에서 `TICKET7`을 제출하고 **닫기**를 누른다. 서버 응답에 900ms, 응답 후 가상의 후처리에 600ms를 넣었으므로 닫을 시간이 있다. 수정 전 화면은 닫은 뒤에도 **예약할 워크숍**을 표시한다. `/fixed`에서는 같은 응답이 도착해도 닫힌 화면을 바꾸지 않는다.

후처리 지연은 요청 취소만으로 해결되지 않는 경우를 관찰하기 위한 장치다. 실제 앱에서는 응답 변환, 별도의 비동기 작업, 후속 요청 등이 이 위치에 올 수 있다.

## 요청에 세대 번호를 붙인다

수정 예제는 요청을 시작할 때의 번호와 현재 번호가 같은지 검사한다. 입력 수정, 모달 닫기, 공개 목록 선택, 컴포넌트 해제 시 번호를 증가시켜 이전 작업을 무효화한다.

```js
const epoch = useRef(0);
const controller = useRef(null);

function invalidate() {
  epoch.current += 1;
  controller.current?.abort();
}

async function verify(ticket) {
  invalidate();
  const mine = epoch.current;
  const abort = new AbortController();
  controller.current = abort;
  const current = () => mine === epoch.current;

  setBusy(true);
  try {
    const response = await fetch('/api/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
      signal: abort.signal,
    });
    if (!response.ok) throw new Error('Request failed');
    const result = await response.json();
    if (!current()) return;

    await finishProcessing(result);
    if (!current()) return;
    applyResult(result);
  } catch (error) {
    if (!current() || error.name === 'AbortError') return;
    showRetryMessage();
  } finally {
    if (current()) setBusy(false);
  }
}
```

위 코드는 요청 소유권을 설명하는 발췌다. 브랜치의 실행 코드에는 각 함수와 UI가 포함되어 있다. 핵심은 상태 변경 직전의 `current()`다. 오래된 요청은 성공 결과뿐 아니라 오류 메시지와 로딩 상태도 변경하면 안 된다.

특히 `finally`를 놓치기 쉽다. 첫 번째 요청을 취소하고 두 번째 요청을 시작했는데, 첫 번째 요청의 `finally`가 `setBusy(false)`를 실행하면 두 번째 요청이 진행 중이어도 버튼이 다시 활성화된다.

AbortController는 불필요한 네트워크 작업을 줄이는 데 도움이 된다. 그러나 이미 파싱한 응답을 넘겨받은 임의의 비동기 후처리까지 자동으로 취소하지는 않는다. 예제는 후처리가 끝난 뒤에도 요청 번호를 확인한다. React 공식 문서도 응답 순서가 요청 순서와 다를 수 있으므로 오래된 결과를 무시하는 정리를 설명한다. [React: useEffect의 데이터 요청과 정리](https://react.dev/reference/react/useEffect#fetching-data-with-effects)

## 모달 상태와 방문한 화면을 분리한다

모든 선택을 `useState` 하나에만 저장하면 새로고침 후 초기 상태로 돌아간다. 반대로 모달을 닫았다는 사실까지 영구 저장하면 처음 선택 화면으로 돌아왔을 때도 창이 열리지 않는다.

이 예제는 다음 계약을 정했다.

| 주소 | 의미 | 새로고침 결과 |
| --- | --- | --- |
| `/fixed` | 아직 열람 방법을 선택하지 않은 화면 | 선택 모달 표시 |
| `/fixed/open` | 공개 워크숍을 선택한 화면 | 공개 목록 유지 |
| `/fixed/ticket` | 티켓으로 열람하는 화면 | 저장된 티켓 재검증 후 목록 표시 |
| `/fixed/sign-in-error` | 로그인 오류 안내 | 선택 모달 없음 |

따라서 `/fixed`에서 창만 닫고 새로고침하면 모달이 다시 열린다. **공개 워크숍 보기**를 누르면 `/fixed/open`으로 이동하므로, 새로고침해도 공개 목록이 유지된다. 이 동작은 모든 서비스에 적용되는 정답이 아니라 예제가 선택한 사용자 경험이다.

티켓 문자열은 URL에 넣지 않는다. 이 학습용 예제에서는 공개된 가짜 티켓을 `sessionStorage`에 저장하고 `/fixed/ticket`에서 서버에 다시 검증한다. sessionStorage는 탭의 페이지 세션에 속하며 새로고침에도 유지된다. [MDN: sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)

저장된 값은 권한 증거가 아니다. 저장값이 없거나 거절되면 목록을 만들지 않으며, 서버의 목록 API도 티켓을 다시 검사한다. 실제 민감한 토큰의 보관 방식은 별도의 보안 설계가 필요하다. 이 예제의 공개 티켓 저장 방식을 그대로 인증 모델로 사용하지는 않는다.

로그인 오류 화면에는 열람 모달을 렌더하지 않는다. 공통 레이아웃에 모달을 무조건 두면 오류 안내까지 가리는 일이 생길 수 있다. 어떤 경로가 모달의 소유자인지를 명시해야 한다.

## 시간보다 순서를 통제하는 테스트

자동 테스트는 서버 응답을 보류하거나 Playwright 시계를 조절한다. 예를 들어 응답 파싱 후 `processing` 상태에 도달한 것을 확인한 다음 모달을 닫고, 후처리 타이머를 진행한다.

```js
await page.clock.install();
await page.route('**/api/ticket', route =>
  route.fulfill({ json: { accepted: true } })
);
await page.goto('/fixed');
await page.getByRole('button', { name: '티켓 확인' }).click();
await expect(page.getByTestId('dialog-phase'))
  .toHaveText('상태: processing');
await page.getByRole('button', { name: '닫기', exact: true }).click();
await page.clock.runFor(700);
await expect(page.getByTestId('ticket-list')).toHaveCount(0);
```

수정 전 화면에도 같은 순서를 적용하면 목록이 나타난다. 이 비교는 단순히 요청을 빨리 취소해서 운 좋게 문제가 숨겨진 것은 아닌지 확인한다.

9개 테스트는 닫기 전후 비교, 공개 선택 후 새로고침, 오래된 finally의 로딩 상태 변경, 공개 경로 이동 중 늦은 응답, 티켓 경로 재검증, 저장값 없는 직접 접근, 로그인 오류 화면을 다룬다.

```sh
npx playwright install chromium
npm test
npm run build
npm start
```

폼의 수명은 제출 버튼을 누를 때 시작해서 응답이 도착할 때 끝나는 것으로만 정의할 수 없다. 사용자가 입력을 바꾸거나 다른 화면을 선택하면 이전 요청의 소유권도 끝나야 한다. 그리고 새로고침 뒤에도 유지할 선택은 URL과 복원 규칙으로 따로 표현해야 한다.
