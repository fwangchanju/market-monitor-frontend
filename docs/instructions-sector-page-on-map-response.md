# 지시서 — 섹터 페이지를 지도 응답 위에서 그린다 (구획 1, PR 1 프론트)

이 파일 하나만 읽고 작업할 수 있게 썼다. 배경은 백엔드 레포 `docs/backlog.md`의 「카테고리 집계
테이블을 없앤다」에 있다. 이 지시서가 그 절과 다르게 정한 것은 이유와 함께 적었다. 어긋나면 이
지시서를 따른다.

---

## 1. 무엇을 하나

백엔드 PR #121이 `GET /api/sector`를 지우고, `/api/map`에 `snapshotTime` 파라미터를 더하고, 응답의
`tierBreakdown`을 항상 빈 배열로 바꾼다. 프론트는 그에 맞춰 이렇게 바뀐다.

```
지금                                               바뀐 뒤
섹터 페이지  /api/sector 한 번                →    /api/map 두 번 (최신 + beforeMinutes분 전)
평균 계산    tierBreakdown 합산, 없으면 종목    →    항상 종목에서 (공용 유틸 하나)
섹터 기본 모드  무시 (항상 커스텀 집계)          →    지도처럼 따라간다
```

**이 PR이 먼저 배포되고 백엔드가 뒤따른다.** 그 사이 몇 분간은 옛 백엔드(`snapshotTime`을 모름)와
붙어 있어야 한다. 결정 4가 그 경우를 다룬다.

---

## 2. 핵심 원칙 — 숫자가 지금과 같아야 한다

섹터 페이지 캡처 이미지와 그 캡션(백엔드가 계산)은 같은 숫자여야 한다. 둘이 갈려서 한참 잡았던 것이
백엔드 PR #113·프론트 PR #57이다. 백엔드 PR #121은 캡션을 **옛 집계와 한 자리도 다르지 않게**
옮겼고, 운영 DB로 대조해 24건 전부 일치를 확인했다.

그러므로 이 PR도 **지금 화면이 보여주는 숫자를 그대로 재현해야 한다.** 지금 숫자는 집계 테이블의
규칙으로 계산된다. 결정 1이 그 규칙이다.

---

## 3. 확정된 결정

이미 결정된 사항이다. 더 나은 방법이 떠올라도 그대로 따른다.

### 결정 1 — 카테고리 평균 유틸 하나. 규칙은 "집계 테이블과 같게"

`src/utils/categoryAverage.ts`를 새로 만든다. `utils/categoryTierBreakdown.ts`(`combineTierBreakdowns`)는
지운다.

```ts
export interface CategoryAverage {
  weightedAvg: number | null
  simpleAvg: number | null
}

export function computeCategoryAverage(
  node: MarketMapCategoryNode,
  excludedTierLabels: Set<string>,
): CategoryAverage
```

규칙:

```
대상 종목  node.items + 모든 하위 카테고리의 items (재귀)
           — 하위 카테고리가 isExcluded여도 포함한다
           — totalMarketValue가 0인 종목도 포함한다
거르기     item.marketValueTier 가 excludedTierLabels 에 있으면 뺀다. 이것 하나만 거른다
가중평균   Σ(changeRate × totalMarketValue) ÷ ΣtotalMarketValue.  ΣtotalMarketValue가 0이면 null
산술평균   ΣchangeRate ÷ 종목 수.  종목 수가 0이면 null
```

**왜 하위 제외·시총 0을 거르지 않나.** 집계 테이블(`collectItems`)이 그렇게 더했고, 지금 지도 헤더
(`combineTierBreakdowns(node.tierBreakdown)`)·업종 톱픽·섹터 그래프·텔레그램 캡션이 전부 그 값을
쓴다. `useFilteredMarketMapTree`가 거른 뒤의 items로 계산하면 섹터 필터를 켠 사용자에게 숫자가
달라진다. 지금의 폴백(`localWeightedAvgChangeRate`, `fallbackWeightedAvgChangeRate`)이 바로 그 다른
숫자를 내는 코드다 — 결정 2에서 지운다.

**반드시 필터 전 원본 노드에 적용한다.** 결정 2 참고.

### 결정 2 — 지도·업종 톱픽도 이 유틸을 쓴다. 폴백은 지운다

