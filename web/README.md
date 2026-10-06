# GENESIS · 一念万物

30 秒、128 BPM、64 拍。黑洞诞生 → 金属结构与解体 → 超光速隧道 → 粒子聚字。

**双击 `../export/一念万物/GENESIS.html`，点击「全屏播放」。**脚本、样式、字体、原创程序配乐及云希中文旁白均已内嵌；单独复制这一个文件即可播放，无需联网或服务器。

## 文件组成

- `src/`：播放器、音频时钟、时间轴、Three.js / GLSL 和 Canvas 场景及样式。
- `index.html`：Vite 开发入口，不能当作独立交付页面直接双击。
- `public/audio/`：母带、旁白及制作报告；`public/film/`：场景清单。
- `scripts/`：原创配乐制作、音频和浏览器验收、性能检查。
- `tests/`：时间轴测试。
- `vite.config.ts`：内嵌所有播放资源，并将构建结果复制到 `../export/一念万物/GENESIS.html`。
- `dist/`：构建中间结果；`output/web-qa/`：浏览器验收报告和截图；`output/qa/`：早期渲染验收资料。

## 开发与验收

在本目录执行 `npm install` 后，`npm run dev` 启动开发页面，`npm run build` 重新生成独立 HTML。此处的依赖同时供另外两个项目的构建和验收使用，不是观看时依赖。

`npm test` 检查时间轴；`npm run test:web` 在可见 Chrome 中断网打开最终交付 HTML，验证完整 30 秒播放、全屏、跳转及两条渲染路径，并将 HTML 单独复制到临时空目录复验播放；`npm run test:audio` 核验母带。

常规硬件使用 Three.js / GLSL，检测到软件 GPU 时才使用 Canvas 向量绘制路径。场景统一由音频绝对时间驱动；低帧率不会累计时序偏差。测试机性能不能代表实体机器性能。

音频制作脚本 `scripts/score.mjs` 可重现母带；重新制作旁白需要 Python 的 `edge-tts` 与 `imageio-ffmpeg`。观看已有 HTML 不需要这些工具。

## 播放

空格暂停，左右键跳转，`R` 重播，`M` 静音，`F` 全屏。全屏时静止鼠标一秒隐藏控件，移动鼠标恢复。含快速运动和短暂强光；可在页脚启用「柔光」。