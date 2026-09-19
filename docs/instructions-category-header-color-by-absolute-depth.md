# 지시서 — 드릴다운해도 카테고리 헤더의 색과 보이는 단계 수가 바뀌지 않게 한다

이 파일 하나만 읽고 작업할 수 있게 썼다. 작업 브랜치는 PR #58(`codex/style/market-map-ui-polish`)이고
그 PR에 커밋을 이어붙인다.

두 가지를 고친다. 헤더 색은 트리 기준 절대 depth로 정하고(결정 1~4), 업종 분류 레벨 제한은 드릴다운으로
들어온 자기 자신을 세지 않는다(결정 5). 둘 다 "카테고리의 속성은 어느 화면에서 보든 같아야 하고, 화면에
따라 달라지는 것은 폰트 크기뿐"이라는 한 원칙에서 나온다.

---

## 1. 무엇이 문제인가

지도 페이지에서 카테고리 헤더의 배경색과 글자색은 대분류·중분류·소분류를 눈으로 구분하는 수단이다.

| 분류 | 배경 | 글자 |
|---|---|---|
| 대분류 | `bg-black` | 노랑(`MARKET_INDEX_REFERENCE_COLOR`) |
| 중분류 | `bg-[#333333]` | 흰색 |
| 소분류 | `bg-[var(--accent)]` | 검정 |

그런데 대분류를 클릭해서 안으로 들어가면 중분류 헤더가 대분류 색(검정 바탕에 노랑 글자)으로 바뀐다.
소분류는 중분류 색이 된다. 드릴다운할 때마다 같은 카테고리의 색이 달라지니 색이 분류 단계를 알려주지
못한다.

원인은 `src/components/MarketMapCategorySection.tsx`가 색을 정할 때 쓰는 `depth`가 "지금 화면에서
몇 번째 단계인가"(상대 depth)라서다. 드릴다운으로 들어온 자기 자신(`isSelf`)은 헤더를 안 그리고, 그
자식들이 `depth` 0을 그대로 물려받는다(187행 `depth={category.isSelf ? depth : depth + 1}`).

```
전체 화면            대분류 클릭 후
 대분류 depth 0  →   (자기 자신, 헤더 없음)
  중분류 depth 1 →    중분류 depth 0   ← 대분류 색을 받는다
   소분류 depth 2 →    소분류 depth 1   ← 중분류 색을 받는다
```

폰트 크기(`categoryHeaderFontSize`)와 헤더 높이(`categoryHeaderHeight`)도 같은 상대 depth를 쓴다.
이쪽은 지금 동작이 맞다. 들어갈수록 헤더가 커져야 읽기 편하다.

---

## 2. 확정된 결정

### 결정 1 — 색은 절대 depth, 크기는 상대 depth

헤더의 배경색과 글자색은 그 카테고리가 트리에서 실제로 몇 단계인지(절대 depth)로 정한다. 대분류는
어느 화면에서 보든 검정 바탕 노랑 글자다.

폰트 크기와 헤더 높이는 지금처럼 상대 depth를 유지한다. 드릴다운하면 커진다.

### 결정 2 — 절대 depth는 `path.length`에서 나온다. 트리 데이터를 바꾸지 않는다

`MarketMapCustomPage`가 `MarketMapTreemap`에 넘기는 `depth={path.length}`가 곧 "지금 화면의 상대
depth 0이 절대 몇 단계인가"다.

```
path = []            → 화면 최상위 = 대분류      → 절대 depth = 상대 depth + 0
path = ['KOSPI']     → 화면 최상위 = 중분류      → 절대 depth = 상대 depth + 1
path = ['KOSPI','반도체'] → 화면 최상위 = 소분류  → 절대 depth = 상대 depth + 2
```

`LaidOutCategory`나 `DisplayGroup`에 depth 필드를 추가하지 않는다. 오프셋 하나를 prop으로 내리는
것으로 충분하고, 그쪽 구조를 건드리면 `useMarketMapLayout`의 paddingTop 계산까지 다시 봐야 한다.

### 결정 3 — 배경색과 글자색을 한 표로 묶는다

지금은 배경(`CATEGORY_HEADER_COLORS` 배열)과 글자색(154행의 삼항 연산자 두 개)이 따로 있다. 둘이 한
쌍이라는 것이 이번 요건의 요점이니 한 표로 합친다.