| 자리 | 지금 | 바뀐 뒤 |
|---|---|---|
| `useFilteredMarketMapTree.filterNodes` | `combineTierBreakdowns(node.tierBreakdown, …)` | `computeCategoryAverage(node, …)` — **`node`는 루프 변수 그대로(필터 전 원본)**. 거른 `items`·`children`으로 새로 만든 노드에 적용하지 않는다 |
| `useGlobalSettings.topPickAverage` | 노드 값, 없으면 `fallback*AvgChangeRate` | 노드 값만. `fallbackWeightedAvgChangeRate`·`fallbackSimpleAvgChangeRate` 삭제 |
| `MarketMapCategorySection` | 노드 값 `??` `local*AvgChangeRate(items)` | 노드 값만. `localWeightedAvgChangeRate`·`localSimpleAvgChangeRate` 삭제. 값이 `null`이면 헤더에서 등락률 칸만 뺀다 |

폴백이 필요 없어지는 이유: `filterNodes`는 거른 뒤 시총이 남는 노드만 남기고, 거른 종목은 원본
종목의 부분집합이다. 남은 노드라면 원본에서 구간만 거른 종목도 반드시 있어서 평균이 `null`이 되지
않는다. `null` 처리는 방어용이다.

`FilteredMarketMapCategoryNode`의 `weightedAvgChangeRate`·`simpleAvgChangeRate` 필드와 그 주석은
유지하되, 주석에서 "스냅샷이 없거나(기본 마켓맵)" 같은 `tierBreakdown` 전제 문장은 고친다.

**기본 모드 지도 헤더는 조금 달라질 수 있다.** 지금 기본 모드는 폴백(거른 뒤 items)을 탄다.
바뀐 뒤엔 결정 1 규칙이다. 기본 모드는 하위 카테고리가 없으니 차이는 시총 0 종목 하나뿐이고,
산술평균에만 영향이 있다. PR 설명에 적는다.

### 결정 3 — `tierBreakdown`을 스키마에서 지운다

`src/types/api.ts`에서 `MarketMapCategoryNode.tierBreakdown`, `CategoryTierBreakdownSchema`,
`CategoryTierBreakdown` 타입을 지운다.

zod `z.object`는 스키마에 없는 키를 **에러 없이 버린다.** 그래서 필드를 스키마에서 지우면
- 옛 백엔드(값이 채워진 배열)도,
- PR #121 백엔드(빈 배열)도,
- PR 2 백엔드(필드 없음)도

전부 파싱된다. 지금처럼 필수로 두면 백엔드 PR 2가 필드를 지우는 순간 지도가 죽는다. 이 결정이
백엔드 PR 2의 선행 조건이다.

`.strict()`나 `.passthrough()`를 쓰고 있지 않은지 확인한다. 쓰고 있으면 멈추고 보고한다.

### 결정 4 — 섹터 페이지는 `/api/map`을 순차로 두 번 받는다

```
1) now    = GET /api/map?market&isCustom                     (지도와 같은 쿼리 — 캐시를 같이 쓴다)
2) before = GET /api/map?market&isCustom&snapshotTime=T      T = now.snapshotTime − beforeMinutes
```

- **before는 now의 `snapshotTime`에서 계산한다.** "지금 시각을 5분으로 내림"처럼 추측하지 않는다.
  수집이 늦거나 구멍이 나면 어긋난다
- now의 `snapshotTime`이 `null`(빈 응답)이면 before를 부르지 않는다
- 시각 계산은 **타임존 없이** 한다. `snapshotTime`은 `2026-09-22T10:05:00` 모양의 KST 로컬 시각
  문자열이다. `new Date(문자열)`은 브라우저 타임존으로 해석되니 쓰지 않는다. 연·월·일·시·분·초를
  잘라 `Date.UTC`로 계산하고 `toISOString().slice(0, 19)`로 되돌리는 식으로, 입력과 같은 모양의
  문자열을 만든다. 이 계산은 `utils`에 함수 하나로 둔다

#### before로 인정하는 조건 ★

before 응답은 아래를 **전부** 만족할 때만 before로 쓴다. 하나라도 아니면 **"before 없음"**이다.

```
- 요청이 성공했다 (에러면 before 없음. 페이지 전체를 에러로 만들지 않는다)
- 응답 snapshotTime 이 null 이 아니다   (그 시각이 없으면 백엔드가 빈 응답을 준다)
- 응답 snapshotTime 이 요청한 T 와 같다  (비교는 문자열이 아니라 위 계산과 같은 방식으로 정규화해서)
```

