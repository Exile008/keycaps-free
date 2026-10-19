# 键帽生成器 / Keycap Generator

## 中文

**在线使用：<https://exile008.github.io/keycaps-free/>**

完全离线、无需构建的参数化键帽工具。双击 `start.bat`，保持服务窗口运行，在浏览器访问 `http://localhost:8765/`。不要直接以 `file://` 打开 HTML。需要 Windows PowerShell 与支持 WebGL/WASM 的现代浏览器；不需要安装 npm 依赖。

### 功能

- 三栏编辑器、实时三维预览、俯视与 Y–Z 侧面示意图；等轴/俯视/正视/侧视与重新取景。
- Cherry、OEM、SA、DSA、XDA、平面近似预设，R1–R4 行高、标准键宽及自定义宽度。
- 独立四边顶面内缩与底面延伸、左右联动、高度、双向倾斜、圆角、碟形凹面、抽壳与 MX 十字轴公差、卫星轴、定位横杠。
- 最多 6 个文字字符、本地 TTF/OTF 字体导入、多 SVG 缩略图选择；字符尺寸、深度、旋转、偏移及镜像。
- 嵌入双色、凹刻、凸起、透光四种模式；主体/字符颜色。
- 高精度 3MF、主体/字符/合并 STL、真正无字符的空白 STL；工程 JSON 保存/载入（含自定义字体及所选 SVG），Ctrl+S 保存。
- 中英切换、深浅主题；浏览器自动保存参数和文字，不在自动会话中保存上传字体或 SVG。工程 JSON 用于携带这些资源。

### 参数与坐标

长度为 mm，角度为度，1u 间距为 19.05 mm。名义底面尺寸为 `unit × pitch − gap`。原点在底面轴心中心：**+X 向右，+Y 向后（远离打字者），+Z 向上**。

顶面内缩是倾斜前顶边相对对应底边向内的水平距离；不是缩放整只键帽。底面延伸向外加长对应底边，负值收窄，轴心始终不动。前后不同的内缩形成非对称裙边。顶面派生尺寸来自核心 `computeLayout`。

`tiltX > 0` 后缘升高、朝打字者倾斜；`tiltY > 0` 右缘升高。高度是凹陷前顶面中心的 Z。圆柱碟形只沿一个方向弯曲，球面双向弯曲，平面没有凹陷。壁厚为近似值，倾斜裙边的法向实际厚度可能略小；打印前检查切片。

十字轴公差正值使孔更松，负值更紧。自动卫星轴适用于 ≥2u 长键。嵌入双色是平齐双色件；凹刻只有主体，因此字符 STL 按钮不可用；凸起为独立凸字件；透光将字符及轴心设为透光色。3MF 保存部件颜色，不模拟材料透光物理属性。所有预设都是起点，不是厂家精确复刻；请先打印小样验证公差。

导出前重建高精度模型。3MF 按一个对象、多个部件组织；请在切片软件确认材料分配。参数警告以中英提示显示，生成失败保留上一份成功预览。若核心模块尚未提供，显示翻译后的缺失状态。

### 致谢

vostoklabs 的 SVG-keycap-generator 原始创意；zk_phi 的参数化键帽文章；three.js、manifold-3d、opentype.js、fflate。内置 Inter、JetBrains Mono、Orbitron、Bebas Neue 字体遵循 SIL Open Font License（OFL），许可证见随附字体文件。所有库与字体均由本地 `vendor/`、`fonts/` 提供，无 CDN。

## English

**Use online: <https://exile008.github.io/keycaps-free/>**

An offline, no-build parametric keycap editor. Double-click `start.bat`, leave its server window open and visit `http://localhost:8765/`. Do not open the HTML through `file://`. Requires Windows PowerShell and a modern WebGL/WASM browser, not npm.

### Features

Three-column live editor, 3D orbit/zoom/pan, Iso/Top/Front/Side views, frame control, top and Y–Z profile diagrams; approximate Cherry/OEM/SA/DSA/XDA/flat presets and row selection; standard/custom widths; independent top insets and footprint extensions; linked L/R insets, height, pitch/roll, corners, dish, shell, MX tolerance, stabilizers and homing bar. Text (up to six characters), imported TTF/OTF fonts and multiple SVG uploads support size/depth/rotation/offset/mirror placement. Four legend modes, two colours, export-quality 3MF and separate/merged/blank STL downloads are available.

Save/load project JSON embeds custom fonts and the selected SVG. Ctrl+S saves a project. Automatic browser persistence stores parameters and text only, not uploaded files. Language and theme preferences are persisted separately. Dark is the initial theme; language follows the browser unless previously selected.

### Parameters and coordinates

Lengths are millimetres, angles degrees. Pitch is 19.05 mm per u; nominal bottom dimension is `unit × pitch − gap`. The origin is the switch centre on the bottom plane: **+X right, +Y back (away from the typist), +Z up**.

Insets pull individual top edges inward from their matching bottom edges before tilt. Extensions lengthen individual bottom edges outward (negative shrinks), without moving the stem. Independent front/back insets produce asymmetric skirts. Positive tiltX raises the back edge; positive tiltY raises the right edge. Height is the top centre before dish subtraction. Cylindrical dishes curve one way, spherical dishes both ways; flat has no dish. Sloped wall thickness is approximate and can be slightly thinner along its normal than the entered wall value.

Positive stem tolerance makes the cross hole looser. Automatic stabilizers apply to ≥2u keys. Inlay is flush/two-colour; recessed is single-part engraving (no separate legend STL); raised has a proud legend; shine assigns the legend and stems to the shine-through colour. Colour is a material assignment, not an optical simulation. Presets are starting points, not exact manufacturer profiles. Print a fit sample and inspect the sliced walls before production.

Exports rebuild at export quality. 3MF groups cap and legend into one object with parts. Verify material assignments in your slicer. Translated warning chips explain constraints; failed generation keeps the last good preview. Missing core modules produce a translated status instead of crashing.

### Credits

Original idea: vostoklabs / SVG-keycap-generator. Parametric geometry inspiration: zk_phi's article. Libraries: three.js, manifold-3d, opentype.js, fflate. Bundled Inter, JetBrains Mono, Orbitron and Bebas Neue fonts use SIL OFL; see accompanying font licences. All runtime assets are local under `vendor/` and `fonts/`, with no CDN requests.
