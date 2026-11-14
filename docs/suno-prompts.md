# Suno 음악 만들기 / Making the music with Suno

세 곡을 Suno에서 만들어 아래 파일 이름으로 `public/assets/audio/music/` 폴더에 넣으면 앱이 자동으로 재생해요.
파일이 없으면 그 음악만 빠지고 앱은 정상 동작해요. mp3 그대로 넣으면 됩니다.

> 원작·영화·드라마의 노래나 가사는 쓰지 않아요. 아래 가사는 이 프로젝트를 위해 새로 쓴 것이에요.

---

## 1. 캠프파이어 노래 → `campfire.mp3` (2~3분)

**Style of Music** (그대로 붙여넣기)
```
acoustic campfire folk singalong, warm group of teenage voices singing together, acoustic guitar strumming, hand claps, crackling fire ambience, joyful and nostalgic, ancient greek modal flavor, live outdoor recording feel, gradual build to a big final chorus
```

**Lyrics** (Custom 모드)
```
[Verse 1]
The conch has called us home again
From arrows, swords and silver rain
The lake is gold, the hills are dark
We gather round the rising spark

[Chorus]
Sing it louder, let it climb
Half-blood hearts in summertime
Every voice will feed the flame
Gods above, they know our names

[Verse 2]
The pegasi have gone to sleep
The strawberry fields are quiet and deep
Tomorrow brings another quest
But tonight we sing, tonight we rest

[Chorus]
Sing it louder, let it climb
Half-blood hearts in summertime
Every voice will feed the flame
Gods above, they know our names

[Bridge]
(hums, clapping, the fire grows)

[Final Chorus]
Sing it louder, let it climb
Half-blood hearts in summertime
Every voice will feed the flame
Gods above, they know our names
```
가사 없이 원하면 Instrumental을 켜고 Style 끝에 `wordless humming choir, no lyrics` 를 추가하세요.

## 2. 테스트 배경음 → `quiz_bg.mp3` (2분 이상, 반복 재생됨)

**Style of Music**
```
calm ambient ancient greek lyre and harp, soft strings pad, mysterious and warm, gentle, no drums, no vocals, seamless loop, cinematic fantasy
```
Instrumental 켜기.

## 3. 인정받는 순간 → `claiming.mp3` (20~40초)

**Style of Music**
```
short mystical choir swell, ethereal female and male choir "ah", shimmering harp glissando, soft timpani, divine revelation moment, cinematic fantasy sting, ends sustained and glowing
```
Instrumental 켜기 (합창 "아~" 소리는 Style에서 나와요).

---

# Suno 효과음 만들기 / Sound effects with Suno

[sound-list.md](sound-list.md)의 효과음 14개를 Pixabay 대신 Suno로 만드는 프롬프트예요.
만든 파일은 오른쪽 이름으로 `public/assets/audio/sfx/` 폴더에 넣어주세요.

**공통으로 할 것**
- **Instrumental 켜기**, Lyrics 칸은 비우기
- Suno는 음악을 만드는 도구라 멜로디·드럼·패드를 끼워 넣으려 해요. 그래서 모든 Style 끝에 아래 줄을 붙여 두었어요.
  그래도 음악이 섞이면 **Exclude styles**(Advanced Options)에 `music, melody, drums, piano, guitar, synth pad, vocals` 를 넣고 다시 만드세요.
  ```
  no music, no melody, no instruments, no vocals, sound effect only
  ```
- 짧은 소리(소라고둥, 문, 화살, 검, 날갯짓, 말 울음)도 Suno는 최소 수십 초를 만들어요. 그대로 넣어 주시면
  제가 ffmpeg로 제일 깨끗한 한 번만 잘라내고 볼륨을 맞출게요. 어느 구간이 마음에 드는지(예: `0:12~0:18`) 같이 알려주시면 그 부분을 써요.
- 배경(ambient) 소리는 앱에서 반복 재생돼요. 1분 이상이면 충분하고, 이음매는 제가 페이드로 다듬을게요.

