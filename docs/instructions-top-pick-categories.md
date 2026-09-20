# 지시서 — 업종 톱픽: 같은 단계 카테고리 중 등락률 상위 N개를 지도에서 강조한다

이 파일 하나만 읽고 작업할 수 있게 썼다. 근거가 필요하면 인용한 코드를 직접 열어 확인하면 된다.

---

## 1. 무엇을 만드나

지도 페이지에서 "지금 어느 업종이 제일 잘 가는가"를 한눈에 보이게 한다. 설정에서 분류 단계
하나(대분류·중분류·소분류)와 개수(1~3)를 고르면, 전체 지도에서 그 단계의 카테고리 중 등락률이 가장
높은 N개를 헤더 색과 테두리로 표시한다.

```
설정: 업종 톱픽 = 중분류, 2
→ 지도 전체의 중분류 카테고리를 등락률 내림차순으로 세워서 상위 2개
→ 그 두 카테고리의 헤더를 노란 바탕 검은 글자로, 박스 테두리를 노란색으로
```

---

## 2. 확정된 결정

### 결정 1 — 설정 위치와 모양

"업종 분류 탭" 섹션에서 "업종 분류 레벨" 바로 아래, "업종 표시 지표" 위에 "업종 톱픽"을 넣는다
(`SettingsSidebar.tsx`의 `SettingsCategoryLevelSection`). 레벨 제한이 톱픽의 선택 범위를 정하니(결정
5) 레벨 다음에 오는 것이 맞다.

```
업종 분류 탭
  업종 분류 레벨
    ...
  업종 톱픽
    ○ 대분류   ● 중분류   ○ 소분류        ← 라디오, 한 줄
    끄기 ─── 1 ─── 2 ─── 3               ← SingleValueSlider
  업종 표시 지표
    ...
```

라디오는 "업종 표시 지표"의 `role="radiogroup"` 버튼 패턴을 그대로 쓰되 `flex-col`이 아니라 가로
한 줄(`flex-row`, `gap-3` 정도)로 늘어놓는다. 라벨은 `DEPTH_LABELS` 재사용.

슬라이더는 `SingleValueSlider`에 라벨 `['끄기', '1', '2', '3']`. 0칸이 끄기다. 이 페이지의 다른
슬라이더("업종 분류 레벨", "종목 박스 표기")가 전부 0칸을 끄기로 쓰고 있으니 같은 관례를 따른다.

지도 페이지에서만 의미 있는 설정이라 `showDecimalPlaces`와 같은 방식으로 `showTopPick` prop을 두고
`MarketMapCustomPage`에서만 켠다. 섹터 페이지 설정에는 안 나온다.

### 결정 2 — 상태와 기본값

`useGlobalSettings`에 두 값을 `usePersistedState`로 둔다. 다른 지도 설정과 같이 세션스토리지다.

| 키 | 값 | 기본 |
|---|---|---|
| `marketMap.topPickDepth` | 0=대분류, 1=중분류, 2=소분류 (절대 depth) | 0 |
| `marketMap.topPickCount` | 0=끄기, 1~3 | 0 |

기본은 끄기다. 렌더러가 캡처하는 텔레그램 화면에 영향을 주지 않는다. 끄기 상태에서도 라디오 선택은
저장돼 있어서 슬라이더를 올리면 바로 그 단계로 켜진다.

### 결정 3 — 순위는 전체 지도 기준, 등락률은 설정의 가중 방식을 따른다

순위 산정 대상은 필터(섹터 제외·시가총액 구간)가 반영된 전체 트리 `filteredRootNodes`에서 절대 depth가
`topPickDepth`인 카테고리 전부다. 지금 화면에 보이는 것들끼리가 아니라 지도 전체에서 뽑는다.

```
설정: 중분류 + 2. 전체 지도의 중분류 상위 2개 = 반도체(전기전자 아래), 조선(운수장비 아래)

전체 화면          반도체·조선 두 헤더가 강조
전기전자 안        반도체만 강조 (조선은 이 화면에 없음)
화학 안            강조 없음 (화학 아래 중분류는 전체 상위 2개에 못 들었음)
```

