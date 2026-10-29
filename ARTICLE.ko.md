# 한글 입력이 fetch를 깨뜨릴 때: 입력 계약, 오류 분류, 검색 초기화

폼에서 오류가 났다고 해서 모두 잘못된 입력은 아니다. 요청이 브라우저를 떠나기도 전에 실패할 수 있고, 형식은 맞지만 등록되지 않은 값일 수도 있으며, 서버 대신 프록시의 HTML 오류 문서가 돌아올 수도 있다.

이 글은 가상의 워크숍 티켓으로 그 차이를 재현한다. 같은 화면 아래에는 검색 입력과 실제 적용된 검색 조건이 어긋나는 별도 실험을 넣었다. 실제 서비스 코드와 데이터는 사용하지 않았다.

[실행 가능한 전체 예제 · topic/03-input-contract](https://github.com/tongnamuu/fe-form-state-lab/tree/topic/03-input-contract)

## 실행과 비교

프로젝트의 `topic/03-input-contract` 브랜치를 사용한다. Node 24.13.1, Next.js 15.5.12, React 19.1.0, Playwright 1.58.2에서 검증했다.

```sh
git clone https://github.com/tongnamuu/fe-form-state-lab.git
cd fe-form-state-lab
git switch topic/03-input-contract
npm install
npm run dev
```

`http://127.0.0.1:3193/broken`과 `/fixed`에 같은 입력을 넣어 비교한다.

| 입력·상황 | 수정 전 | 수정 후 |
| --- | --- | --- |
| `한글티켓` | 헤더 생성 과정에서 TypeError | JSON 검증 API가 형식 오류 응답 |
| `NOENTRY` | 영문·숫자로 입력하라는 잘못된 안내 | 등록되지 않은 티켓 안내 |
| `TICKET7` | 검증 성공 | 검증 성공 |
| `TICKET7` + 502 재현 선택 | HTML 문서가 오류 문구로 노출 | 재시도 안내 |
| 없는 검색어 검색 후 입력 비우기 | 이전 필터가 남음 | 전체 공개 샘플 복원 |

## 한글을 헤더 값에 바로 넣으면 요청 전에 실패할 수 있다

다음 코드는 브라우저에서 실행 가능한 최소 재현이다. `try` 안에서 `await`해야 실패를 확인할 수 있다.

```js
try {
  await fetch('/api/ticket', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Ticket': '한글티켓',
    },
    body: JSON.stringify({ ticket: '한글티켓' }),
  });
} catch (error) {
  console.log(error.name, error.message);
}
```

Chromium에서는 `ByteString` 또는 `ISO-8859-1`과 관련된 오류 문구를 볼 수 있다. 정확한 문구는 브라우저에 따라 다르다. 예제의 자동 테스트는 이 경우 `/api/ticket` 네트워크 요청이 0회였는지도 확인한다.

Fetch의 헤더 입력에는 Web IDL의 ByteString 타입이 사용된다. ByteString 변환은 문자열에 255보다 큰 코드 단위가 있으면 TypeError를 발생시킨다. 한글을 담은 원시 문자열은 이 조건을 만족하지 않는다. 이것을 곧바로 CORS나 서버 검증 오류로 판단하면 조사 지점이 어긋난다. [Fetch: Headers](https://fetch.spec.whatwg.org/#headers-class), [Web IDL: ByteString 변환](https://webidl.spec.whatwg.org/#es-ByteString)

그렇다고 255 이하의 모든 문자가 임의의 헤더에 허용된다는 뜻은 아니다. 헤더에는 별도의 유효성 규칙도 있다. 입력값을 무조건 헤더에 넣기보다 API 계약에 맞는 전송 방식을 정해야 한다.

## 검증할 원문은 JSON으로 보내고, 판정은 서버에서 한다

수정 예제의 검증 API는 헤더 대신 JSON 본문으로 입력을 받는다.

```js
const response = await fetch('/api/ticket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ticket }),
});
```

이 변경은 한글 티켓을 허용한다는 뜻이 아니다. 요청이 서버의 검증 로직까지 도달하도록 전송 계약을 바꾼 것이다. 예제 서버는 **영문 대문자 또는 숫자 7자**라는 규칙을 검사한다. `TICKET7`과 `EMPTY77`만 등록된 가짜 티켓이고, `NOENTRY`는 형식만 맞는 미등록 값이다.

```js
function isTicket(value) {
  return typeof value === 'string'
    && /^[A-Z0-9]{7}$/.test(value);
}

if (!isTicket(ticket)) {
  return Response.json(
    { message: '올바른 티켓 형식이 아닙니다.' },
    { status: 400 }
  );
}
return Response.json({
  accepted: ticket === 'TICKET7' || ticket === 'EMPTY77',
});
```

서버는 `trim()`으로 원문을 고쳐서 승인하지 않는다. 공백을 허용하지 않는 티켓 계약이므로 앞뒤 공백, 중간 공백, 개행도 거절한다. 검색어는 별개의 계약이므로 앞뒤 공백을 정리할 수 있다. 서로 다른 입력의 정규화 규칙을 하나로 묶지 않는 편이 명확하다.

## 형식 오류·미등록 값·서비스 장애를 다른 결과로 표현한다

수정된 클라이언트는 서버의 원시 응답을 그대로 화면에 출력하지 않는다.

```js
if (response.status === 400) {
  return { kind: 'format', message: '올바른 티켓 형식이 아닙니다.' };
}
if (!response.ok) {
  return { kind: 'unavailable', message: RETRY };
}
const result = await response.json();
if (typeof result.accepted !== 'boolean') {
  return { kind: 'unavailable', message: RETRY };
}
return result.accepted
  ? { kind: 'accepted', message: '티켓이 확인되었습니다.' }
  : { kind: 'unknown', message: '등록되지 않은 티켓입니다.' };
```

위 코드는 분기 구조를 발췌했다. 전체 예제는 JSON Content-Type도 확인하고, 파싱 실패와 네트워크 실패를 잡아 재시도 메시지로 바꾼다. 여기서 400을 형식 오류로 매핑하는 것은 이 티켓 API의 계약이다. 다른 API의 모든 400을 같은 의미로 처리하라는 규칙은 아니다.

fetch는 HTTP 403이나 502라는 이유만으로 Promise를 reject하지 않는다. `response.ok` 또는 상태 코드를 확인해야 한다. 반면 네트워크 실패나 응답 파싱 실패는 별도 오류 경로로 들어올 수 있다. [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

HTML 오류 문서를 `response.text()`로 읽은 뒤 그대로 `Error`에 넣으면 사용자는 긴 태그 문자열을 보게 된다. 예제의 수정 전 화면은 이 불편을 의도적으로 재현한다. React의 일반 텍스트 출력으로 렌더하므로 이 실험은 HTML 실행을 입증하는 XSS 예제가 아니다.

운영 진단에는 상태 코드나 요청 식별자가 도움이 될 수 있다. 하지만 사용자 메시지와 진단 정보는 다른 목적을 가진다. 등록되지 않은 티켓에 영문·숫자 규칙을 다시 안내하거나, 서버 장애를 사용자 입력 탓으로 표시하면 다음 행동을 잘못 유도한다.

## 검색창을 지웠는데 결과가 계속 비어 있는 이유

검색 버튼을 눌러 적용하는 UI에는 보통 두 상태가 있다.

```js
const [draft, setDraft] = useState('');
const [applied, setApplied] = useState('');
```

`draft`는 입력창에 보이는 값이고, `applied`는 목록 필터에 실제로 사용되는 값이다. 없는 단어를 검색한 뒤 `draft`만 비우면 `applied`에는 이전 단어가 남는다.

예제의 UX 계약은 **입력창을 비우면 전체 목록을 즉시 복원한다**이다. 따라서 다음과 같이 처리한다.

```js
function onSearchChange(value) {
  setDraft(value);
  if (!value.trim()) setApplied('');
}
function clearSearch() {
  setDraft('');
  setApplied('');
}
```

이름과 카테고리는 하나의 검색 조건으로 찾는다. 검색 중 작성하는 값과 적용된 값은 계속 구분하되, 비우기 동작의 의미를 두 상태에 함께 반영한다. 서버 검색이라면 필터만 아니라 페이지 번호와 이전 응답의 수명도 함께 점검해야 한다.

## 테스트로 확인한 경계

이 브랜치의 17개 테스트는 수정 전후 결과, Unicode 요청의 네트워크 발생 여부, JSON 본문, 502 HTML, 네트워크 실패, 잘못된 JSON, 성공 응답, 검색 초기화와 공백·개행을 포함한 서버 검증을 다룬다.

```sh
npx playwright install chromium
npm test
npm run build
npm start
```

입력 처리에서는 문자열 규칙 하나만 맞춰도 충분하지 않다. 원문을 어떻게 전송하는지, 서버가 어떤 의미로 응답하는지, UI가 어떤 상태를 실제로 적용하는지까지 이어서 확인해야 한다.
