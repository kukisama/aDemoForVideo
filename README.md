# 网页视听短片 · 项目与交付目录

各项目使用独立源码目录；**所有对外交付文件统一在根目录 `export/` 下，按项目分目录，不生成 ZIP 或视频文件。**

## 直接观看

| 项目 | 本地播放入口 | 复制到其他机器时带什么 |
|---|---|---|
| 门外·秦始皇（180 秒） | [export/秦始皇/开始观看.html](export/秦始皇/开始观看.html) | 整个 `export/秦始皇/`，保留 `audio/`；旁白版与纯配乐版音轨独立，HTML不内嵌音频 |
| 一念万物（GENESIS，30 秒） | [export/一念万物/GENESIS.html](export/一念万物/GENESIS.html) | 只需这个 HTML；脚本、样式、字体、音乐和旁白全部内嵌 |
| 知识之塔（57.6 秒） | [export/知识之塔/开始观看.html](export/知识之塔/开始观看.html) | 整个 `export/知识之塔/`，保留 `audio/` |
| X500（60 秒） | [export/X500/开始观看.html](export/X500/开始观看.html) | 整个 `export/X500/`，保留 `audio/` |
| 西部余烬（180 秒） | [export/西部余烬/开始观看.html](export/西部余烬/开始观看.html) | 整个 `export/西部余烬/`，保留 `audio/` |
| 奥德赛·无人之名（180 秒） | [export/奥德赛/开始观看.html](export/奥德赛/开始观看.html) | 整个 `export/奥德赛/`，保留 `audio/` |
| 西部2·明天以西（180 秒） | [export/西部2/开始观看.html](export/西部2/开始观看.html) | 整个 `export/西部2/`，保留 `audio/`；需要 WebGL2 |
| 赶路的人（60 秒） | [export/赶路的人/开始观看.html](export/赶路的人/开始观看.html) | 整个 `export/赶路的人/`，保留 `audio/`；二维科普故事 |

在文件管理器中双击入口 HTML，用 Chrome 或 Edge 打开，点击播放或全屏按钮。无需联网、开发服务器、Node.js 或安装依赖。浏览器要求点击后才能启动声音，这是正常行为。

一念万物仍由网页实时绘制，但**动态网页技术不等于必须运行服务器**：开发源码需要 Vite，交付 HTML 已经构建成离线单文件。采用外置音频的作品应整目录复制，保留音频的相对路径，不依赖源码目录。

## 目录组成

### 根目录

- `README.md`：本说明，负责项目索引和文件组成。
- `web/`：第一支《一念万物》的完整项目目录（沿用原目录名）。
- `feynman/`：第三支《知识之塔》的完整项目目录。
- `x500/`：第二支 X500 短片的完整项目目录。
- `rdr2/`：第四支《西部余烬》的完整项目目录。
- `odyssey/`：第五支《奥德赛·无人之名》的完整项目目录。
- `rdr2-v2/`：第六支《西部2·明天以西》的独立 HD-2D 项目；不会覆盖 `rdr2/`。
- `shortcut/`：《赶路的人》的独立60秒二维科普项目；原片均保留。
- `qin/`：《门外·秦始皇》的独立180秒第一人称二维像素史诗，见本项目的史实边界与制作说明。
- `export/`：仅放最终观看文件；每个项目一个交付目录。
- `.gitignore`：忽略依赖、构建缓存和各项目的临时验收输出，保留交付物。

### `web/` · 一念万物

- `src/`：TypeScript 播放器、时间轴、Three.js / GLSL 场景、Canvas 备用渲染及 CSS。
- `index.html`：开发页面，不是用于直接双击的交付入口。
- `public/audio/`：制作母带、旁白及音频报告；`public/film/`：场景清单。
- `scripts/`：配乐制作、音频验收、浏览器验收和性能检查。
- `tests/`：时间轴测试。
- `package.json`、`tsconfig.json`、`vite.config.ts`：依赖、类型检查与单 HTML 构建配置。
- `dist/`：本地构建中间结果；`output/web-qa/`：浏览器报告和截图；`output/qa/`：早期渲染验收资料。
- `README.md`：本项目开发与播放说明。

