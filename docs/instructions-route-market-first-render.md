# 지시서 — 캡처마다 필요 없는 조회가 나가 렌더러가 타임아웃한다

이 파일 하나만 읽고 작업할 수 있게 썼다. 근거가 필요하면 인용한 코드를 직접 열어 확인하면 된다.

---

## 1. 무엇이 문제인가

**텔레그램 캡처가 15초 타임아웃으로 죽는다.** 2026-09-21 기준 섹터 발송 26틱 중 11건(42%)이 실패했다.
그 전에는 하루 한 건 이하였다.

```
[renderer] 캡처 오류: page.waitForSelector: Timeout 15000ms exceeded.
  - waiting for locator('[data-captureid=\'category-change-rate-capture\'][data-capture-ready="true"]')
```

**화면이 틀린 게 아니라 늦은 것이다.** 성공한 캡처는 예전과 똑같은 형태로 온다 — 마켓도 제대로 갈리고
`ALL STOCK` 이미지가 섞여 나오지도 않는다. 라우트도 셀렉터도 멀쩡하다.

`data-capture-ready={!isLoading}`(`CategoryChangeRatePage.tsx:432`,
`MarketMapCustomPage.tsx:292`)라서, 15초 동안 `isLoading`이 안 내려갔다는 뜻이다.

### 왜 느려졌나 — 기본값 하나가 바뀌었다

이 브랜치가 두 기본값을 `KOSPI`에서 `ALL_STOCK`으로 바꿨다.

```js
// useGlobalSettings.ts:89
const [market, setMarket] = usePersistedState<MarketQuery>('marketMap.market', 'ALL_STOCK')

// CategoryChangeRatePage.tsx:172
const [market, setMarket] = usePersistedState<MarketQuery>('categoryChangeRate.market', 'ALL_STOCK')
```

**렌더러는 `newPage()`마다 sessionStorage가 비어 있어 항상 기본값으로 시작한다.** 그래서 이 변경이
캡처마다 그대로 적용된다.

그리고 경로의 마켓은 **첫 렌더가 아니라 `useEffect`에서** 읽는다. 그 사이에 조회가 나간다.

`/sector/kospi?beforeMinutes=15&avgMode=simple&sectorFilter=true` 캡처 한 번을 따라가면 이렇다.

```
첫 렌더   useGlobalSettings 의 market = ALL_STOCK
             → GET /api/map?market=ALL_STOCK&isCustom=true      (트리)
          섹터 페이지의 market      = ALL_STOCK
             → GET /api/sector?market=ALL_STOCK&beforeMinutes=15  (랭킹, 버려짐)

effect    경로에서 kospi 를 읽어 market 교체
             → GET /api/sector?market=KOSPI&beforeMinutes=15
```

| | 이전 | 지금 |
|---|---|---|
| 트리 | `/map?market=KOSPI` | `/map?market=**ALL_STOCK**` |
| 랭킹 ① | `/sector?market=KOSPI` | `/sector?market=**ALL_STOCK**` ← 버려짐 |
| 랭킹 ② | 없음 | `/sector?market=KOSPI` |

**트리는 끝까지 안 고쳐진다.** 섹터 페이지가 경로에서 채우는 것은 자기 `categoryChangeRate.market`
이고, 트리 조회가 쓰는 `useGlobalSettings`의 market은 거기까지 안 온다.

버려지는 조회는 화면에 안 그려지므로 **결과물은 멀쩡하고 시간만 더 쓴다.** 수집 tick이 DB를 쓰는
순간과 겹치면 15초를 넘긴다.

### 구조적 실수는 원래도 있었다

이전엔 주소가 `?market=KOSDAQ` 형태였고 기본값이 `KOSPI`였다. 코스피 캡처는 기본값과 같아 버려지는
조회가 아예 없었고, 코스닥 캡처도 버려지는 조회가 KOSPI 한 마켓짜리였다.