세 번째가 옛 백엔드 대비다. 옛 백엔드는 `snapshotTime`을 모르고 무시하므로 **최신을 돌려준다.**
그걸 before로 쓰면 now와 before가 같아져 **변화율이 전부 0으로 그려진다.** 틀린 그림보다 빈
그림이 낫다.

"before 없음"이면 변화율 그래프는 비고(지금의 "데이터가 없습니다"), 현재 그래프와 지수 막대는
그대로 나온다. 지금 동작과 같다.

#### 화면은 항상 짝이 맞는 한 쌍으로 그린다

60초 재조회로 now가 새 tick으로 바뀌면 before 키도 바뀌어 새로 받는다. 그 사이 새 now와 옛 before를
섞으면 틀린 변화율이 나오고, before를 비우면 5분마다 변화율 그래프가 깜빡인다.

- **새 now에 대한 before가 도착(또는 "없음"으로 확정)할 때까지 직전 한 쌍을 그대로 그린다.**
  상단 바의 시각도 그 쌍의 now 시각이다
- **첫 진입**은 now와 before가 둘 다 확정될 때까지 스피너다
- `data-capture-ready`는 **지금 그리는 쌍이 최신 now에 대한 것일 때만** `true`다. 렌더러
  (`containers/renderer/server.js`)가 이 값이 `true`가 되는 순간 캡처하므로, now만 오고 before가 아직일
  때 `true`가 되면 변화율 없는 이미지가 텔레그램으로 나간다

구현 방식(상태로 들고 있을지, 쿼리 옵션으로 풀지)은 구현자가 정한다. 위 세 가지를 지키면 된다.

#### 쿼리

- `api/marketMap.ts`의 `getMarketMap`에 선택 인자 `snapshotTime?: string`을 더한다. 있을 때만
  파라미터로 싣는다
- `useMarketMap`에 `snapshotTime`을 옵션으로 받고, 쿼리 키 `marketMapKeys.map`에 넣는다. **최신 조회의
  키는 지금과 같게 유지한다**(지도 페이지·`useGlobalSettings`와 캐시를 같이 써야 한다). 예:
  `snapshotTime`이 없으면 지금 키, 있으면 뒤에 붙인다
- 캐시 설정은 둘 다 `MARKET_DATA_CACHE` 그대로

### 결정 5 — 섹터 그래프 조립

지금 `CategoryChangeRatePage`가 하는 일을 트리 두 개로 옮긴다. **규칙은 바꾸지 않는다.**

```
대상 카테고리  트리의 최상위 노드 (지금의 depth === 0)
제외          excludedCategoryIds.has(node.categoryId) 인 최상위 노드는 뺀다 (지금과 같다)
현재 값        computeCategoryAverage(nowNode, excludedMarketValueTiers) 의 가중 또는 산술
변화율 값      현재 값 − computeCategoryAverage(beforeNode, …) 의 같은 쪽
               before 트리에 같은 카테고리가 없거나 값이 null 이면 그 카테고리는 변화율에서 빠진다
정렬·축·색    지금 코드 그대로 (buildRankChart, RankBars)
```

- **now와 before의 카테고리 짝은 `categoryName`으로 맞춘다.** 기본 모드 노드는 `categoryId`가 전부
  0이다(백엔드 `NO_CATEGORY_ID`). 커스텀 트리는 이름이 DB UK로 유일하고, 기본 모드는 group-by
  결과라 유일하다
- React key도 `categoryName` 기준으로 바꾼다. 지수 막대(`MARKET_INDEX_CATEGORY_ID = -1`)는 카테고리
  이름과 겹칠 수 있으니(`코스피`라는 카테고리) 이름과 섞이지 않는 별도 키를 쓴다
- **`ALL_STOCK`은 응답 하나가 이미 두 마켓을 합친 트리다.** 지금처럼 마켓별 목록을 이어붙이는 코드
  (`mergedByCategoryId`, `beforeAvailable`)는 필요 없어진다. "한 마켓만 before가 없으면 반쪽 before"
  문제는 백엔드가 막는다 — `snapshotTime`을 준 조회는 요청한 마켓 **전부**에 그 시각이 있을 때만
  트리를 준다
- 기본 모드(`isCustom=false`)는 설정의 커스텀 모드 토글을 그대로 따른다. 지금 섹터 페이지는 이
  토글을 무시하고 항상 커스텀 집계를 보여줬다. 이 PR로 기본 모드도 그려진다