### `feynman/` · 知识之塔

- `story.mjs`：故事、字幕、节拍和分镜切点。
- `world.js`、`player.js`、`style.css`、`index.template.html`：二维像素画面、播放器、样式和页面模板。
- `score.mjs`、`audio/`：原创芯片音乐制作、母带和来源校验报告。
- `build.mjs`、`test.mjs`、`audio-test.mjs`：交付构建、浏览器验收和音频验收。
- `FEYNMAN.html`：项目内预览，依赖本项目的 `audio/master.mp3`；对外交付使用 `export/知识之塔/`。
- `output/feynman-qa/`：验收报告和截图。
- `README.md`、`创作复盘-知识之塔与用户偏好.md`：项目说明与创作复盘。

### `x500/` · X500

- `story.mjs`、`facts.md`：台本、字幕时序、产品事实与依据。
- `film.js`、`style.css`、`index.template.html`：HTML / CSS 3D / SVG 画面及播放器模板。
- `score.mjs`、`audio/`：音乐与旁白制作、母带、原始语音、SRT、字幕及校验报告。
- `build.mjs`、`test.mjs`、`audio-test.mjs`：交付构建、浏览器验收和音频验收。
- `X500.html`：项目内预览，依赖本项目的 `audio/master.mp3`；对外交付使用 `export/X500/`。
- `output/x500-qa/`：验收报告和截图；`README.md`：项目说明。

### `rdr2/` · 西部余烬

- `story.mjs`、`facts.md`：三分钟戏剧台本、13 幕结构、37 段字幕与官方开篇设定依据。
- `art-characters.js`、`world.js`：原创二维像素人物、动态马匹与马车、雪山、营地、河谷、城市和风暴列车。
- `player.js`、`style.css`、`index.template.html`：音频绝对时间驱动的画面、字幕及离线播放器。
- `score.mjs`、`audio/`：原创 8-bit 西部音乐、母带与验证报告，无语音或游戏原声采样。
- `build.mjs`、`test.mjs`、`audio-test.mjs`：交付构建、浏览器实播验收与音频验收。
- `WESTERN.html`：项目内预览；最终交付使用 `export/西部余烬/`。
- `output/qa/`：验收截图与报告；`README.md`：项目说明。对白均为原创改写，不是游戏原台词，不泄露主要结局。

### `odyssey/` · 奥德赛·无人之名

- `story.mjs`、`facts.md`：180秒、15幕、54镜头、43段字幕和30个动作音画标记；区分2026电影官方事实、荷马原著与原创压缩改编。
- `art-characters.js`、`world.js`：原创像素角色与关节动作、舰队、巨人、海妖、六首海兽与漩涡、风暴、宫殿和归乡海岸。
- `player.js`、`style.css`、`index.template.html`：本地音频绝对时钟、固定字幕层、全屏和开播前柔和动效设置。
- `score.mjs`、`audio/`：144BPM双主题原创器乐与动作音效，无旁白、原片录音或旋律转写。
- `build.mjs`、`test.mjs`、`visual-test.mjs`、`audio-test.mjs`：构建、实际浏览器全片实播、画面契约和完整音频信号验收。
- `ODYSSEY.html`：项目内预览；最终交付使用 `export/奥德赛/`。
- `output/qa/`：报告、逐镜截图与镜头拼图；`README.md`：开发与观看说明。本片为非官方新编像素作品，不宣称复刻电影具体剧情或结局。

### `rdr2-v2/` · 西部2·明天以西