## 배경 소리 (반복 재생)

### 새벽 새소리 → `dawn_birds.mp3` (새벽·전체 보기 장면)
```
field recording, early morning forest dawn chorus, songbirds waking up, sparse distant chirps and trills, cool still air, quiet and peaceful, no people, no traffic, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

### 낮 새소리 → `day_birds.mp3` (훈련·페가수스 장면)
```
field recording, warm summer afternoon meadow, a few relaxed birds chirping far away, light insect hum, calm and sunny, soft and sparse, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

### 숲 바람 → `wind_forest.mp3` (모든 장면, 작게 깔림)
```
field recording, gentle steady wind through pine trees, soft rustling leaves, slow airy swells, calm, no gusts or storm, even level throughout, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

### 호수 물결 → `lake_lapping.mp3` (새벽·페가수스·저녁, 호수 쪽에서 들림)
```
field recording, calm lake shore, small water ripples lapping against a wooden dock and pebbles, slow gentle rhythm, close and intimate, no waves crashing, no wind, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

### 캠프 웅성거림 → `camp_crowd.mp3` (전체 보기·훈련·페가수스)
```
field recording, distant outdoor summer camp, many teenagers talking and laughing far away across a field, indistinct murmur, occasional faraway shout, open air, no clear words, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

### 식당 소음 → `dining_hall.mp3` (저녁, 식사 정자 쪽에서 들림)
```
field recording, outdoor dinner under an open marble pavilion, crowd of teenagers chatting over a meal, cutlery clinking on plates, cups set down on wooden tables, warm lively murmur, no clear words, no music, no melody, no instruments, no vocals, sound effect only
```

### 모닥불 → `campfire.mp3` (캠프파이어, 불 쪽에서 들림)
```
field recording, close-up crackling campfire, dry wood popping and snapping, soft roaring flames, occasional ember crackle, steady and cozy, no people, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

### 귀뚜라미 → `crickets.mp3` (저녁·캠프파이어)
```
field recording, warm summer night in the countryside, chorus of crickets chirping steadily, faint distant katydids, still air, calm and dark, no frogs, no people, natural ambience, no music, no melody, no instruments, no vocals, sound effect only
```

## 한 번 나는 소리

### 소라고둥 → `conch_horn.mp3` (새벽 기상·저녁 식사 신호, 5~10초 분량을 씀)
```
single long low conch shell horn blast, deep breathy hollow tone, one sustained note that swells and fades, echoing across an open valley at dawn, outdoor, no music, no melody, no instruments, no vocals, sound effect only
```

### 문 삐걱 → `door_creak.mp3` (새벽, 기숙사 문 열림, 2초 내외)
```
old wooden cabin door slowly creaking open, squeaky iron hinge, single creak then soft wooden knock as it stops, quiet room, close microphone, no music, no melody, no instruments, no vocals, sound effect only
```

### 화살 꽂힘 → `arrow_hit.mp3` (훈련, 활터 쪽에서 반복)
```
archery, bowstring twang, arrow whooshing through the air, sharp thud as it hits a straw target, single shot, outdoor range, crisp and close, no music, no melody, no instruments, no vocals, sound effect only
```

### 검 부딪침 → `sword_clash.mp3` (훈련, 경기장 쪽에서 반복)
```
two bronze swords clashing, one or two sharp metallic clangs with short ringing, sword fight practice, outdoor arena, close and crisp, no music, no melody, no instruments, no vocals, sound effect only
```

### 날갯짓 → `wings_flap.mp3` (페가수스, 반복)
```
huge feathered wings flapping powerfully, slow heavy wingbeats, whooshing air, large bird or winged horse taking off and flying overhead, outdoor, no music, no melody, no instruments, no vocals, sound effect only
```

### 말 울음 → `horse_neigh.mp3` (페가수스, 가끔)
```
single horse neigh, clean and clear whinny, outdoor, friendly and spirited, short, close microphone, no other animals, no music, no melody, no instruments, no vocals, sound effect only
```