**경로 방식으로 바꾼 것 자체는 잘못이 없다.** 다만 그 변경이 `?market=` 파라미터를 없애면서,
기본값에 의존하던 구조가 드러났고 `ALL_STOCK` 기본값이 그 비용을 키웠다.

---

## 2. 확정된 결정

이 절은 이미 결정된 사항이다. 더 나은 방법이 떠올라도 그대로 따른다.

### 결정 1 — 마켓은 첫 렌더부터 정한다. effect에서 고치지 않는다

`routeMarket`은 `pathname`에서 뽑는 값이라 **첫 렌더에 이미 손에 있다.** 기다릴 이유가 없다.

우선순위를 이렇게 확정한다.

```
?market= 쿼리 파라미터  →  경로 세그먼트  →  sessionStorage 저장값  →  기본값
```

쿼리 파라미터를 맨 앞에 두는 것은 **옛 캡처 URL 호환**을 위해서다(이 브랜치가 이미 그렇게 적어뒀다).
경로가 저장값을 이겨야 한다 — `/sector/kospi`를 열었는데 저장값이 KOSDAQ이라고 KOSDAQ을 보여주면 안
된다.

### 결정 2 — 트리 조회도 같은 마켓을 쓴다

```js
// useGlobalSettings.ts:172
const { data, isLoading, ... } = useMarketMap(market, isCustom, { enabled: needsTree })
```

이 `market`이 경로를 따라야 한다. 지금은 섹터 페이지에서 영영 `ALL_STOCK`이다.

`useGlobalSettings`는 **이미 `useLocation()`을 부르고 있다**(88행, 설정창 초기화용). 경로 마켓을 여기서
바로 뽑을 수 있다.

### 결정 3 — `ALL_STOCK` 기본값 자체는 그대로 둔다

사람이 브라우저로 여는 화면의 기본값을 `ALL_STOCK`으로 바꾼 것은 의도한 변경이다. **되돌리지 마라.**

고칠 것은 "렌더러가 기본값에 의존하는 상태"지 기본값이 아니다. 결정 1·2대로 경로가 항상 이기면
기본값이 무엇이든 캡처는 확정적으로 동작한다.

### 결정 4 — 설정 사이드바가 열린 채 찍히는 것도 의도다

```js
// useGlobalSettings.ts
const [isSettingsOpen, setIsSettingsOpen] = useState(true)
```

캡처 이미지에 설정 패널이 같이 나오는 것은 **사용자가 원한 동작이다**(확인함). 건드리지 마라.

### 결정 5 — 렌더러 타임아웃은 이번에 안 건드린다

15초를 늘리는 안이 있었지만 이번 범위가 아니다. 렌더러는 백엔드 레포(`containers/renderer/server.js`)
이고 배포 대상도 다르다. **여기서 고치는 것은 원인이고, 타임아웃은 완충이다.**

---

## 3. 범위

### 할 것

- `useGlobalSettings`의 트리 조회 마켓이 경로를 따르게
- 섹터 페이지의 마켓을 첫 렌더부터 경로에서 결정
- 지도 페이지도 같은 방식으로 — **같은 결함이 있다**

### 안 할 것

- **기본값을 되돌리지 않는다** (결정 3)
- **설정 사이드바 초기 상태를 건드리지 않는다** (결정 4)
- **렌더러·백엔드를 건드리지 않는다** (결정 5). 이 작업은 프론트 레포 하나로 끝난다
- **`?market=` 쿼리 파라미터 처리를 지우지 않는다.** 옛 캡처 URL 호환용이고 결정 1의 1순위다
- **API 경로나 쿼리 키를 건드리지 않는다.** 이 브랜치가 바꾼 `/map`·`/sector`는 그대로다

---

## 4. 어떻게 고치나

### 4-1. 지도 페이지도 같은 결함이다 ★

