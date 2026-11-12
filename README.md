# Camp Half-Blood 시뮬레이션

퍼시 잭슨 팬 프로젝트. 캐빈 테스트를 하고, 내 캐빈에서 시작하는 캠프 하프블러드의 하루(약 10분)를 지켜봐요.
개인·비상업 팬 프로젝트이며 원작/영화의 공식 아트·음악은 사용하지 않아요.

## 실행

```bash
npm install
npm run dev
```
브라우저에서 http://localhost:5173 을 열고, 소리를 켜고 시작하세요.

## 소리 넣기
- 효과음: `docs/sound-list.md` 목록대로 받아 `public/assets/audio/sfx/`에 넣기
- 음악: `docs/suno-prompts.md` 프롬프트로 Suno에서 만들어 `public/assets/audio/music/`에 넣기
- 파일이 없으면 그 소리만 빠지고 앱은 그대로 동작해요.

## 조작
드래그로 둘러보기 · `V` 1인칭/전경 전환 · `Space` 일시정지 · `N` 다음 장면 · 우상단에서 한/EN 전환

## 개발용 바로가기
- `?god=athena&gender=female&screen=claiming` 인정 장면부터
- `?god=athena&gender=male&screen=sim&t=300` 하루의 300초 지점부터
- `?screen=debug&tod=0.7` 시간대를 고정하고 자유 시점

## 테스트
```bash
npm test
```