```ts
// 절대 depth(트리 기준 실제 단계) → 배경/글자색. 배열 끝을 넘으면 마지막 값을 반복한다.
const CATEGORY_HEADER_STYLES = [
  { background: 'bg-black',            text: undefined },        // 대분류: 글자색은 style.color로 MARKET_INDEX_REFERENCE_COLOR
  { background: 'bg-[#333333]',        text: 'text-white' },     // 중분류
  { background: 'bg-[var(--accent)]',  text: 'text-black' },     // 소분류
]
```

대분류 글자색이 Tailwind 클래스가 아니라 hex 리터럴인 이유는 `marketMapColorScale.ts`의
`MARKET_INDEX_REFERENCE_COLOR` 주석에 있다(섹터 페이지와 픽셀 단위로 같은 색이어야 한다). 그 구조는
유지한다.

### 결정 4 — 줌 애니메이션의 고스트도 자기 화면의 절대 depth를 쓴다

`MarketMapTreemap`은 드릴다운 전환 중에 직전 화면의 `LaidOutCategory[]` 스냅샷을 고스트로 겹쳐 그린다
(`outgoingSnapshotRef`, `GhostOverlay`). 이 스냅샷은 전환 전 화면이라 오프셋도 전환 전 `depth`여야 한다.

```
줌인:  전체(depth 0) → KOSPI(depth 1)
       고스트 = 전체 화면 스냅샷 → 오프셋 0     (지금 depth 1을 주면 대분류가 중분류 색으로 페이드아웃)
줌아웃: KOSPI(depth 1) → 전체(depth 0)
       고스트 = KOSPI 화면 스냅샷 → 오프셋 1
```

스냅샷을 잡는 두 자리(`handleSelectCategory`, `zoomOutRequestDepth` effect)에서 그 시점의 `depth`를
함께 저장하고, `GhostOverlay`에 실어서 고스트 렌더링에 넘긴다.

### 결정 5 — 업종 분류 레벨 제한은 드릴다운으로 들어온 자기 자신을 세지 않는다

설정 사이드바의 "업종 분류 레벨"(`maxDepth`, 기본값 2 = 소분류 헤더를 접음)은 지금 위치 기준 상대값으로
적용된다고 주석에 적혀 있지만, 드릴다운 상태에서는 자기 자신을 1단계로 센다.

```ts
// MarketMapCustomPage.tsx 159행
const displayNode = currentNode && effectiveMaxDepth != null && !isFullyFlattened
  ? (limitDepth([currentNode], effectiveMaxDepth)[0] ?? currentNode)   // currentNode가 depth 1
  : currentNode
```

`currentNode`는 `isSelf`라 헤더를 안 그린다. 그런데 이걸 1단계로 세니 `maxDepth = 2`일 때 화면에는
중분류 헤더 한 단계만 남고 소분류는 접힌다. 전체 화면에서는 대분류·중분류 두 단계가 보이던 것이
들어가는 순간 한 단계로 줄어드는 셈이다.

```
maxDepth = 2                지금                        바뀐 뒤
전체 화면                   대분류 + 중분류 헤더        대분류 + 중분류 헤더  (같음)
대분류 안                   중분류 헤더만               중분류 + 소분류 헤더
중분류 안                   소분류 헤더만               소분류 헤더만         (더 깊은 단계가 없음)
```

"화면에 헤더가 보이는 최상위 단계"를 1로 센다. 드릴다운 상태에서는 그게 `currentNode.children`이다.
`limitDepth`를 `currentNode.children`에 걸고 그 결과를 자식으로 바꿔 끼운다.

```ts
const displayNode = currentNode && effectiveMaxDepth != null && !isFullyFlattened
  ? { ...currentNode, children: limitDepth(currentNode.children, effectiveMaxDepth) }
  : currentNode
```

`currentNode.totalMarketValue`는 그대로 둔다. `limitDepth`는 종목을 버리지 않고 접기만 하므로 합계가
안 바뀐다(합계 0인 노드만 빠지는데 그건 원래 0이다).

설정 사이드바의 라벨(대분류·중분류·소분류)과 슬라이더 상한(`availableMaxDepth`, 루트 기준 트리
깊이)은 바꾸지 않는다. 중분류 안에 들어가면 라벨 "중분류"가 실제로는 소분류 헤더를 가리키게 되는데,
이 어긋남은 알고 두는 것이다. 라벨을 화면마다 바꾸는 것보다 "지금 보이는 최상위 + N-1단계"라는 규칙
하나가 낫다.

---

## 3. 건드리지 않는 것