섹터만 보고 끝내지 마라. `MarketMapCustomPage`도 `useGlobalSettings()`를 인자 없이 부르고(126행),
경로 마켓을 effect에서 읽는다(193~198행).

```
/map/kospi 캡처
  첫 렌더  → GET /api/map?market=ALL_STOCK&isCustom=true   ← 버려짐
  effect  → GET /api/map?market=KOSPI&isCustom=true
```

**앱에서 제일 무거운 조회가 통째로 한 번 버려진다.** 결정 1·2를 `useGlobalSettings` 안에서 풀면 지도
페이지는 자동으로 같이 낫는다 — 이 페이지의 market이 곧 `useGlobalSettings`의 market이기 때문이다.

섹터 페이지만 자기 market(`categoryChangeRate.market`)을 따로 들고 있어서 한 겹 더 손이 간다.

### 4-2. 마켓 선택 UI와 어긋나지 않는다

`SubNavBar`의 마켓 목록은 이미 `<Link to={marketRoute(basePath, market)}>`로 **경로를 바꾼다**(30행).
즉 사용자가 마켓을 고르면 경로가 따라온다. 경로를 진실로 삼아도 상호작용 경로와 모순되지 않는다.

`MarketMapCustomPage.handleMarketChange`가 `setMarket` 외에 `reset()`(드릴다운 초기화)을 같이 부르는
것에 주의한다. 경로 기반으로 바꾸더라도 **마켓이 바뀔 때 드릴다운이 초기화되는 동작은 유지해야 한다.**

### 4-3. 조회는 한 마켓에 한 번만

고친 뒤 캡처 한 번에 나가는 조회는 이래야 한다.

```
/sector/kospi   →  /api/map?market=KOSPI&isCustom=true
                   /api/sector?market=KOSPI&beforeMinutes=15
/map/kospi      →  /api/map?market=KOSPI&isCustom=true
```

**`ALL_STOCK` 조회가 한 건도 없어야 한다**(경로가 `/allstock`인 경우는 제외).

---

## 5. 함정

### 5-1. `usePersistedState`는 저장값이 기본값을 이긴다 ★★

```js
// usePersistedState.ts:17-26
const [state, setState] = useState<T>(() => {
  const raw = sessionStorage.getItem(key)
  if (raw === null) return initialValue      // ← 저장값이 있으면 initialValue 를 안 쓴다
  ...
})
```

**`usePersistedState(key, routeMarket ?? 'ALL_STOCK')`로 고치면 안 된다.** 렌더러(저장값 없음)에서는
동작하지만, 브라우저에서 저장값이 있으면 경로를 무시한다. 결정 1의 우선순위가 깨진다.

**저장 상태와 화면이 쓰는 값을 분리해라.** 저장값은 "경로에 마켓이 없을 때의 폴백"으로만 쓰고,
이번 렌더에서 실제로 쓸 마켓은 우선순위대로 매 렌더 계산한다. 구체적인 모양은 구현자가 정한다.

경로에 마켓이 없는 주소(`/sector`, `/map`)에서 고른 마켓이 다음 방문에 기억되는 동작은 **그대로
유지해야 한다.** 저장 자체를 없애면 안 된다.

### 5-2. 섹터 페이지에 `needsTree: false`를 주면 안 된다 ★★

트리 조회를 아예 끄면 제일 간단해 보이지만 **섹터 제외가 깨진다.**

```js
// useGlobalSettings.ts:176-182
useEffect(() => {
  if (!data) return
  ...
  setExcludedCategoryNames(seedExcludedCategoryNames(data.items, []))
}, [data, market, isCustom, setExcludedCategoryNames])

// :186
const excludedCategoryIds =
  isCustom && sectorFilterEnabled ? new Set(excludedCategoryNames.keys()) : new Set<number>()
```