#### 지수 막대

```
현재    now 응답의 marketOverview.changeRate
변화율  now − before 응답의 marketOverview.changeRate   (before가 "없음"이면 막대 없음)
```

`marketOverview`는 단일 마켓 조회에만 오고 `ALL_STOCK`이면 `null`이다. 지금도 `ALL_STOCK`은 지수 막대가
없으니 같은 동작이다. 값은 지금 `/api/sector`의 `index`와 같은 테이블·같은 시각에서 온다.

### 결정 6 — 지우는 것

| 대상 | 처리 |
|---|---|
| `api/marketMap.ts`의 `getCategoryChangeRates` | 삭제 |
| `hooks/useCategoryChangeRates.ts` | 파일 삭제 |
| `queryKeys.ts`의 `marketMapKeys.categoryChangeRates` | 삭제 |
| `types/api.ts`의 `CategoryChangeRateItemSchema`, `MarketIndexChangeRateSchema`, `CategoryChangeRateMarketRankingSchema`, `CategoryChangeRateResponseSchema`와 그 타입 | 삭제 |
| `utils/categoryTierBreakdown.ts` | 파일 삭제 |
| 목업 `/api/sector` 핸들러와 `categoryChangeRateRankings` 데이터 | 삭제 |
| 목업 트리의 `tierBreakdown` 필드 | 삭제 |

- `CAPTURE_ID.CATEGORY_CHANGE_RATE`와 `categoryChangeRate.*` 저장 키는 **건드리지 않는다.** 캡처 ID는
  백엔드와 문자열로 맞춘 계약이라, 이름 맞추기는 백로그 「옛 프론트 라우트 제거 + 캡처 ID 이름
  맞추기」에서 두 레포를 같이 고친다
- 페이지 파일명(`CategoryChangeRatePage`)도 그대로 둔다
- 지우고 나서 `grep -rn "tierBreakdown\|/sector'\|CategoryChangeRate\|combineTierBreakdowns" src`로
  남은 참조가 없는지 본다(라우트 `/sector/*`와 캡처 ID, 저장 키는 남는 게 맞다)

### 결정 7 — 목업이 `snapshotTime`을 흉내 낸다

`npm run dev:mock`에서 변화율이 그려져야 확인할 수 있다. 목업 `/api/map` 핸들러를 이렇게 바꾼다.

- `snapshotTime` 파라미터가 없으면 지금처럼 최신 트리
- 있으면 그 값을 응답 `snapshotTime`에 그대로 싣고, 종목 `changeRate`를 조금씩 다르게 한 트리를 준다
  (변화율 막대가 0이 아니게 보일 정도면 된다)

---

## 4. 범위

### 할 것

- 결정 1~7

### 안 할 것

- **요약 페이지는 건드리지 않는다.** 개편은 따로 한다(사용자 결정)
- **캡처 ID, 라우트, 저장 키 이름을 바꾸지 않는다** (결정 6)
- **백엔드를 건드리지 않는다**
- **섹터 페이지 레이아웃·색·문구를 바꾸지 않는다.** 데이터 출처만 바꾼다
- 설정 사이드바에서 섹터에 안 맞는 항목을 정리하는 일(페이지 주석의 "나중에 검토")은 이번이 아니다

---

## 5. 함정

### 5-1. 필터 전 원본에 적용하라 ★★

`filterNodes`는 루프 안에서 `items`·`children`을 새로 거른다. 유틸을 **거른 값**에 적용하면 결정 1의
규칙이 깨지고 섹터 필터 사용자의 지도 헤더·업종 톱픽 숫자가 바뀐다. 이 PR이 조용히 틀리는 가장 쉬운
자리다. 유틸 인자는 `filterNodes`가 받은 `node` 그대로다.

섹터 그래프도 마찬가지다. `useGlobalSettings`의 `filteredRootNodes`가 아니라 **응답 원본 트리**
(`data.items`)의 최상위 노드를 쓴다.

### 5-2. 옛 백엔드와 붙어 있는 몇 분 ★

배포 순서가 프론트 먼저다. 그 사이 before 요청은 최신을 돌려받는다. 결정 4의 "응답 시각이 요청과
같을 때만" 조건이 이걸 "before 없음"으로 바꾼다. 이 조건을 빼먹으면 **변화율이 전부 0인 이미지가
텔레그램으로 나간다.**

