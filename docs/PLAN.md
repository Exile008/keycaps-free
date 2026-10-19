# 键帽生成器 — 开发计划与调度说明

## 目标
1. 复刻 vostoklabs/SVG-keycap-generator：3D 预览、文字/SVG 字符、四种字符模式（双色嵌入 / 单色凹刻 / 凸起 / 透光）、轴心松紧、定位凸点、双色 3MF 导出（另加 STL）、工程保存/加载。
2. 中英文一键切换。
3. 按 zk_phi 的 Qiita 文章改为**参数化建模**：底面与倾斜顶面取 hull、圆柱/球面碟形、抽壳、十字轴 intersection 裁切。
4. 打破"四边等宽的方形"：
   - **顶面四边独立内缩**（前/后/左/右），模拟真实键帽前裙边更斜、后裙边更陡；
   - **底面四边独立延伸**（例如拇指键加长 0.125u），轴心位置不变；
   - **前后倾斜 + 左右倾斜**；Cherry / OEM / SA / DSA / XDA 等 R1–R4 行高预设（近似值）。
5. 完全离线：`start.bat` 启动本地 PowerShell 服务器，无需 Python/Node。

## 已完成（Claude）
- 调研两个参考网站，用 manifold-3d 在 Node 中验证了核心建模方案（非对称内缩 + 倾斜 + 碟形 + 抽壳 + 轴心 + 字符嵌入，约 10 ms/个，流形有效）。
- 离线依赖已放入 `vendor/`（three.js r186、manifold-3d 3.5.4、opentype.js 2.0、fflate 0.8）与 `fonts/`（4 个 OFL 字体）。
- `start.bat` + `serve.ps1`（正确的 wasm MIME）。
- `docs/SPEC.md`：所有 agent 共用的技术契约。
- `tasks/T1~T3`：三个 agent 任务书。

## 分工与执行顺序

| 阶段 | 任务 | Agent | 依赖 | 产出 |
| --- | --- | --- | --- | --- |
| 1 | T1 几何核心 | **codex** | — | params / keycap / 测试 |
| 1 | T3 界面 + 中英文 + 3D 视图 | **DeepSeek** | 可与 T1 并行 | index.html / css / main / viewer / i18n |
| 2 | T2 字符布尔 + 3MF/STL 导出 | **codex** | T1 测试通过 | legend / export / 测试 |
| 3 | 审阅 + 集成测试 + 修复任务书 | **Claude** | 每阶段结束 | docs/REVIEW-*.md、tasks/FIX-*.md |

## 用本地 opencode 运行（推荐）

```powershell
cd "D:\SynologyDrive\AI\键帽生成器"
powershell -ExecutionPolicy Bypass -File run-agents.ps1 -Task T3              # 用默认模型
powershell -ExecutionPolicy Bypass -File run-agents.ps1 -Task T2 -Model deepseek/deepseek-chat
powershell -ExecutionPolicy Bypass -File run-agents.ps1 -Task FIX -FixFile tasks/FIX-01.md
```
日志写入 `logs/`。T1 已完成（1478/1478 测试通过，Claude 已复核）。T2 与 T3 可以同时开两个窗口跑。

## 如何启动 agent（手动方式）

```powershell
cd "D:\SynologyDrive\AI\键帽生成器"

# 阶段 1（两个窗口并行）
codex          # 进入后输入：请阅读 tasks/T1-codex-geometry.md 并完成其中全部任务
# DeepSeek harness 同样在此目录启动，输入：请阅读 tasks/T3-deepseek-ui-i18n.md 并完成其中全部任务

# 阶段 2（T1 测试通过后）
codex          # 输入：请阅读 tasks/T2-codex-legend-export.md 并完成其中全部任务
```
非交互方式（可选）：`codex exec --full-auto "请阅读 tasks/T1-codex-geometry.md 并完成其中全部任务"`

每个阶段结束后告诉 Claude "T1 完成了" 之类，Claude 会：运行 Node 测试、审阅代码是否符合 SPEC、在浏览器截图检查界面，然后写 `docs/REVIEW-Tx.md` 和需要时的 `tasks/FIX-xx.md` 交回给对应 agent。

## 规则（写给 agent 的）
- 只改自己负责的文件；跨模块需求写进 `docs/QUESTIONS.md`。
- 每个任务结束写 `docs/REPORT-Tx.md`。
- 不准引入网络依赖、构建工具或 npm 包。