`excludedCategoryIds`는 **트리 응답의 `isExcluded`에서 시드된다.** 렌더러는 sessionStorage가 비어
있으므로 트리가 없으면 제외 목록이 통째로 빈 채로 찍힌다 — 텔레그램 숫자와 화면 숫자가 갈린다.
백엔드 PR #113·프론트 PR #57에서 고쳤던 그 증상이 되살아난다.

**트리는 필요하다. 마켓만 맞추는 것이 이번 작업이다.**

### 5-3. 시드 키도 같이 봐야 한다

위 effect의 시드 키가 `${market}:${isCustom}`이다(178행). 트리 조회 마켓을 바꾸면 **이 키도 같은
값을 따라가야 한다.** 조회는 KOSPI로 하면서 키는 ALL_STOCK으로 남으면, 마켓을 오갈 때 시드가 한 박자
어긋난다.

### 5-4. `pathname.split('/')[2]`는 다른 경로도 잡는다

`/admin/sector`면 `'sector'`가 잡힌다. `marketFromRouteSegment`가 `null`을 돌려주므로 지금은
안전하지만(`marketRoute.ts`), **경로 마켓이 `null`일 때 저장값으로 떨어지는 경로를 반드시 남겨둬라.**
`useGlobalSettings`는 지도·섹터 말고 다른 페이지에서도 불린다.

### 5-5. `docs/`는 이 파일 삭제 외에 건드리지 않는다

작업 중 알게 된 것은 PR 설명에 남긴다.

---

## 6. 완료 기준

1. `npm run build` 통과
2. `/sector/kospi` 진입 시 **`ALL_STOCK` 조회가 한 건도 나가지 않는다** (브라우저 개발자도구
   네트워크 탭, sessionStorage를 비운 상태로)
3. `/map/kospi`도 같다 — `/api/map` 호출이 **한 번**이고 `market=KOSPI`다
4. `/sector/allstock`·`/map/allstock`은 정상적으로 `ALL_STOCK`으로 조회한다
5. 저장값이 KOSDAQ인 상태에서 `/sector/kospi`를 열면 **KOSPI**가 보인다 (경로가 이긴다)
6. 경로에 마켓이 없는 `/sector`·`/map`은 저장값 → 기본값 순으로 떨어진다
7. `?market=KOSDAQ`를 붙이면 경로보다 우선한다 (옛 캡처 URL 호환)
8. SubNavBar에서 마켓을 바꾸면 경로가 바뀌고 화면도 따라간다. 지도에서는 드릴다운이 초기화된다
9. 설정 사이드바는 여전히 열린 채로 뜬다 (결정 4)
10. 이 지시서 파일(`docs/instructions-route-market-first-render.md`)을 마지막 커밋에서 삭제한다

---

## 7. 브랜치

**이 브랜치(`codex/feat/market-map-route-ui-followups`)에 이어서 작업한다.** 새 브랜치를 따지 마라.

문제를 만든 것이 이 브랜치이고 아직 병합 전이라, 고쳐서 PR #59 안에서 끝내는 것이 맞다. 이미 운영에
배포돼 있으므로 병합 후 프론트 Release를 다시 돌려야 한다.

---

## 8. 배포 후 확인

프론트 배포는 Release 워크플로 하나로 끝난다 — `market-monitor-assets:latest`가 갱신되고
`repository_dispatch`로 백엔드의 nginx 이미지가 자동 재빌드·배포된다. **백엔드는 손댈 것이 없다.**

배포 뒤 다음 발송 tick(15분 이내)에 텔레그램이 오는지 보고, 렌더러 로그에 타임아웃이 멎었는지 본다.

```bash
docker logs -t market-monitor-renderer 2>&1 | grep '캡처 오류' | tail
```

**고치기 전 기준선은 하루 11건 이상이다.** 몇 시간 지켜봐서 0건이면 끝난 것이고, 여전히 난다면
조회 개수 말고 다른 원인이 있다는 뜻이라 다시 봐야 한다.
