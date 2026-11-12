# Camp Half-Blood 시뮬레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 도는 팬 시뮬레이션. 성별 선택 → 12문항 캐빈 테스트 → claiming 연출 → 소속 캐빈에서 시작하는 약 10분짜리 캠프 하프블러드의 하루(오버뷰 ↔ 1인칭).

**Architecture:** Vite + 바닐라 JS ES 모듈. 화면 흐름은 작은 상태 머신(`src/app.js`)이 DOM 화면(시작/테스트/엔딩)과 Three.js 장면(claiming/시뮬레이션)을 전환한다. 순수 로직(i18n, 점수 계산, 타임라인)은 DOM·WebGL과 분리해 Vitest로 테스트하고, 3D·소리는 브라우저 미리보기 스크린샷과 콘솔로 검증한다.

**Tech Stack:** Node 24, Vite 6, three 0.17x (examples: `Sky`, `Water`, `OrbitControls`), Vitest 3 + jsdom, Web Audio API.

**Spec:** `docs/2026-11-12-halfblood-camp-design.md` — 각 태스크 전에 해당 절을 읽을 것.

## Global Constraints

- 언어: 모든 사용자 노출 문구는 `ko`/`en` 두 벌. 기본 `ko`. 신·캐빈 이름은 영어 병기.
- 결과 후보: Zeus(1), Poseidon(3), Demeter(4), Ares(5), Athena(6), Apollo(7), Artemis(8, "사냥꾼 합류"), Hephaestus(9), Aphrodite(10), Hermes(11), Dionysus(12). **Hera(2)는 결과에 절대 안 나옴.** 성별 `male`이면 Artemis 제외.
- 시뮬레이션 총 길이 600초. 장면 경계: 0 / 90 / 150 / 300 / 390 / 480 / 600초 (dawn, overview, training, pegasus, dinner, campfire).
- 원작/영화 공식 아트·로고·노래 가사 사용 금지. 캠프파이어 노래는 새 가사.
- 게임 요소(점수 표시, WASD 이동, 퀘스트) 없음. 1인칭은 마우스로 고개만 돌림.
- UI는 화면 구석에 최소로, 3초간 마우스 무동작 시 숨김.
- 데스크톱 우선, 목표 60fps / 최소 30fps. `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`.
- 소리는 첫 사용자 클릭 이후에만 시작 (자동재생 정책).
- 효과음은 무료 실제 녹음(Pixabay 등) — **각 파일 다운로드 전 사용자에게 파일명·출처 보여주고 확인받기.** 음악은 사용자가 Suno로 생성.
- `localStorage` 접근은 모두 try/catch.

## Review Focus

1. **오디오 파일 누락/로드 실패** — 일부 음원이 아직 없거나 404여도 앱이 멈추지 않고 그 소리만 조용히 빠져야 한다. (Task 11 테스트)
2. **테스트 도중 언어 전환** — 이미 고른 답과 현재 문항 번호가 유지되고 문구만 바뀌어야 한다. (Task 4 테스트)
3. **탭 전환·창 크기 변경** — 탭이 숨겨지면 타임라인이 멈추고 돌아오면 이어서 재생, 리사이즈 시 카메라 비율이 맞아야 한다. (Task 9 테스트 + Task 12 수동 확인)
4. **프라이빗 창 등 localStorage 차단** — 언어 기억 실패해도 기본값으로 정상 동작. (Task 2 테스트)
5. **동점 및 특정 신 쏠림** — 어떤 답 조합이든 정확히 한 신이 나오고, 무작위 응답 시 특정 신이 지나치게 많이 나오지 않아야 한다. (Task 3 테스트)

---

## File Structure

