// 추후 로고 등을 넣어둘 빈 최상단 바 — 어떤 프롭도 받지 않고 모든 페이지에서 항상 똑같이 고정.
export default function NavBar() {
  return <header className="sticky top-0 z-20 flex h-12 items-center bg-zinc-900 px-4 shadow-lg" />
}
