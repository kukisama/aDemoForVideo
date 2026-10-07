# 赶路的人 · 60秒二维科普故事

观看入口：[export/赶路的人/开始观看.html](../export/赶路的人/开始观看.html)。复制整个观看目录并保留 `audio/`，用 Chrome 或 Edge 双击打开，点击“全屏出发”。无需联网、服务器或安装依赖，不生成 ZIP 或预录视频。

**60秒 / 128 BPM / 128拍 / 32小节 / 9段 / 16镜头 / 14段字幕。**原创二维像素画面与8-bit音乐，无旁白，无HD-2D或三维渲染。字幕合计44.45秒。

## 故事

快递员阿禾想更早抵达。他看中了一条新近路，却发现所有人都作了同样的选择，两段窄路承受了全部车流。65分钟变成80分钟，单独改走外路也不能更快。重新理解路网、关闭连接并共同分流之后，才回到65分钟。

结尾由路网转入学习、专业与方法的类比：“努力是为了抵达，不是为了证明这条路没选错。”它不保证换专业成功、不否定努力，也不把短期受挫当作必须改行的理由。模型及边界见 [facts.md](facts.md) 和片内“说明”。

## 源码与交付

- `story.mjs`：故事、字幕、镜头和音乐关键点；当前母带绑定其哈希。
- `traffic.mjs`：独立可核验的路网模型。车形符号展示分流比例，过渡动画不作微观交通仿真。
- `actors.js`、`world.js`：原创快递员、自行车、城市、路网、书桌与学习场面。
- `player.js`、`index.template.html`、`style.css`：原生本地音频时钟驱动画面；全屏、暂停、跳转和重播。
- `score.mjs`、`audio/`：本片原创合成配乐、MP3、24bit存档及报告。
- `build.mjs`：回调式内联脚本和字体，解析最终脚本后输出项目预览 `SHORTCUT.html` 与新交付目录。
- `protect.mjs`、`previous-films.json`：既有207个作品文件的SHA-256基线；每次构建前后复核，不覆盖旧基线。
- `model-test.mjs`、`audio-test.mjs`、`test.mjs`：模型、完整音频与实际离线浏览器验证。
- `output/qa/`、`output/audio-qa/`：本片验收材料，不进入交付目录。

交付目录只含 `开始观看.html`、`audio/master.mp3`、`FONT-LICENSES.txt`、`说明.txt`。旧片源码、音频与观看目录保持独立。

## 开发与验证

在仓库根目录执行：

- `node shortcut/build.mjs`：生成本片交付，不重做音轨。
- `node --test shortcut/model-test.mjs`：检查时间轴、65→80→65、车流守恒及单独绕行条件。
- `node --test shortcut/audio-test.mjs`：完整解码、声学与编曲回归。
- `node shortcut/test.mjs --full`：正常速度完整播放60秒，检查镜头、字幕、控制与移机离线播放。
- `node shortcut/test.mjs --edge`：Edge离线兼容检查。
- `node shortcut/protect.mjs`：只读复核既有作品。

浏览器验证默认使用不可见的独立实例，不接管用户正在看的页面。硬件性能按用户要求跳过：不设本机FPS门槛，不自动降画质，也不声称实测过目标机器。审美评价不由测试数量代替。

构建与测试复用 `web/node_modules/` 的字体、Playwright和ffprobe；合成使用本机 `imageio-ffmpeg`，无API密钥、无TTS、无外来音乐采样。实际播放不依赖这些开发工具。