```
index.html
package.json, vite.config.js
.claude/launch.json                 # 미리보기 서버 (npm run dev, port 5173)
src/
  main.js                           # 진입점: app 시작
  app.js                            # 화면 상태 머신
  styles.css
  i18n/strings.js                   # { ko: {...}, en: {...} }
  i18n/i18n.js                      # t(), setLang(), getLang(), onLangChange()
  quiz/gods.js                      # GODS 데이터 (id, cabin, 색, 이름, 설명 키)
  quiz/questions.js                 # 12문항 (텍스트 키 + 선택지별 가중치)
  quiz/scoring.js                   # scoreQuiz()
  ui/langToggle.js, ui/startScreen.js, ui/quizScreen.js, ui/hud.js, ui/endScreen.js
  three/renderer.js                 # 공용 renderer/scene/resize 루프
  three/symbols.js                  # 신별 상징 메시 (claiming용)
  three/player.js                   # "나" 캐릭터 (gender별 실루엣)
  three/claimingScene.js
  sim/timeline.js                   # SCENES, sceneAt(), timeOfDayAt()
  sim/world/sky.js, terrain.js, lake.js, forest.js
  sim/world/cabins.js               # buildCabin(godId, {interior})
  sim/world/facilities.js           # 빅하우스, 파빌리온, 아레나, 활쏘기장, 마구간, 원형극장, 탈리아의 소나무
  sim/actors/campers.js, pegasus.js
  sim/cameras.js                    # overview(시네마틱+드래그) / firstPerson
  sim/director.js                   # 시간 → 장면·조명·배우·카메라·소리 구동
  audio/manifest.js                 # 소리 id → 파일, 레이어, 장면, 위치
  audio/engine.js                   # 로드, 크로스페이드, 위치 소리, 음소거
assets/audio/sfx/, assets/audio/music/, assets/audio/CREDITS.md
docs/suno-prompts.md
tests/*.test.js
```

---

### Task 1: 프로젝트 뼈대

**Files:** Create `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/styles.css`, `.claude/launch.json`, `.gitignore`, `tests/smoke.test.js`

**Interfaces:** Produces `npm run dev` (port 5173), `npm test` (vitest run, jsdom 환경).

- [ ] **Step 1:** `git init`, `npm init -y`, `npm i three`, `npm i -D vite vitest jsdom`. scripts: `dev: vite`, `build: vite build`, `test: vitest run`. `vite.config.js`에 `test: { environment: 'jsdom' }`.
- [ ] **Step 2:** `tests/smoke.test.js` — `expect(1+1).toBe(2)`. Run `npm test` → PASS.
- [ ] **Step 3:** `index.html`에 `<div id="app">`, `<canvas id="stage">`; `styles.css`에 색 토큰(`--marble:#f3efe6`, `--gold:#c9a24a`, `--camp-orange:#f28c28`, `--ink:#1d1b18`), 폰트 Cinzel(제목) + Noto Sans KR(본문) Google Fonts.
- [ ] **Step 4:** `.claude/launch.json` (`npm run dev`, port 5173) 만들고 `preview_start`로 빈 페이지가 에러 없이 뜨는지 콘솔 확인.
- [ ] **Step 5:** Commit `chore: scaffold vite + three project`.

### Task 2: i18n + 언어 토글

**Files:** Create `src/i18n/strings.js`, `src/i18n/i18n.js`, `src/ui/langToggle.js`, `tests/i18n.test.js`

**Interfaces:**
- Produces: `t(key: string, vars?: object) => string` (`{name}` 치환, 없는 키는 키 자체 반환 + console.warn), `getLang() => 'ko'|'en'`, `setLang(lang)` (localStorage `chb.lang` 저장, 리스너 호출), `onLangChange(fn) => unsubscribe`, `mountLangToggle(parentEl)`.

- [ ] **Step 1: 실패하는 테스트**
  - `every key in strings.ko exists in strings.en and vice versa` (키 집합 동일)
  - `t returns ko by default` 
  - `setLang('en') switches and notifies listener once`
  - `t('missing.key') returns 'missing.key'`
  - `works when localStorage throws` — `localStorage.getItem/setItem`을 throw하도록 mock해도 `setLang('en')`, `getLang()==='en'`