화학 안에 들어갔다고 화학 아래 중분류끼리 다시 1·2등을 뽑지 않는다. 그렇게 하면 어느 화면에서든
항상 뭔가가 강조돼서 "지도 전체에서 제일 잘 가는 업종"이라는 뜻이 사라진다.

등락률은 `avgChangeRateUseSimple`을 따른다. 토글이 "동일 가중"이면 `simpleAvgChangeRate`, "시총
가중"이면 `weightedAvgChangeRate`. 헤더 태그에 찍히는 등락률과 순위가 항상 같은 값에서 나와야 사용자가
"왜 얘가 1등이지"를 헤더 숫자만 보고 납득할 수 있다.

`FilteredMarketMapCategoryNode`의 두 평균은 null일 수 있다(스냅샷이 없는 기본 마켓맵, 신설
카테고리). 그 경우 `MarketMapCategorySection`이 하는 것과 같이 하위 전체 종목으로 그 자리에서
계산한다(`collectAllItems` + 가중/산술 평균). 그래도 종목이 없으면 순위에서 뺀다.

내림차순 정렬해서 앞 N개. 동률이면 시가총액 큰 쪽이 앞이다(트리가 이미 시가총액 순이라 안정 정렬이면
저절로 그렇게 된다).

결과는 `Set<number>`(categoryId)로 만든다. 계산은 `useMemo`로 `filteredRootNodes`,
`topPickDepth`, `topPickCount`, `avgChangeRateUseSimple`에만 반응한다.

### 결정 4 — 강조 표시

톱픽 카테고리의 `MarketMapCategorySection`은 두 가지를 바꾼다.

헤더 태그: 배경 `bg-[var(--accent)]`, 글자 `text-black`. `CATEGORY_HEADER_STYLES`가 정한 절대
depth별 색을 이 두 클래스가 덮어쓴다.

박스 테두리: `border-2 border-[var(--accent)]`. 카테고리 영역 hover에 쓰던 바로 그 스타일이다. hover
때와 같이 `zIndex`를 올려서(20) 나중에 그려지는 형제 카테고리의 테두리에 덮이지 않게 한다.

순위 숫자나 배지는 붙이지 않는다. 헤더 색과 테두리만으로 충분하다.

`isSelf`(드릴다운으로 들어온 자기 자신)는 헤더를 안 그리므로 강조도 없다. breadcrumb에 이름이 이미
있고 화면 전체가 그 카테고리다.

### 결정 5 — 업종 분류 레벨 제한보다 깊은 단계는 고를 수 없다

"업종 분류 레벨"이 중분류까지인데 톱픽을 소분류로 두면 소분류 헤더 자체가 안 그려져서 표시할 자리가
없다. "업종 표시 지표"가 `depthMetricMaxSelectableIndex`로 하는 것과 같이, 라디오 i는
`i < min(availableMaxDepth, maxDepth ?? availableMaxDepth)`일 때만 활성이다.

저장된 `topPickDepth`가 나중에 비활성 범위에 들어가면(레벨을 줄였거나 데이터가 얕아서) 값을 고치지
않고 꺼진 것으로 취급한다. `isDepthMetricRangeValid`와 같은 방식이다. 레벨을 다시 올리면 원래 값으로
돌아온다.

커스텀 모드가 아니면 이 섹션의 다른 설정과 같이 비활성(`opacity-40`, `disabled`)이고 강조도 안 한다.

---

## 3. 건드리지 않는 것

- `CATEGORY_HEADER_STYLES`와 `depthOffset`(절대 depth 색 규칙). 톱픽은 그 위에 덮어쓸 뿐이다
- `limitDepth`, 업종 표시 지표의 depth 범위, 완전 평탄화
- 섹터 페이지(`CategoryChangeRatePage`)
- 백엔드. 순위는 이미 받아둔 트리에서 프론트가 계산한다

---

## 4. 작업

### 4-1. `useGlobalSettings.ts`

