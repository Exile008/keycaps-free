# 部署到 GitHub Pages / Deploy to GitHub Pages

本工具是纯静态网页（HTML + ES 模块 + WASM），无需服务器端，可直接用 GitHub Pages 免费托管。

## 一次性设置
1. 在 GitHub 新建仓库（如 `keycaps-free`），公开或私有均可（私有仓库的 Pages 需付费账户）。
2. 在本文件夹执行：
   ```powershell
   git init
   git add .
   git commit -m "Keycap generator v1"
   git branch -M main
   git remote add origin https://github.com/Exile008/keycaps-free.git
   git push -u origin main
   ```
3. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
4. 推送后 Actions 会自动：运行核心测试 → 只打包运行所需文件（index.html、css、js、vendor、fonts）→ 发布。
   访问地址：`https://Exile008.github.io/keycaps-free/`

之后每次 `git push`，网站自动更新；测试不通过则不会发布。

## 注意
- 所有路径都是相对路径，可在子路径 `/keycaps-free/` 下运行；GitHub Pages 会以正确的 `application/wasm` 类型提供 manifold.wasm。
- `logs/`、`.omo/`、`.codegraph/` 等本地 agent 状态已在 `.gitignore` 中排除；`docs/`、`tasks/` 会进仓库但不会被发布到网站。
- 许可证：自带依赖均允许再分发 —— three.js / opentype.js / fflate (MIT)、manifold-3d (Apache-2.0)、字体 (SIL OFL 1.1)，各自 LICENSE 已在 `vendor/`、`fonts/` 中。
  本项目代码为独立实现，未复制 vostoklabs 原项目源码（其为 CC BY-NC-ND）；README 中保留了致谢。请为你自己的代码选择一个许可证（例如 MIT）并添加 `LICENSE` 文件。
- 本地离线使用不受影响，仍可用 `start.bat`。
- 缓存：GitHub Pages 让浏览器把每个文件缓存 10 分钟，发布后浏览器可能混用新旧 JS 模块（例如新 main.js 配旧 keycap.js）。为避免这种情况，发布时 `.github/scripts/stamp-version.mjs` 会给入口脚本、样式表和所有 `js/` 模块加上 `?v=<commit>`（js 模块通过 import map 重定向），每次发布都加载一套一致的文件。仓库里的 `index.html` 不变，本地运行不受影响。