- [ ] **Step 2:** Run `npm test` → FAIL.
- [ ] **Step 3:** 구현. 모듈 로드 시 저장값 읽기(try/catch). 토글은 `한 / EN` 두 버튼, 현재 언어 강조.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: bilingual i18n with toggle`.

(문구는 이후 태스크가 각자 필요한 키를 `strings.js`에 추가한다. i18n 테스트가 양쪽 언어 누락을 계속 잡아준다.)

### Task 3: 신 데이터 + 문항 + 점수 계산

**Files:** Create `src/quiz/gods.js`, `src/quiz/questions.js`, `src/quiz/scoring.js`, `tests/scoring.test.js`; Modify `src/i18n/strings.js`

**Interfaces:**
- Produces:
  - `GODS: Array<{ id: 'zeus'|'poseidon'|'demeter'|'ares'|'athena'|'apollo'|'artemis'|'hephaestus'|'aphrodite'|'hermes'|'dionysus', cabin: number, color: string, nameKey: string, descKey: string }>` (Hera는 GODS에 없음; Hera 캐빈 외관은 Task 7에서 별도 처리)
  - `QUESTIONS: Array<{ id: string, textKey: string, options: Array<{ textKey: string, weights: Partial<Record<GodId, number>> }> }>` — 12문항 × 4선택지, 가중치 1~3, 선택지당 1~3신
  - `scoreQuiz(answers: number[], gender: 'male'|'female') => GodId` (answers[i] = 문항 i의 선택지 인덱스)
  - `scoreBreakdown(answers, gender) => Record<GodId, number>`

- [ ] **Step 1: 실패하는 테스트**
  - `QUESTIONS has 12 questions with 4 options each`
  - `every god in GODS appears in weights at least 4 times across all options` (균형)
  - `hera never appears` — GODS·weights 어디에도 `'hera'` 없음
  - `male never gets artemis` — artemis 가중치가 가장 큰 선택지만 고른 answers로 `scoreQuiz(a,'male') !== 'artemis'`, 같은 answers `scoreQuiz(a,'female') === 'artemis'`
  - `each god is reachable` — 각 신마다 그 신 가중치가 최대인 선택지를 고른 answers → 그 신 (female 기준)
  - `tie-break favors later questions` — 두 신 동점이 되도록 만든 answers에서 마지막 문항이 가리킨 신이 선택됨
  - `random answers are reasonably spread` — 시드 고정 난수로 5000회, 어떤 신도 비율 > 25% 아님, 모든 신 > 2%
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 데이터 작성. 성향 키워드는 spec 4절 표. 문항은 상황형(예: "퀘스트에 한 명만 데려갈 수 있다면?", "자유 시간에 가장 먼저 가는 곳은?")으로, 문구는 ko/en 모두 `strings.js`에. 동점 처리: 문항 i의 가중치에 `1 + i*0.01`를 곱해 합산(뒤 문항이 미세하게 우세) 후 최댓값; 그래도 같으면 GODS 순서.
- [ ] **Step 4:** Run → PASS. 분포 테스트가 실패하면 가중치를 조정(테스트 수정 금지).
- [ ] **Step 5:** Commit `feat: cabin quiz data and scoring`.

### Task 4: 시작 화면(성별) + 테스트 화면 + 앱 흐름

**Files:** Create `src/app.js`, `src/ui/startScreen.js`, `src/ui/quizScreen.js`, `tests/quizScreen.test.js`; Modify `src/main.js`, `src/styles.css`, `src/i18n/strings.js`

**Interfaces:**
- Consumes: `t`, `onLangChange`, `mountLangToggle`, `QUESTIONS`, `scoreQuiz`.
- Produces:
  - `app.go(state: 'start'|'quiz'|'claiming'|'sim'|'end', payload?)`; 공유 상태 `app.state = { gender, answers, godId }`
  - `mountStartScreen(el, { onStart(gender) })`
  - `mountQuizScreen(el, { onDone(answers) }) => { destroy() }`

- [ ] **Step 1: 실패하는 테스트** (jsdom)
  - `start button disabled until gender picked`
  - `answering 12 questions calls onDone with 12 indices`
  - `switching language mid-quiz keeps current question index and answers` — 3문항 답한 뒤 `setLang('en')` → 4번째 문항이 영어로, 이후 완료 시 answers 앞 3개 유지
  - `back button returns to previous question with its answer selected`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. 시작 화면: 제목 "Camp Half-Blood", 안내 문구, 남/여 카드 두 개(실루엣 아이콘), 시작 버튼. 테스트 화면: 얇은 진행 바, 문항, 4개 선택지 카드, 이전 버튼. 배경은 잔잔한 그라데이션(대리석·금빛). 언어 토글 항상 우상단. 테스트 완료 → `app.go('claiming')`.
- [ ] **Step 4:** Run → PASS. 미리보기에서 시작→12문항→완료까지 클릭 확인, 스크린샷.
- [ ] **Step 5:** Commit `feat: gender start screen and quiz flow`.

### Task 5: 공용 3D 렌더러 + "나" 캐릭터 + claiming 장면

**Files:** Create `src/three/renderer.js`, `src/three/player.js`, `src/three/symbols.js`, `src/three/claimingScene.js`, `tests/symbols.test.js`; Modify `src/app.js`, `src/i18n/strings.js`

**Interfaces:**
- Produces:
  - `createStage(canvas) => { renderer, setScene(scene, camera), onFrame(fn(dt, elapsed)), dispose() }` — 리사이즈 시 camera.aspect 갱신, pixelRatio 상한 1.5, `document.hidden`이면 onFrame 콜백에 `dt=0`
  - `createPlayer(gender) => THREE.Group` — 높이 1.7m, 주황 티셔츠·청바지. male: 짧은 머리·넓은 어깨, female: 포니테일·좁은 어깨. 자식 이름 `hair`, `body`. `player.userData.setPose('idle'|'walk'|'sit'|'drawBow')`
  - `createSymbol(godId) => THREE.Object3D` — 발광(emissive) 상징: zeus 번개, poseidon 삼지창, demeter 밀 이삭, ares 창, athena 부엉이, apollo 태양, artemis 초승달+활(은색), hephaestus 망치, aphrodite 비둘기, hermes 카두케우스, dionysus 포도덩굴. 단순 지오메트리 조합 또는 SVG 경로 `ExtrudeGeometry`
  - `runClaiming(stage, { godId, gender, onContinue })`
- [ ] **Step 1: 실패하는 테스트** — `createSymbol returns an object for every GODS id`, `createSymbol('hera') throws`, `createPlayer('male') and ('female') differ in hair mesh geometry`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. claiming 장면: 밤, 모닥불(주황 PointLight 깜빡임 + 불꽃 파티클), 둘러앉은 캠퍼 실루엣 몇 명, "나"의 뒷모습 클로즈업 → 머리 위로 상징이 천천히 떠오르며 빛남 → 화면 하단에 신 이름 / 캐빈 번호 / 설명 + "캠프로 들어가기" 버튼. artemis는 은빛 달빛 연출 + "아르테미스의 사냥꾼에 합류했다".
- [ ] **Step 4:** Run tests → PASS. 미리보기에서 male/female × 2~3개 신으로 스크린샷 확인 (뒷모습이 구분되는지).
- [ ] **Step 5:** Commit `feat: claiming scene with gendered player silhouette`.

### Task 6: 타임라인 + 시간대 환경 (하늘·지형·호수·숲)

**Files:** Create `src/sim/timeline.js`, `src/sim/world/sky.js`, `terrain.js`, `lake.js`, `forest.js`, `tests/timeline.test.js`

**Interfaces:**
- Produces:
  - `SCENES: Array<{ id: 'dawn'|'overview'|'training'|'pegasus'|'dinner'|'campfire', start: number, end: number, captionKey: string }>` (경계 Global Constraints 값)
  - `TOTAL = 600`
  - `sceneAt(t: number) => Scene` (t<0 → dawn, t≥600 → campfire)
  - `timeOfDayAt(t) => number` (0..1 하루 진행; 0 = 새벽 5:30, 0.5 = 정오 무렵, 1 = 밤 22시). 장면별 매핑: dawn 0–0.08, overview 0.08–0.15, training 0.15–0.45, pegasus 0.45–0.6, dinner 0.6–0.78, campfire 0.78–1
  - `createSky(scene) => { update(tod) }` — three `Sky` + 태양 방향/색, 안개 색·밀도, 밤엔 별 Points + 달
  - `createTerrain(scene) => { heightAt(x,z) }`, `createLake(scene, renderer)` (three `Water`, 아침 안개), `createForest(scene, terrain)` (InstancedMesh 소나무/참나무 ≥ 800그루)
- [ ] **Step 1: 실패하는 테스트** — `SCENES are contiguous and cover 0..600`, `sceneAt(0)=dawn, sceneAt(89.9)=dawn, sceneAt(90)=overview, sceneAt(599)=campfire, sceneAt(-5)=dawn, sceneAt(700)=campfire`, `timeOfDayAt is monotonic non-decreasing`, `timeOfDayAt(0)=0 and timeOfDayAt(600)=1`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. 임시 디버그 슬라이더(`?debug=1`일 때만)로 tod를 움직여 볼 수 있게.
- [ ] **Step 4:** Tests PASS. 미리보기에서 tod 0 / 0.3 / 0.7 / 0.95 스크린샷: 새벽 안개 낀 호수, 한낮, 황금빛 해 질 녘, 별 뜬 밤이 구분되는지.
- [ ] **Step 5:** Commit `feat: timeline and time-of-day environment`.

### Task 7: 캐빈 12채 + 캠프 시설

**Files:** Create `src/sim/world/cabins.js`, `src/sim/world/facilities.js`, `tests/cabins.test.js`

**Interfaces:**
- Consumes: `createTerrain().heightAt`, `GODS`.
- Produces:
  - `CABIN_IDS = ['zeus','hera','poseidon','demeter','ares','athena','apollo','artemis','hephaestus','aphrodite','hermes','dionysus']` (캐빈 1~12 순서)
  - `buildCabin(id, { interior: boolean }) => THREE.Group` — `group.userData = { doorWorld: Vector3, windowWorld: Vector3, bedWorld: Vector3, soundAnchor: Vector3 }`
  - `layoutCabins(scene, terrain, { interiorFor: GodId }) => Map<id, Group>` — Ω(U자) 배치, 가운데 잔디 광장
  - `createFacilities(scene, terrain) => { anchors: { archery, arena, stables, pavilion, amphitheater, bigHouse, dock, thaliaPine } }` (각 Vector3)
- [ ] **Step 1: 실패하는 테스트** — `buildCabin works for all 12 ids`, `interior:true adds a child named 'interior'`, `cabin footprints in layoutCabins do not overlap` (bounding box 교차 없음), `facilities anchors are all defined`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. 외관·내부는 spec 5절 "캐빈별 디자인" 표를 그대로 따른다 (제우스 흰 대리석+청동문, 포세이돈 조개 박힌 회색 돌, 데메테르 잔디 지붕+덩굴, 아레스 빨간 페인트+철조망+멧돼지 머리, 아테나 은회색+부엉이, 아폴론 금빛(메탈릭), 아르테미스 은빛(달빛 시 발광), 헤파이스토스 굴뚝+톱니, 아프로디테 분홍+화분, 헤르메스 낡은 갈색, 디오니소스 포도덩굴 보라, 헤라 흰 건물+공작 깃털). 내부는 배정 캐빈만: 창문(밖으로 호수가 보이게 배치), 침대, 신별 소품. 시설: 빅하우스(파란 4층 농가), 식당 파빌리온(대리석 기둥, 지붕 없음, 화로), 검술 아레나, 활쏘기장(과녁), 페가수스 마구간, 원형극장+모닥불, 언덕 위 소나무+황금 양털, 선착장.
- [ ] **Step 4:** Tests PASS. 미리보기 오버뷰 스크린샷 + 캐빈 클로즈업 4~5장으로 개성이 구분되는지 확인.
- [ ] **Step 5:** Commit `feat: twelve distinct cabins and camp facilities`.

### Task 8: 캠퍼 + 페가수스

**Files:** Create `src/sim/actors/campers.js`, `src/sim/actors/pegasus.js`, `tests/campers.test.js`

**Interfaces:**
- Consumes: `createPlayer` 체형 코드 재사용(캠퍼도 같은 빌더에 색·머리 변형), facilities anchors, `SCENES`.
- Produces:
  - `createCampers(scene, anchors, count=40) => { update(dt, sceneId, sceneProgress) , list }` — 각 캠퍼는 장면별 목표 지점으로 걸어감: dawn=캐빈 문 앞, overview=광장 산책, training=활쏘기장/아레나(활 쏘기·검 휘두르기 포즈), pegasus=마구간·호숫가 구경, dinner=파빌리온 테이블 착석, campfire=원형극장 착석
  - `createPegasi(scene, anchors, count=4) => { update(dt, sceneId, t) }` — 흰 몸 + 깃털 날개(겹친 깃털 판 + 날갯짓 사인 애니메이션), pegasus 장면에서 호수 위 원형 비행 경로, 그 외엔 마구간 근처 대기
- [ ] **Step 1: 실패하는 테스트** — `campers target positions per scene come from anchors` (`targetFor(camper, 'dinner')`가 pavilion 반경 15m 이내), `pegasus flight path stays above terrain height + 3m` (샘플 100점).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. 걸음은 다리·팔 흔들기 사인 애니메이션, 위치는 목표로 선형 보간 + 약간의 지연으로 자연스럽게 흩어짐. dinner 장면 전반부에는 캠퍼들이 한 명씩 파빌리온 화로로 가서 음식을 바치는 동작(화로 불꽃이 잠깐 커짐) 후 자리로 돌아간다.
- [ ] **Step 4:** Tests PASS. 미리보기 각 장면 스크린샷.
- [ ] **Step 5:** Commit `feat: campers and pegasi`.

### Task 9: 카메라 + 디렉터 (하루 재생)

**Files:** Create `src/sim/cameras.js`, `src/sim/director.js`, `tests/director.test.js`; Modify `src/app.js`

**Interfaces:**
- Consumes: 모든 world/actors 빌더, `sceneAt`, `timeOfDayAt`.
- Produces:
  - `createCameras(renderer, player) => { mode: 'overview'|'first', setMode(m), update(dt, sceneId, sceneProgress), camera }` — overview: 장면별 시네마틱 경로(dawn: 캐빈 내부 창가 → 문 → 위로 빠져 캠프 전경; 이후 장면별 대상 주변 천천히 선회), 드래그 시 OrbitControls 수동, 손 뗀 뒤 2초 후 1.5초에 걸쳐 시네마틱으로 복귀. first: 플레이어 머리 높이(1.6m), 마우스로 yaw ±120°/pitch ±60°, 모드 전환은 1초 보간
  - `createDirector({ stage, gender, godId, audio }) => { play(), pause(), isPaused(), skipToNextScene(), elapsed(), onSceneChange(fn), onEnd(fn) }` — 매 프레임 elapsed += dt(일시정지·탭 숨김 시 0), sky/actors/cameras/audio 갱신, 600초 도달 시 onEnd
- [ ] **Step 1: 실패하는 테스트** (three 렌더 없이 가짜 stage 주입) — `skipToNextScene from 100s jumps to 150`, `skip during campfire ends`, `paused director does not advance`, `hidden tab (dt=0) does not advance`, `onSceneChange fires once per boundary in order dawn→campfire`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. 플레이어("나")는 배정 캐빈 침대에서 시작해 일정에 따라 캠퍼들과 같은 목표로 이동. campfire 장면 동안 모닥불 크기·밝기가 노래와 함께 점점 커지고 색이 주황 → 금빛 → 보랏빛으로 천천히 변한다 (원작 설정).
- [ ] **Step 4:** Tests PASS. 미리보기에서 claiming → 시뮬레이션 진입, 첫 90초 dawn 시퀀스(창밖 호수) 스크린샷, 1인칭 전환 확인.
- [ ] **Step 5:** Commit `feat: director, cinematic and first-person cameras`.

### Task 10: HUD + 엔딩

**Files:** Create `src/ui/hud.js`, `src/ui/endScreen.js`, `tests/hud.test.js`; Modify `src/app.js`, `src/i18n/strings.js`, `src/styles.css`

**Interfaces:**
- Consumes: director API, cameras.setMode, audio engine `setVolume/mute`, `mountLangToggle`.
- Produces: `mountHud(el, { director, cameras, audio }) => { destroy() }`, `mountEndScreen(el, { onReplay, onRetake })`.
- [ ] **Step 1: 실패하는 테스트** — `hud hides after 3s of no mousemove and shows on move` (fake timers), `scene caption shows captionKey text on scene change then fades after 4s`, `view button toggles cameras mode`, `V key toggles view, Space toggles pause`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 구현. 우하단: 시점 전환 / 재생·일시정지 / 다음 장면 / 음량 슬라이더+음소거. 우상단: 언어 토글. 장면 자막은 하단 중앙 (예: "Morning · 소라고둥이 울린다"). 엔딩: 별 하늘 위에 "다시 보기 / 테스트 다시 하기".
- [ ] **Step 4:** Tests PASS. 미리보기 확인.
- [ ] **Step 5:** Commit `feat: minimal HUD and ending screen`.

### Task 11: 오디오 엔진 + 음원

**Files:** Create `src/audio/manifest.js`, `src/audio/engine.js`, `assets/audio/CREDITS.md`, `docs/suno-prompts.md`, `tests/audio.test.js`; Modify `src/sim/director.js`, `src/three/claimingScene.js`, `src/ui/quizScreen.js`

**Interfaces:**
- Produces:
  - `SOUNDS: Array<{ id, file, kind: 'ambient'|'oneshot'|'music', scenes?: SceneId[], loop?: boolean, volume: number, position?: 'cabin'|'archery'|'arena'|'stables'|'pavilion'|'amphitheater'|'lake', at?: number /* oneshot 장면 내 초 */ }>`
  - `createAudio() => { unlock(): Promise, load(sounds): Promise<{loaded: string[], failed: string[]}>, setScene(sceneId, fadeSec=4), playOneShot(id), playMusic(id, {fade}), setListener(camera), setVolume(v), mute(bool) }`
- [ ] **Step 1: 실패하는 테스트** (AudioContext mock) — `load reports failed files without throwing` (fetch 404 mock → failed에 포함, 나머지 loaded), `playOneShot on a failed id is a no-op`, `setScene fades out ambients not in scene and fades in ones that are`, `every SOUNDS entry has a CREDITS.md line or is under music/`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** 엔진 구현. 시작 화면의 첫 클릭에서 `unlock()`. 위치 소리는 PannerNode(HRTF)를 시설 anchor에 배치, 리스너는 현재 카메라.
- [ ] **Step 4: 효과음 수집** — spec 6절 목록(소라고둥, 새벽 새소리, 호수 물결, 바람/숲, 웅성거림, 발소리, 활시위·화살, 검 부딪침, 날갯짓, 말 울음, 식당 소음, 모닥불, 귀뚜라미·밤, claiming 연출음)마다 Pixabay 등 무료 라이선스 후보를 찾고, **사용자에게 파일명·출처·길이를 묶어서 보여주고 확인받은 뒤** `assets/audio/sfx/`에 받는다. ffmpeg로 mp3 → ogg/m4a 정규화(-16 LUFS), 루프용은 끝 크로스페이드. 출처·라이선스를 `CREDITS.md`에 기록. 날갯짓은 큰 새 날갯짓을 ffmpeg로 피치 다운(`asetrate`)해 만든다.
- [ ] **Step 5: Suno 프롬프트** — `docs/suno-prompts.md`에 곡 3개(캠프파이어 노래 + 새 가사 ko/en 중 하나 또는 허밍, 테스트 배경음, claiming 스팅)의 스타일 프롬프트·길이·저장 파일명(`assets/audio/music/campfire.mp3`, `quiz_bg.mp3`, `claiming.mp3`) 작성. 사용자가 생성해 넣기 전까지 앱은 음악 없이 정상 동작해야 함.
- [ ] **Step 6:** Tests PASS. 미리보기에서 콘솔에 오디오 에러 없음, 장면 전환 시 소리가 바뀌는지 직접 들어보도록 사용자에게 요청(Claude는 청취 불가).
- [ ] **Step 7:** Commit `feat: layered positional audio with credited sfx`.

### Task 12: 통합 점검 + 성능

**Files:** Modify as needed.

- [ ] **Step 1:** `npm test` 전부 PASS.
- [ ] **Step 2:** 미리보기에서 전체 흐름 1회: 시작(여) → 테스트 → claiming → 10분(다음 장면 버튼으로) → 엔딩 → 테스트 다시 하기(남). 콘솔 에러 0.
- [ ] **Step 3:** fps 측정(`renderer.info` + rAF 간격) — 오버뷰 캠프 전경에서 평균 ≥ 50fps 목표. 미달 시: 나무 인스턴스 수, 그림자 맵 크기(2048→1024), Water 반사 해상도 순으로 낮춘다.
- [ ] **Step 4:** 탭 숨김 후 복귀 시 이어서 재생, 창 리사이즈 시 비율 정상, 언어 전환이 모든 화면에서 동작하는지 확인.
- [ ] **Step 5:** `npm run build` 성공 확인. README.md에 실행 방법(`npm install`, `npm run dev`)과 Suno 음악 넣는 법 3줄.
- [ ] **Step 6:** Commit `chore: integration pass and performance tuning`.
