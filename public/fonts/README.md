# Fonts

[Pretendard](https://github.com/orioncactus/pretendard) (SIL Open Font License 1.1) 9단계 굵기 파일을
전부 받아뒀다. 한글/라틴/숫자 전부 단일 패밀리로 커버하는 전체 화면 기본 폰트다.

| 파일 | 굵기 | `src/index.css`에서 활성화 |
|---|---|---|
| `pretendard-thin.woff2` | 100 | 아니오 |
| `pretendard-extralight.woff2` | 200 | 아니오 |
| `pretendard-light.woff2` | 300 | 아니오 |
| `pretendard-regular.woff2` | 400 | 예 |
| `pretendard-medium.woff2` | 500 | 예 |
| `pretendard-semibold.woff2` | 600 | 아니오 |
| `pretendard-bold.woff2` | 700 | 예 |
| `pretendard-extrabold.woff2` | 800 | 아니오 |
| `pretendard-black.woff2` | 900 | 아니오 |

굵기를 자잘하게 바꿀 일이 계속 생길 것 같아서, 파일은 미리 다 받아두고 실제로 쓰는 굵기(지금은
400/500/700)만 `index.css`에서 `@font-face`로 활성화한다. 새 굵기가 필요해지면 파일을 다시 받을
필요 없이 `index.css`에 이미 있는 해당 굵기의 주석 처리된 `@font-face` 블록만 풀면 된다.

400을 활성화했으므로 `font-normal`로 명시한 곳과 굵기 클래스를 아예 안 준 기본 텍스트는 이제 진짜
regular로 그려진다. 예전 지마켓 산스는 300/500/700만 있어서 400 요청이 500으로 자동 매핑됐었는데
(그래서 한동안 이 프로젝트도 400을 일부러 비활성 상태로 뒀었다), 지금은 그 매핑에 기대지 않는다.

`font-family: "Pretendard", "Noto Sans KR", system-ui, sans-serif`로 사용한다.