- `story.mjs`：180 秒、7 段、24 镜头、21 段字幕，围绕三次 plan 的人物关系展开。
- `actors.mjs`、`environment.mjs`、`world.mjs`、`postfx.mjs`：独立像素角色图集、真实三维场景、光照、阴影、雾与景深。
- `player.mjs`、`style.css`、`index.template.html`：本地音频时钟、字幕、全屏与播放界面。
- `score.mjs`、`audio/`：80 BPM 原创口哨与芯片西部音乐、音景、母带与报告。
- `build.mjs`、`test.mjs`、`audio-test.mjs`：独立构建与验收；`protect-original.mjs`、`original-lock.json`：原片完整性保护。
- `WESTERN2.html`：新项目内预览；`output/qa/`：截图与验收报告；最终观看使用 `export/西部2/`。
- `README.md`、`facts.md`：开发、来源与创作边界。不是游戏原台词或正史结局，不使用其他游戏美术素材。

### `shortcut/` · 赶路的人

- `story.mjs`、`traffic.mjs`、`facts.md`：60秒、9段16镜头14段字幕，以及布雷斯悖论模型与人生类比边界。
- `actors.js`、`world.js`：快递员、自行车、城市路网和学习场面的原创二维像素画面。
- `player.js`、`style.css`、`index.template.html`：原生音频时钟、字幕与离线全屏播放器。
- `score.mjs`、`audio/`：128 BPM原创8-bit配乐、母带与报告，无旁白、无原声采样。
- `build.mjs`、`model-test.mjs`、`audio-test.mjs`、`test.mjs`：构建、路网数学、音频与离线播放验证。
- `protect.mjs`、`previous-films.json`：既有作品哈希保护；`SHORTCUT.html`：项目内预览。
- `output/qa/`、`output/audio-qa/`：验收材料；最终观看使用 `export/赶路的人/`。

### `qin/` · 门外·秦始皇

- `story.mjs`、`facts.md`：180秒、14段30镜头26段独白及逐条历史来源；身后回望明确为文学想象。
- `art.js`、`world.js`：原创768×432二维像素场景、第一视角手部与具体动作，不采用HD-2D。
- `player.js`、`style.css`、`index.template.html`：原生音频时钟、全屏、字幕、双轨切换和离线播放器。
- `score.mjs`、`audio/`：原创8-bit主题、泛用中文男声和纯配乐两版180秒音轨。
- `fonts.mjs`、`assets/`：可内嵌中文字体子集与许可；播放无需联网。
- `build.mjs`、`test.mjs`、`audio-test.mjs`：可读HTML与外置音轨构建、浏览器实播、音频解码与文件哈希校验。
- `protect.mjs`、`previous-films.json`：243个旧作品文件的保护基线；`output/`为制作与验收材料。
- `QIN.html`：项目内预览；最终入口为`export/秦始皇/开始观看.html`。

### `export/` · 无需打包的交付物

- `秦始皇/开始观看.html`、`audio/master.mp3`、`audio/music.mp3`：离线观看目录，音频不写入HTML；另附`说明.txt`及`FONT-LICENSES.txt`。
- `一念万物/GENESIS.html`：完整离线单文件。
- `知识之塔/开始观看.html`、`audio/master.mp3`、`FONT-LICENSES.txt`、`说明.txt`：离线观看目录，许可和使用说明随片交付。
- `X500/开始观看.html`、`audio/master.mp3`、`使用说明.txt`：离线观看目录。
- `西部余烬/开始观看.html`、`audio/master.mp3`、`FONT-LICENSES.txt`、`说明.txt`：离线观看目录。
- `奥德赛/开始观看.html`、`audio/master.mp3`、`FONT-LICENSES.txt`、`说明.txt`：离线观看目录。
- `西部2/开始观看.html`、`audio/master.mp3`、`FONT-LICENSES.txt`、`THIRD-PARTY-LICENSES.txt`、`说明.txt`：独立 HD-2D 观看目录。
- `赶路的人/开始观看.html`、`audio/master.mp3`、`FONT-LICENSES.txt`、`说明.txt`：独立二维科普观看目录。