- `topPickDepth`, `topPickCount` 상태(결정 2)
- 톱픽 categoryId 집합 계산(결정 3). 순위 계산 함수는 `useFilteredMarketMapTree.ts`나 새 유틸에
  두고 훅에서는 `useMemo`로 감싼다. 결정 5의 유효성 판정(비활성 범위면 빈 집합)도 여기서
- 반환값에 `topPickDepth`, `topPickCount`, `topPickMaxSelectableDepth`(라디오 활성 상한),
  `onChangeTopPickDepth`, `onChangeTopPickCount`, `topPickCategoryIds` 추가

### 4-2. `SettingsSidebar.tsx`

- `SettingsCategoryLevelSection`에 결정 1의 "업종 톱픽" 블록을 "업종 분류 레벨"과 "업종 표시 지표"
  사이에 추가. `showTopPick` prop으로 켜고 끈다
- 비활성 조건: `!isCustom || maxDepth === 0`("업종 표시 지표"와 같음). 라디오 개별 비활성은 결정 5

### 4-3. `MarketMapTreemap.tsx` → `MarketMapCategorySection.tsx`

- `topPickCategoryIds: Set<number>` prop을 추가해서 재귀 호출과 고스트 렌더링 양쪽에 관통시킨다
- `MarketMapCategorySection`에서 `topPickCategoryIds.has(category.categoryId) && !category.isSelf`면
  결정 4의 헤더 클래스와 박스 테두리·zIndex를 적용한다

### 4-4. `MarketMapCustomPage.tsx`

- `settingsModalProps`에 새 값들이 실리고, `SettingsCategoryLevelSection`에 `showTopPick`을 넘긴다
- `MarketMapTreemap`에 `topPickCategoryIds`를 넘긴다

---

## 5. 검증

`npm run dev`로 띄워서 지도 페이지(커스텀 모드 켬, 업종 분류 레벨 = 소분류까지)에서 확인한다.

1. 설정을 열면 "업종 분류 레벨" 아래에 "업종 톱픽"이 있고, 라디오 세 개가 한 줄, 그 아래 끄기/1/2/3
   슬라이더. 기본은 끄기라 지도에 강조가 없다
2. 대분류 + 2: 대분류 헤더 중 등락률 상위 2개가 노란 바탕 검은 글자, 박스 테두리 노란색. 헤더 태그에
   찍힌 등락률(업종 표시 지표 = 등락률로 두고)이 실제로 가장 높은 둘인지
3. 중분류 + 1: 전체 지도에서 중분류 하나만 강조. 그 중분류가 속한 대분류는 강조 안 됨
4. "동일 가중 ↔ 시총 가중" 토글을 바꾸면 강조 대상이 (값이 달라진다면) 따라 바뀐다
5. 중분류 + 2 상태로 대분류 하나에 들어간다. 그 안에 톱픽 중분류가 있으면 강조돼 있고, 없으면 아무것도
   강조되지 않는다. 다른 대분류에 들어가서 순위가 새로 매겨지지 않는지(전체 기준 유지)
6. 톱픽 중분류를 클릭해서 그 안에 들어간다. 자기 자신은 헤더가 없으니 강조도 없다
7. 업종 분류 레벨을 중분류로 내린다. 소분류 라디오가 비활성이 된다. 톱픽이 소분류였다면 강조가
   사라지고, 레벨을 다시 소분류로 올리면 돌아온다
8. 섹터 제외로 톱픽 카테고리를 제외하면 다음 순위가 올라온다. 시가총액 구간을 좁혀도 순위가 그 구간
   기준으로 다시 매겨진다
9. 커스텀 모드를 끄면 설정이 비활성이고 강조도 없다
10. 섹터 페이지 설정에는 "업종 톱픽"이 없다
11. 줌인·줌아웃 애니메이션 중 고스트에도 강조가 같은 규칙으로 보인다

끝나면 `npm run lint`, `npm run build`. 완료 후 `docs/history.md`에 "업종 톱픽: 전체 지도 기준 절대
depth 순위, 등락률은 가중 토글을 따름"을 한 줄 남긴다.
