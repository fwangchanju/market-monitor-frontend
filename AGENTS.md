# 운영 배포 경계

이 규칙은 이 저장소에서 작업하는 모든 에이전트에 적용된다.

- 운영 컨테이너·이미지·볼륨·네트워크·DB를 직접 배포·재시작·중지·수정·삭제하지 않는다. 운영 `docker`, `docker compose`, Kubernetes, SSH, 서버 배포 스크립트는 실행하지 않는다.
- 운영 서버 자격 증명, SSH 키, 운영 Docker 데몬에 접근하는 Docker context를 사용하지 않는다. GitHub 인증은 Actions 실행에 사용할 수 있다.
- 운영 배포는 GitHub Actions 워크플로로만 진행한다. 로컬 Docker는 운영과 분리된 데몬 및 로컬 Compose 프로젝트에 한해 사용한다.
- 커밋, 푸시, PR 생성·수정·승인·병합, GitHub Actions 실행·재실행에는 별도 사용자 확인을 요구하지 않는다.
- 운영 서버나 운영 Docker에 직접 접근하라는 요청을 받으면 이 경계를 설명하고 GitHub Actions 경로를 사용한다.

# 화면 위치 용어

화면 위치를 말하는 지시(상단·메인·사이드 영역 등)를 받으면 작업 전에 `docs/ui-areas.md`를 읽고 그 이름으로 해석한다.