这里不放源代码、依赖、测试截图或合成阶段文件。使用外置音频的作品不能只复制 HTML 而丢掉音频目录。

## 重新生成与验收

以下操作只供开发，观看交付物不需要执行。

1. 在 `web/` 中执行 `npm install`。各项目共用这里的字体、Playwright 和音频检测依赖；只影响构建与测试，不影响交付播放。
2. 一念万物：在 `web/` 执行 `npm run build`，写入 `export/一念万物/GENESIS.html`。
3. 知识之塔：在仓库根目录执行 `node feynman/build.mjs`，更新项目内预览和 `export/知识之塔/`。
4. X500：在仓库根目录执行 `node x500/build.mjs`，更新项目内预览和 `export/X500/`。
5. 西部余烬：在仓库根目录执行 `node rdr2/build.mjs`，更新项目内预览和 `export/西部余烬/`。
6. 奥德赛·无人之名：在仓库根目录执行 `node odyssey/build.mjs`，更新项目内预览和 `export/奥德赛/`。
7. 西部2·明天以西：在仓库根目录执行 `node rdr2-v2/build.mjs`，更新新项目预览和 `export/西部2/`，并核对原 `rdr2/` 与 `export/西部余烬/` 的完整哈希。
8. 赶路的人：在仓库根目录执行 `node shortcut/build.mjs`，更新本片预览和 `export/赶路的人/`，构建前后复核既有作品哈希。
9. 门外·秦始皇：在仓库根目录执行 `node qin/build.mjs`；HTML以相对路径引用`audio/`中的两条独立MP3，构建前后复核243个旧片文件。

构建不会生成压缩包，也不会覆盖其他项目的交付目录。知识之塔、X500、西部余烬、奥德赛与西部2构建前会核对台本及母带哈希；未改音轨时无需重新合成声音。

验收：在 `web/` 执行 `npm test`、`npm run test:audio`、`npm run test:web`；在仓库根目录执行 `node feynman/test.mjs --full`、`node x500/test.mjs --full`、`node rdr2/test.mjs --full`。浏览器测试直接读取 `export/` 的最终入口并断网播放；第一支还会单独复制 HTML 到临时空目录验证播放，西部余烬会复制完整观看目录验证独立运行。

播放通用快捷键：空格暂停／继续，左右键跳转，`R` 重播，`M` 静音，`F` 全屏。快速运动与强音乐请按需调整音量及柔和动效；测试机帧率不代表其他机器的性能。

奥德赛验收：`node odyssey/audio-test.mjs`、`node odyssey/visual-test.mjs --summary`、`node odyssey/test.mjs --full`；`node odyssey/test.mjs --edge` 为 Edge 离线兼容检查。最后两者均直接测试 `export/奥德赛/` 的交付入口。

西部2验收：`node rdr2-v2/test.mjs --full` 检查最终交付并加入三分钟正常速度实播，`node rdr2-v2/test.mjs --edge --quick` 做 Edge 关键镜头兼容检查；`node --test rdr2-v2/audio-test.mjs` 核验原创音轨。默认不占用桌面，不自动降低 HD-2D 画质或修改原片。

赶路的人验收：`node --test shortcut/model-test.mjs`、`node --test shortcut/audio-test.mjs`、`node shortcut/test.mjs --full`；`node shortcut/test.mjs --edge` 做 Edge 兼容检查。测试默认不占桌面，不以本机帧率作为交付门槛。

门外·秦始皇验收：`node --test qin/audio-test.mjs`、`node qin/test.mjs --full --headed`及`node qin/test.mjs --edge`。最后一项为Edge功能兼容检查，不是另一次全片实播；后台可见性观测与合成事件回归在报告中分开记录，不以测试浏览器行为替代用户目标机器。

仅验证音频交付调整：`node qin/test.mjs --delivery`及`node qin/test.mjs --delivery --edge`，短时检查外置音轨和整目录离线移机，不重复全片或逐镜截图。