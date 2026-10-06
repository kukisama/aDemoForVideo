# vivo X500 · 让日常，自带电影感

这是一支 **60 秒的非官方发布会风格创意短片**，介绍真实上市的 **vivo X500 标准版**，没有雷军本人参与或声音克隆。几何外观是程序化示意，不是官方商品图或实拍样片。

截至 2026-10-06，片中规格已根据 [vivo 官方参数页](https://www.vivo.com.cn/vivo/param/x500)、[产品介绍](https://www.vivo.com.cn/vivo/x500/)及[发布新闻](https://www.vivo.com.cn/brand/news/detail?id=1393&type=0)核对。5499 元是 12GB+256GB 的官方建议零售价，不是实时优惠承诺；7500mAh 为典型容量，充电功率会动态调整，至高 40W 无线闪充需兼容充电器。详细条件可在播放器的资料页查看。

交付入口是 `export/X500/开始观看.html`（路径相对于仓库根目录）。交付目录完整组成：

- `开始观看.html`
- `audio/master.mp3`
- `使用说明.txt`

复制到其他机器时请保留整个 `export/X500/` 目录及其内部相对位置。双击 `开始观看.html` 即可观看；点击「全屏发布」进入全屏。无需服务器、安装依赖或联网。

项目内预览：`x500/X500.html`，引用同目录下的 `audio/master.mp3`（即 `x500/audio/master.mp3`）；不能只复制预览 HTML 而遗漏音频。源码位于 `x500/`。

画面由 HTML、CSS 3D 与 SVG 元素组成。旁白和原创合成音乐保存在本地音轨，画面随音频绝对时间运行。

播放：空格暂停／继续，左右箭头前后跳转，R 重播，F 全屏，M 静音。鼠标静止后自动隐藏播放控件。

源码：`index.template.html`、`style.css`、`film.js`。`story.mjs` 保存故事、台词和分镜；`build.mjs` 生成 HTML。音频制作脚本为 `score.mjs`，重新合成旁白需联网，观看已交付作品不需要。

## 开发与验证

开发与验证共享 `web/node_modules` 中的依赖：先进入 `web/` 执行 `npm install`，再返回仓库根目录；不要在 `x500/` 单独安装。观看交付文件或项目内预览不需要这些依赖。

以下命令从仓库根目录执行：

- `node x500/build.mjs`：生成项目内预览和交付目录。
- `node x500/test.mjs --full`：完整播放验收。
- QA 报告与截图：`x500/output/x500-qa/`。