- `marketValueDepthRange` / `avgChangeRateDepthRange` / `upDownCountDepthRange`. 설정 사이드바의
  "뎁스 범위"는 문서화된 대로 현재 화면 기준 상대 depth다
- `limitDepth` 함수 자체와 완전 평탄화(`isFullyFlattened`). 결정 5는 호출부에서 넘기는 노드만 바꾼다
- `useMarketMapLayout`의 `categoryHeaderFontSize` / `categoryHeaderHeight` / paddingTop
- `CategoryChangeRatePage`(섹터 페이지). `MARKET_INDEX_REFERENCE_COLOR`만 공유하고 depth 로직은 없다

---

## 4. 작업

### 4-1. `MarketMapCategorySection.tsx`

- prop 추가: 화면 최상위(상대 depth 0)의 절대 depth. 이름은 구현자가 정한다(`depthOffset`,
  `rootAbsoluteDepth` 등). 재귀 호출에서 그대로 관통시킨다
- `CATEGORY_HEADER_COLORS`와 154행의 글자색 삼항을 결정 3의 한 표로 합치고, 인덱스는
  `depthOffset + depth`로 잡는다
- 152행 `color: depth === 0 ? MARKET_INDEX_REFERENCE_COLOR : undefined`도 절대 depth 기준으로 바꾼다
- `fontSize`, `height`는 그대로 상대 `depth`

### 4-2. `MarketMapTreemap.tsx`

- 실제 콘텐츠 렌더링(285행 근처)에 `depth` prop을 오프셋으로 넘긴다
- `outgoingSnapshotRef`를 `{ categories, depth }`로 바꾸고, `GhostOverlay`에 그 depth를 실어서 고스트
  렌더링(266행 근처)에 넘긴다

### 4-3. `MarketMapCustomPage.tsx`

- `displayNode` 계산(159행 근처)을 결정 5대로 바꾼다. `limitDepth`를 `[currentNode]`가 아니라
  `currentNode.children`에 건다
- 147행의 주석("지금 보고 있는 위치 기준으로 매번 새로 적용한다")에 "자기 자신은 헤더가 없으니 세지
  않는다"는 뜻을 덧붙인다
- `depth={path.length}`는 이미 넘어가고 있으니 그대로

---

## 5. 검증

`npm run dev`로 띄워서 지도 페이지(커스텀 모드 켬)에서 확인한다.

색 (업종 분류 레벨 제한을 끄고)

1. 전체 화면: 대분류 검정/노랑, 중분류 #333/흰색, 소분류 accent/검정
2. 대분류 하나를 클릭해서 들어간다. 중분류 헤더가 #333/흰색 그대로이고 폰트만 15px로 커진다. 소분류는
   accent/검정 그대로에 12px
3. 중분류를 클릭해서 한 단계 더 들어간다. 소분류 헤더가 accent/검정 그대로에 15px
4. 전체 화면에서 소분류 헤더를 바로 클릭한다(두 단계 건너뜀). 종목 박스만 보이고 헤더 색 문제 없음
5. 줌인·줌아웃 애니메이션 중 고스트 헤더 색이 실제 콘텐츠와 같은 규칙인지. 특히 전체→대분류 줌인 때
   페이드아웃되는 대분류 헤더가 검정/노랑을 유지하는지
6. 브레드크럼으로 되돌아왔을 때 색이 원래대로인지

업종 분류 레벨 (기본값 2 = 중분류까지)

7. 전체 화면: 대분류·중분류 헤더가 보이고 소분류는 접혀 있다(지금과 같음)
8. 대분류 안으로 들어간다. 중분류·소분류 헤더가 둘 다 보인다. 색은 각각 #333/흰색, accent/검정
9. 중분류 안으로 들어간다. 소분류 헤더가 보인다
10. 레벨을 1(대분류)로 바꾼다. 전체 화면은 대분류 헤더만, 대분류 안에서는 중분류 헤더만, 중분류
    안에서는 소분류 헤더만 보인다
11. 레벨을 끄기(0)로 바꾼다. 어느 위치에서든 헤더 없이 종목만 보인다(지금과 같음)
12. 드릴다운한 상태에서 레벨을 바꿔도 브레드크럼 경로가 끊기지 않는다

끝나면 `npm run lint`, `npm run build`. 완료 후 `docs/history.md`에 "헤더 색은 절대 depth, 크기는 상대
depth"라는 결정을 한 줄 남긴다.