옛 백엔드의 지도 응답은 `tierBreakdown`이 채워져 오지만, 결정 3으로 스키마에서 버리므로 상관없다.

### 5-3. 렌더러 캡처 시점 ★

결정 4의 `data-capture-ready` 규칙. 첫 진입에서 now만 도착한 순간 `true`가 되면 렌더러가 그때 찍는다.
렌더러 대기 한도는 20초(백엔드 PR #119)이고, `/api/map` 두 번은 장중 실측 기준 5~6초다.

### 5-4. 타임존

`new Date('2026-09-22T10:05:00')`은 브라우저 로컬 시각으로 해석된다. KST 브라우저에선 맞아 보여도
렌더러 컨테이너(UTC일 수 있다)에서는 9시간 어긋난 before를 요청한다. 결정 4대로 타임존 없는 계산만
쓴다.

### 5-5. 알려진 차이 — PR 설명에 적는다

- 기본 모드 지도 헤더의 산술평균이 시총 0 종목만큼 달라질 수 있다 (결정 2)
- 섹터 페이지가 커스텀 모드 토글을 따르게 된다. 기본 모드로 두고 있던 사용자는 섹터 화면이 기본
  분류로 바뀐다
- 섹터 페이지 첫 진입이 조금 느려진다. 요청이 둘이고 순차다

---

## 6. 완료 기준

1. `npm run build` 통과
2. `npm run lint` — main 대비 **새 에러가 없다**(main에 원래 있는 에러는 그대로 둔다. 몇 건인지 PR
   설명에 적는다)
3. `computeCategoryAverage`가 필터 전 원본 노드에 적용된다 — `filterNodes`, 섹터 그래프 둘 다
4. 폴백 함수 넷(`localWeighted/SimpleAvgChangeRate`, `fallbackWeighted/SimpleAvgChangeRate`)이 없다
5. `tierBreakdown`, `CategoryTierBreakdown`, `combineTierBreakdowns`, `/sector` API 호출,
   `CategoryChangeRate*` 스키마가 `src`에 없다
6. before는 now의 `snapshotTime`에서 타임존 없이 계산하고, 응답 시각이 요청과 다르면 "before 없음"이다
7. now가 새 tick으로 바뀌는 동안 직전 쌍을 그리고, `data-capture-ready`는 최신 쌍일 때만 `true`다
8. 기본 모드에서 섹터 페이지가 그려지고, now·before 짝이 `categoryName`으로 맞는다
9. `npm run dev:mock`으로 아래를 직접 띄워 스크린샷을 PR에 붙인다
   - `/sector/allstock`, `/sector/kospi` — 현재·변화율 그래프, kospi는 지수 막대 포함
   - 커스텀 모드 끈 `/sector/kospi`
   - `/map/kospi` — 헤더 등락률과 업종 톱픽이 그대로 나온다
10. PR 설명에 5-5의 알려진 차이
11. 이 지시서 파일(`docs/instructions-sector-page-on-map-response.md`)을 마지막 커밋에서 삭제한다

---

## 7. 커밋 분리

| # | 내용 |
|---|---|
| 1 | 평균 유틸 추가, `filterNodes`·업종 톱픽·카테고리 섹션이 쓰게 하고 폴백 삭제 (결정 1·2) |
| 2 | `getMarketMap`·`useMarketMap`에 `snapshotTime`, 목업 (결정 4의 쿼리, 결정 7) |
| 3 | 섹터 페이지를 두 번 조회로 (결정 4·5) |
| 4 | `/sector` API·훅·스키마·`tierBreakdown`·`combineTierBreakdowns` 삭제 (결정 3·6) |
| 5 | 지시서 삭제 |

커밋마다 `npm run build`가 통과해야 한다.

---

## 8. 배포

**이 PR이 백엔드 PR #121보다 먼저 나간다.** 백엔드가 먼저 나가면 지금 섹터 페이지가 404다.

프론트 배포 후 백엔드 배포 전 몇 분 동안은 섹터 페이지의 변화율 그래프가 비어 있는 것이 정상이다
(결정 4). 백엔드 배포 뒤 확인할 것:

- 섹터 페이지 변화율이 다시 그려진다
- 섹터 캡처 이미지의 TOP 카테고리 순서가 텔레그램 캡션과 같다
- 렌더러 로그에 캡처 오류가 늘지 않는다
