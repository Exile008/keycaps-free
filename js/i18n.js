// ============================================================================
// i18n.js — zh / en dictionaries + t(), setLang(), getLang(), applyI18n()
// See docs/SPEC.md §8.  Pure browser module (touches document/window only when
// those exist, so it stays safe if imported elsewhere).
// ============================================================================

const zh = {
  // ---- app / chrome ----
  'app.title': '键帽生成器',
  'app.subtitle': '参数化 3D 键帽生成器 · 离线运行',
  'tip.lang': '切换语言 / Switch language',
  'tip.theme': '切换深色 / 浅色主题',
  'tip.help': '使用说明',
  'btn.reset': '恢复本组默认值',
  'btn.close': '关闭',
  'btn.apply': '应用',
  'aria.topview': '顶面与侧面示意图',
  'aria.stats': '模型统计',

  // ---- sections ----
  'sec.profile': '剖面预设',
  'sec.size': '尺寸',
  'sec.topface': '顶面内缩',
  'sec.ext': '底面延伸',
  'sec.height': '高度与倾斜',
  'sec.corners': '圆角',
  'sec.dish': '碟形凹面',
  'sec.shell': '抽壳',
  'sec.stem': '轴心',
  'sec.legend': '字符',
  'sec.placement': '摆放',
  'sec.mode': '嵌入模式',
  'sec.colors': '颜色',
  'sec.export': '导出',

  // ---- profile ----
  'preset.approx': '近似值',
  'preset.active': '{name}',
  'preset.customFrom': '自定义（基于 {name}）',
  'preset.reapply': '重新应用所选预设',
  'label.family': '键帽系列',
  'label.row': '行高',
  'preset.cherry': 'Cherry 原厂',
  'preset.oem': 'OEM',
  'preset.sa': 'SA 高球帽',
  'preset.dsa': 'DSA 矮球帽',
  'preset.xda': 'XDA 扁球帽',
  'preset.flat': '平面',
  'preset.uniform': '该系列为统一高度，无 R1–R4 区分',

  // ---- size ----
  'label.unitW': '键宽',
  'label.unitD': '键深',
  'label.custom': '自定义',
  'opt.custom': '自定义…',
  'unit.u': 'u',

  // ---- top face ----
  'label.insetL': '左侧内缩',
  'label.insetR': '右侧内缩',
  'label.insetF': '前侧内缩',
  'label.insetB': '后侧内缩',
  'label.linkLR': '左右对称',
  'label.topSize': '顶面尺寸 tw × td',
  'tip.insets': '顶面每一条边相对底部对应边向内水平收进的距离（在倾斜之前测量，单位 mm）。前/后内缩不同即可做出真实键帽“前裙边更斜、后裙边更陡”的非对称造型。',
  'tip.linkLR': '打开后，修改左/右内缩时另一边自动同步，保持左右对称。',
  'tip.insetL': '顶面左边相对底面左边向右内缩的水平距离，在倾斜前测量；不是底面向外延伸。',
  'tip.insetR': '顶面右边相对底面右边向左内缩的水平距离，在倾斜前测量；不是底面向外延伸。',
  'tip.insetF': '前侧边（靠近打字者，−Y）收进的量；加大可让前裙边更倾斜。',
  'tip.insetB': '后侧边（远离打字者，+Y）收进的量。',

  // ---- extension ----
  'label.extL': '左侧延伸',
  'label.extR': '右侧延伸',
  'label.extF': '前侧延伸',
  'label.extB': '后侧延伸',
  'tip.ext': '在底面每一条边上额外向外延伸的长度（mm，可为负）。轴心始终固定在原点不动，因此可用来做“加长 0.125u 的拇指键”等造型。',
  'tip.extL': '底面左侧向外延伸（负值则收窄）。',
  'tip.extR': '底面右侧向外延伸。',
  'tip.extF': '底面前侧（−Y）向外延伸。',
  'tip.extB': '底面后侧（+Y）向外延伸。',

  // ---- height & tilt ----
  'label.height': '高度',
  'label.tiltX': '前后倾斜 tiltX',
  'label.tiltY': '左右倾斜 tiltY',
  'tip.height': '顶面中心的高度（Z，mm），在凹陷之前测量。',
  'tip.tiltX': '前后俯仰角（度）。+ 表示后边缘抬高，顶面朝打字者方向倾斜；− 表示前边缘抬高。',
  'tip.tiltY': '左右横滚角（度）。+ 表示右边缘抬高，− 表示左边缘抬高。',

  // ---- corners ----
  'label.rBottom': '底面圆角',
  'label.rTop': '顶面圆角',
  'tip.rBottom': '底面矩形的圆角半径（mm）。',
  'tip.rTop': '顶面矩形的圆角半径（mm）。',

  // ---- dish ----
  'label.dishType': '凹面类型',
  'label.dishDepth': '凹陷深度',
  'dish.cylindrical': '圆柱面',
  'dish.spherical': '球面',
  'dish.flat': '平面',
  'tip.dishType': '顶面碟形凹陷的类型：圆柱面（沿一个方向弯曲，如 Cherry/OEM）、球面（双向弯曲，如 SA/DSA）、平面（不凹陷）。',
  'tip.dishDepth': '凹陷中心的下沉量（矢高，mm）。0 表示不凹陷。',

  // ---- shell ----
  'label.wall': '侧壁厚度',
  'label.topThickness': '顶部厚度',
  'tip.wall': '侧壁的厚度（mm）。',
  'tip.topThickness': '顶面在中心处沿 Z 方向的厚度（mm）。',

  // ---- stem ----
  'label.stemType': '轴心类型',
  'stem.mx': 'MX 十字轴',
  'stem.none': '无轴心',
  'label.stemTolerance': '十字轴公差',
  'label.stemZ': '轴心起始高度',
  'label.stemFillet': '轴体补强圆角',
  'label.stemRibs': '补强筋',
  'stemRibs.none': '无',
  'stemRibs.cross': '十字',
  'label.ribThickness': '筋宽',
  'label.ribHeight': '筋深',
  'label.stemSeparate': '轴体独立部件',
  'label.stabilizers': '卫星轴',
  'stab.auto': '自动（≥2u）',
  'stab.none': '无',
  'label.homingBump': '定位凸点（F/J）',
  'tip.stemType': '轴心接口类型：MX 十字轴，或完全不加轴心。',
  'tip.stemTolerance': '加到十字孔宽度上的公差（mm）。+ 更松（更好装），− 更紧。',
  'tip.stemZ': '轴心底部所在的 Z 高度（mm）。',
  'tip.stemFillet': '轴柱与顶面交接处的圆弧过渡半径，0 关闭。',
  'tip.stemRibs': '从主轴沿 ±X/±Y 延伸到内壁的补强筋。',
  'tip.ribThickness': '补强筋的宽度（mm）。',
  'tip.ribHeight': '从内顶面沿 Z 向下的高度。',
  'tip.stemSeparate': '将轴柱与圆角单独输出为一个部件，用于多色/多材料打印。',
  'tip.stabilizers': '当键帽 ≥2u 时自动添加 Cherry 卫星轴轴心。',
  'tip.homingBump': '在顶面下部加一个 5×1mm 的定位横杠（F/J 定位键）。',

  // ---- legend ----
  'legend.tabText': '文字',
  'legend.tabSvg': 'SVG',
  'legend.tabNone': '无',
  'label.legendText': '文字',
  'ph.legendText': '如 A / Esc',
  'label.font': '字体',
  'legend.importFont': '导入字体 (.ttf/.otf)',
  'legend.uploadSvg': '上传 SVG',
  'legend.noneHint': '不添加字符，仅生成空白键帽。',
  'legend.noSvg': '尚未上传 SVG，点上方按钮选择文件。',
  'legend.svgSelected': '已选中',
  'font.inter-bold': 'Inter Bold',
  'font.jetbrains-mono-bold': 'JetBrains Mono Bold',
  'font.orbitron-bold': 'Orbitron Bold',
  'font.bebas-neue': 'Bebas Neue',
  'font.imported': '自定义字体',

  // ---- SVG import ----
  'svgImport.title': '导入图片',
  'svgImport.edit': '编辑',
  'svgImport.editFile': '编辑 {name}',
  'svgImport.yourFile': '原始文件',
  'svgImport.willPrint': '打印效果',
  'svgImport.parts': '部件 · {count}',
  'svgImport.groupByStyle': '按样式分组',
  'svgImport.groupCount': '{count} 个同样式部件',
  'svgImport.partNumber': '部件 {number}',
  'svgImport.mixed': '不同设置',
  'svgImport.role.fill': '填充',
  'svgImport.role.stroke': '描边 · {width} 宽',
  'svgImport.role.artboard': '画板矩形',
  'svgImport.role.background': '背景',
  'svgImport.role.faint': '半透明',
  'svgImport.mode.fill': '填充',
  'svgImport.mode.outline': '描边',
  'svgImport.mode.cut': '挖空',
  'svgImport.mode.off': '关闭',
  'svgImport.outlineWidth': '描边宽度',
  'svgImport.widthValue': '{width} SVG 单位 · ≈ {mm} mm',
  'svgImport.widthHint': '仅影响填充图形的描边；原始线条保留自身宽度。毫米数按当前字符尺寸估算。',
  'svgImport.invert': '反转',
  'svgImport.reset': '恢复自动',
  'svgImport.allFill': '全部填充',
  'svgImport.allOff': '全部关闭',
  'svgImport.summary': '共 {count} 个部件，{off} 个关闭。',
  'svgImport.cancel': '取消',
  'svgImport.use': '使用此图',
  'svgImport.empty': '当前没有可打印图形。请启用部件或调整挖空／反转设置。',
  'warn.svgTextIgnored': '已忽略 SVG 文字；请先将文字转换为路径再导入。',

  // ---- placement ----
  'label.legendSize': '字符尺寸',
  'label.legendDepth': '字符深度',
  'label.legendRot': '旋转',
  'label.legendX': '水平偏移 X',
  'label.legendY': '垂直偏移 Y',
  'label.legendMirror': '水平镜像',
  'tip.legendSize': '字符外接框长边缩放到的尺寸（mm）。',
  'tip.legendDepth': '字符嵌入/凸起/凹刻的深度（mm）。',
  'tip.legendRot': '字符在顶面内的旋转角度（度）。',
  'tip.legendX': '字符在顶面局部坐标系中的水平偏移（mm），+ 向右。',
  'tip.legendY': '字符在顶面局部坐标系中的垂直偏移（mm），+ 向后。',
  'tip.legendMirror': '沿 X 轴镜像字符。',

  // ---- mode ----
  'mode.inlay': '嵌入双色',
  'mode.recessed': '凹刻',
  'mode.raised': '凸起',
  'mode.shine': '透光',
  'tip.legendMode': '字符与键帽的结合方式：嵌入双色（平齐、双色打印）、凹刻（单色、刻入表面）、凸起（凸出表面）、透光（字符与轴心为透光色，键帽不透光）。',

  // ---- colors ----
  'label.capColor': '键帽颜色',
  'label.legendColor': '字符颜色',
  'label.stemColor': '轴体颜色',
  'tip.capColor': '键帽主体的颜色。',
  'tip.legendColor': '字符的颜色（透光模式下为透光色）。',
  'tip.stemColor': '轴体独立部件的颜色。',

  // ---- export ----
  'export.download3mf': '下载 3MF',
  'export.stlCap': 'STL 键帽',
  'export.stlLegend': 'STL 字符',
  'export.stlStem': 'STL 轴体',
  'export.stlMerged': 'STL 合并',
  'export.blank': '空白键帽',
  'export.saveProject': '保存工程',
  'export.loadProject': '载入工程',
  'tip.export': '导出多色 3MF（PrusaSlicer / Orca / Bambu 中显示为一个物体的多个颜色部件），或 STL；保存/载入工程 JSON。',
  'file.export3mf': '导出 3MF',
  'file.exportStl': '导出 STL',
  'file.importFont': '选择字体文件',
  'file.uploadSvg': '选择 SVG 文件',
  'file.loadProject': '选择工程文件',

  // ---- view ----
  'view.iso': '等轴',
  'view.top': '俯视',
  'view.front': '正视',
  'view.side': '侧视',
  'view.frame': '取景',

  // ---- diagram ----
  'diagram.title': '尺寸示意图',
  'diagram.expand': '展开尺寸示意图',
  'diagram.collapse': '收起尺寸示意图',
  'diagram.top': '俯视 · 内缩（mm）',
  'diagram.side': '侧面 · 高度与倾斜',
  'diagram.insets': '实线为底面，虚线为顶面；数值为倾斜前的内缩量（mm）',
  'diagram.inset': '{side} {value}',
  'diagram.height': '{value} mm',
  'diagram.tilt': '前后倾斜 {value}°',
  'dir.front': '前',
  'dir.back': '后',
  'dir.left': '左',
  'dir.right': '右',

  // ---- legend depth preview ----
  'depth.title': '字符深度截面',
  'depth.aria': '字符深度截面预览（{mode}）',
  'depth.depthLabel': '深度',
  'depth.throughLabel': '透光深度',
  'depth.topLabel': '顶厚',
  'depth.remainingLabel': '剩余材料',
  'depth.noLegend': '无字符',
  'depth.warnThin': '剩余材料仅 {value} mm（小于 0.4 mm）',
  'depth.warnThrough': '深度 ≥ 顶厚：字符会切穿顶板',
  'depth.stemsNote': '轴心同样使用字符颜色',
  'depth.stemSeparateNote': '轴体为独立部件，使用轴体颜色，不随字符着色',

  // ---- status ----
  'status.ready': '就绪',
  'status.generating': '生成中…',
  'status.exporting': '正在以高精度重建…',
  'status.wasmLoading': '正在加载几何引擎…',
  'status.coreMissing': '核心模块尚未就绪（几何/字符模块缺失）。',
  'status.legendBuilding': '正在生成字符轮廓…',
  'status.importingFont': '正在解析字体…',
  'status.importingSvg': '正在解析 SVG…',
  'status.loadingProject': '正在载入工程…',
  'status.saved': '工程已保存',
  'status.loaded': '工程已载入',
  'status.noLegend': '无字符',
  'status.capOnly': '仅键帽（字符未生成）',
  'status.error': '出错了',
  'status.done': '已完成',

  // ---- stats ----
  'stats.tris': '三角面',
  'stats.ms': '毫秒',
  'stats.empty': '—',

  // ---- warnings ----
  'warn.topTooSmall': '顶面过小：已自动收窄内缩以保证顶面至少 4mm。',
  'warn.dishTooDeep': '凹陷过深：已按顶面尺寸自动限制凹陷深度。',
  'warn.tooThin': '壳体过薄：侧壁或顶面厚度接近极限。',
  'warn.innerInvalid': '内腔过小：底面不足以容纳轴心与外壁。',
  'warn.topTooThick': '顶部过厚：已按高度与凹陷深度限制顶部厚度。',
  'warn.bodyTooThin': '主体过薄：侧壁相对轴心过薄。',
  'warn.wallThinTilt': '倾斜较大时侧壁可能偏薄，建议加厚侧壁。',
  'warn.legendOverflow': '字符超出顶面范围，可能被裁切。',
  'warn.legendEmpty': '字符为空，已生成无字符键帽。',
  'warn.legendUnavailable': '字符模块尚未就绪，已先生成无字符键帽。',
  'warn.glyphMissing': '字体缺少部分字形，这些字符已被跳过。',

  // ---- errors ----
  'err.coreMissing': '核心模块缺失：geometry / legend / export 模块尚未提供。',
  'err.wasmLoad': '几何引擎（WASM）加载失败。',
  'err.fontLoad': '字体加载或解析失败。',
  'err.svgNoShapes': 'SVG 中没有可用的图形。',
  'err.svgParse': 'SVG 解析失败。',
  'err.buildFailed': '模型生成失败。',
  'err.projectLoad': '工程文件无法解析。',
  'err.exportFailed': '导出失败。',
  'err.noLegendExport': '当前没有字符可导出。',
  'err.noStemExport': '当前没有独立轴体可导出。',

  // ---- help ----
  'help.title': '使用说明',
  'help.intro': '这是一个完全离线运行的参数化键帽生成器。左侧调整几何参数，中间实时预览，右侧设置字符并导出。所有尺寸单位为毫米、角度为度。',
  'help.insets.title': '顶面内缩 / 底面延伸',
  'help.insets.body': '“顶面内缩”是顶面每条边相对底面对应边向内收进的量；前/后可以不同，从而做出真实键帽的非对称裙边。“底面延伸”是底面每条边向外加长的量，轴心位置不变，适合做加长拇指键。',
  'help.tilt.title': '倾斜符号约定',
  'help.tilt.body': '坐标：+X 向右，+Y 向后（远离打字者），+Z 向上。tiltX 为前后俯仰，+ 时后边缘抬高、顶面朝打字者倾斜；tiltY 为左右横滚，+ 时右边缘抬高。',
  'help.dish.title': '碟形凹面',
  'help.dish.body': '圆柱面沿一个方向弯曲（Cherry/OEM），球面双向弯曲（SA/DSA），平面不凹陷。凹陷深度为中心的下沉量（矢高）。',
  'help.legend.title': '字符模式',
  'help.legend.body': '嵌入双色：字符平齐嵌入并可双色打印；凹刻：单色刻入表面；凸起：字符凸出表面；透光：字符与轴心为透光色，键帽主体不透光。',
  'help.stem.title': '轴心',
  'help.stem.body': 'MX 十字轴按真实尺寸建模，公差可调（+ 更松）。≥2u 时可自动添加 Cherry 卫星轴轴心。定位凸点为 F/J 键上的横杠。补强圆角与十字补强筋可加强轴柱，轴体独立部件用于多色/多材料打印。',
  'help.export.title': '导出与工程',
  'help.export.body': '“下载 3MF”导出多色模型，在主流切片软件中显示为一个物体的多个颜色部件；也可单独导出 STL。工程可保存为 JSON（含上传的字体与 SVG），下次载入即可恢复。',
  'help.coords': '坐标约定：+X 右、+Y 后、+Z 上；原点位于底面轴心中心。',
};

const en = {
  // ---- app / chrome ----
  'app.title': 'Keycap Generator',
  'app.subtitle': 'Parametric 3D keycap generator · offline',
  'tip.lang': 'Switch language / 切换语言',
  'tip.theme': 'Toggle dark / light theme',
  'tip.help': 'Help',
  'btn.reset': 'Reset this section',
  'btn.close': 'Close',
  'btn.apply': 'Apply',
  'aria.topview': 'Top view and side profile diagram',
  'aria.stats': 'Model statistics',

  // ---- sections ----
  'sec.profile': 'Profile preset',
  'sec.size': 'Size',
  'sec.topface': 'Top face insets',
  'sec.ext': 'Footprint extension',
  'sec.height': 'Height & tilt',
  'sec.corners': 'Corners',
  'sec.dish': 'Dish',
  'sec.shell': 'Shell',
  'sec.stem': 'Stem',
  'sec.legend': 'Legend',
  'sec.placement': 'Placement',
  'sec.mode': 'Legend mode',
  'sec.colors': 'Colours',
  'sec.export': 'Export',

  // ---- profile ----
  'preset.approx': 'approx.',
  'preset.active': '{name}',
  'preset.customFrom': 'Custom (from {name})',
  'preset.reapply': 'Re-apply selected preset',
  'label.family': 'Family',
  'label.row': 'Row',
  'preset.cherry': 'Cherry',
  'preset.oem': 'OEM',
  'preset.sa': 'SA',
  'preset.dsa': 'DSA',
  'preset.xda': 'XDA',
  'preset.flat': 'Flat',
  'preset.uniform': 'Uniform height — no R1–R4 rows',

  // ---- size ----
  'label.unitW': 'Width',
  'label.unitD': 'Depth',
  'label.custom': 'Custom',
  'opt.custom': 'Custom…',
  'unit.u': 'u',

  // ---- top face ----
  'label.insetL': 'Left inset',
  'label.insetR': 'Right inset',
  'label.insetF': 'Front inset',
  'label.insetB': 'Back inset',
  'label.linkLR': 'Symmetric L/R',
  'label.topSize': 'Top size tw × td',
  'tip.insets': 'Horizontal distance each top edge is pulled in from the matching bottom edge, measured before tilt (mm). Asymmetric F/B insets create the sculpted front/back skirts of real keycaps.',
  'tip.linkLR': 'When on, editing left/right inset mirrors the other side to keep L/R symmetric.',
  'tip.insetL': 'How far the left top edge is pulled in.',
  'tip.insetR': 'How far the right top edge is pulled in.',
  'tip.insetF': 'Front edge inset (toward the typist, −Y); larger values tilt the front skirt more.',
  'tip.insetB': 'Back edge inset (away from the typist, +Y).',

  // ---- extension ----
  'label.extL': 'Left extension',
  'label.extR': 'Right extension',
  'label.extF': 'Front extension',
  'label.extB': 'Back extension',
  'tip.ext': 'Extra length added outward on each bottom edge (mm, may be negative). The stem stays at the origin, so this makes e.g. a 0.125u-longer thumb key.',
  'tip.extL': 'Bottom-left edge extends outward (negative shrinks).',
  'tip.extR': 'Bottom-right edge extends outward.',
  'tip.extF': 'Bottom front edge (−Y) extends outward.',
  'tip.extB': 'Bottom back edge (+Y) extends outward.',

  // ---- height & tilt ----
  'label.height': 'Height',
  'label.tiltX': 'Pitch tiltX',
  'label.tiltY': 'Roll tiltY',
  'tip.height': 'Z of the top-face centre (mm), measured before the dish.',
  'tip.tiltX': 'Pitch angle in degrees. + raises the back edge (top tilts toward the typist); − raises the front edge.',
  'tip.tiltY': 'Roll angle in degrees. + raises the right edge; − raises the left edge.',

  // ---- corners ----
  'label.rBottom': 'Bottom radius',
  'label.rTop': 'Top radius',
  'tip.rBottom': 'Corner radius of the bottom rectangle (mm).',
  'tip.rTop': 'Corner radius of the top rectangle (mm).',

  // ---- dish ----
  'label.dishType': 'Dish type',
  'label.dishDepth': 'Dish depth',
  'dish.cylindrical': 'Cylindrical',
  'dish.spherical': 'Spherical',
  'dish.flat': 'Flat',
  'tip.dishType': 'Type of the concave top: cylindrical (curved one way, e.g. Cherry/OEM), spherical (curved both ways, e.g. SA/DSA) or flat (no dish).',
  'tip.dishDepth': 'Sagitta at the centre (mm). 0 means no dish.',

  // ---- shell ----
  'label.wall': 'Wall thickness',
  'label.topThickness': 'Top thickness',
  'tip.wall': 'Thickness of the side wall (mm).',
  'tip.topThickness': 'Top thickness measured along Z at the centre (mm).',

  // ---- stem ----
  'label.stemType': 'Stem type',
  'stem.mx': 'MX cross',
  'stem.none': 'None',
  'label.stemTolerance': 'Cross tolerance',
  'label.stemZ': 'Stem bottom Z',
  'label.stemFillet': 'Stem fillet',
  'label.stemRibs': 'Stem ribs',
  'stemRibs.none': 'None',
  'stemRibs.cross': 'Cross',
  'label.ribThickness': 'Rib thickness',
  'label.ribHeight': 'Rib height',
  'label.stemSeparate': 'Separate stem part',
  'label.stabilizers': 'Stabilizers',
  'stab.auto': 'Auto (≥2u)',
  'stab.none': 'None',
  'label.homingBump': 'Homing bump (F/J)',
  'tip.stemType': 'Stem interface: MX cross, or no stem at all.',
  'tip.stemTolerance': 'Added to the cross widths (mm). + is looser (easier fit), − is tighter.',
  'tip.stemZ': 'Z of the stem bottom (mm).',
  'tip.stemFillet': 'Radius of the concave flare where each stem meets the top underside (0 disables).',
  'tip.stemRibs': 'Adds ribs from the main stem to the inner walls along ±X/±Y.',
  'tip.ribThickness': 'Width of each reinforcement rib (mm).',
  'tip.ribHeight': 'Depth measured down from the inner top surface.',
  'tip.stemSeparate': 'Export the stem and fillet as a separate part for multi-colour/multi-material printing.',
  'tip.stabilizers': 'Automatically add Cherry stabilizer stems for keycaps ≥2u.',
  'tip.homingBump': 'Add a 5×1 mm homing bar on the lower top face (for F/J keys).',

  // ---- legend ----
  'legend.tabText': 'Text',
  'legend.tabSvg': 'SVG',
  'legend.tabNone': 'None',
  'label.legendText': 'Text',
  'ph.legendText': 'e.g. A / Esc',
  'label.font': 'Font',
  'legend.importFont': 'Import font (.ttf/.otf)',
  'legend.uploadSvg': 'Upload SVG',
  'legend.noneHint': 'No legend — generate a blank keycap only.',
  'legend.noSvg': 'No SVG uploaded yet — use the button above to choose files.',
  'legend.svgSelected': 'Selected',
  'font.inter-bold': 'Inter Bold',
  'font.jetbrains-mono-bold': 'JetBrains Mono Bold',
  'font.orbitron-bold': 'Orbitron Bold',
  'font.bebas-neue': 'Bebas Neue',
  'font.imported': 'Imported font',

  // ---- SVG import ----
  'svgImport.title': 'Import image',
  'svgImport.edit': 'Edit',
  'svgImport.editFile': 'Edit {name}',
  'svgImport.yourFile': 'Your file',
  'svgImport.willPrint': 'What will print',
  'svgImport.parts': 'Parts · {count}',
  'svgImport.groupByStyle': 'Group by style',
  'svgImport.groupCount': '{count} parts with this style',
  'svgImport.partNumber': 'Part {number}',
  'svgImport.mixed': 'Mixed settings',
  'svgImport.role.fill': 'Filled in the file',
  'svgImport.role.stroke': 'Outline · {width} wide',
  'svgImport.role.artboard': 'Artboard rectangle',
  'svgImport.role.background': 'Background',
  'svgImport.role.faint': 'Faint',
  'svgImport.mode.fill': 'Fill',
  'svgImport.mode.outline': 'Outline',
  'svgImport.mode.cut': 'Cut',
  'svgImport.mode.off': 'Off',
  'svgImport.outlineWidth': 'Outline width',
  'svgImport.widthValue': '{width} SVG units · ≈ {mm} mm',
  'svgImport.widthHint': 'Applies to outlines of filled shapes; original strokes keep their own width. Millimetres are estimated at the current legend size.',
  'svgImport.invert': 'Invert',
  'svgImport.reset': 'Reset to auto',
  'svgImport.allFill': 'All fill',
  'svgImport.allOff': 'All off',
  'svgImport.summary': '{count} parts. {off} off.',
  'svgImport.cancel': 'Cancel',
  'svgImport.use': 'Use this',
  'svgImport.empty': 'Nothing will print. Enable a part or adjust Cut / Invert settings.',
  'warn.svgTextIgnored': 'SVG text was ignored. Convert text to paths before importing.',

  // ---- placement ----
  'label.legendSize': 'Size',
  'label.legendDepth': 'Depth',
  'label.legendRot': 'Rotation',
  'label.legendX': 'Offset X',
  'label.legendY': 'Offset Y',
  'label.legendMirror': 'Mirror X',
  'tip.legendSize': 'Legend bounding-box long edge is scaled to this size (mm).',
  'tip.legendDepth': 'Inlay / raised / recessed depth (mm).',
  'tip.legendRot': 'Rotation of the legend within the top face (degrees).',
  'tip.legendX': 'Offset within the top-face local frame (mm), + to the right.',
  'tip.legendY': 'Offset within the top-face local frame (mm), + to the back.',
  'tip.legendMirror': 'Mirror the legend along X.',

  // ---- mode ----
  'mode.inlay': 'Inlay',
  'mode.recessed': 'Recessed',
  'mode.raised': 'Raised',
  'mode.shine': 'Shine',
  'tip.legendMode': 'How the legend meets the cap: inlay (flush, two-colour), recessed (single-colour engrave), raised (proud of the surface), shine (legend + stems printed in the shine-through colour, cap opaque).',

  // ---- colors ----
  'label.capColor': 'Cap colour',
  'label.legendColor': 'Legend colour',
  'label.stemColor': 'Stem colour',
  'tip.capColor': 'Colour of the keycap body.',
  'tip.legendColor': 'Colour of the legend (shine-through colour in shine mode).',
  'tip.stemColor': 'Colour of the separate stem part.',

  // ---- export ----
  'export.download3mf': 'Download 3MF',
  'export.stlCap': 'STL cap',
  'export.stlLegend': 'STL legend',
  'export.stlStem': 'STL stem',
  'export.stlMerged': 'STL merged',
  'export.blank': 'Blank keycap',
  'export.saveProject': 'Save project',
  'export.loadProject': 'Load project',
  'tip.export': 'Export multi-colour 3MF (opens as one object with colour parts in PrusaSlicer / Orca / Bambu) or STL; save/load the project as JSON.',
  'file.export3mf': 'Export 3MF',
  'file.exportStl': 'Export STL',
  'file.importFont': 'Choose a font file',
  'file.uploadSvg': 'Choose SVG files',
  'file.loadProject': 'Choose a project file',

  // ---- view ----
  'view.iso': 'Iso',
  'view.top': 'Top',
  'view.front': 'Front',
  'view.side': 'Side',
  'view.frame': 'Frame',

  // ---- diagram ----
  'diagram.title': 'Dimensions',
  'diagram.expand': 'Expand dimension diagram',
  'diagram.collapse': 'Collapse dimension diagram',
  'diagram.top': 'Top · insets (mm)',
  'diagram.side': 'Side · height & tilt',
  'diagram.insets': 'Solid outline: footprint; dashed outline: top. Insets are measured before tilt (mm).',
  'diagram.inset': '{side} {value}',
  'diagram.height': '{value} mm',
  'diagram.tilt': 'Pitch {value}°',
  'dir.front': 'F',
  'dir.back': 'B',
  'dir.left': 'L',
  'dir.right': 'R',

  // ---- legend depth preview ----
  'depth.title': 'Legend depth section',
  'depth.aria': 'Legend depth cross-section ({mode})',
  'depth.depthLabel': 'Depth',
  'depth.throughLabel': 'Through depth',
  'depth.topLabel': 'Top thickness',
  'depth.remainingLabel': 'Remaining material',
  'depth.noLegend': 'No legend',
  'depth.warnThin': 'Only {value} mm of material left (< 0.4 mm)',
  'depth.warnThrough': 'Depth ≥ top thickness: cuts through',
  'depth.stemsNote': 'Stems print in the legend colour',
  'depth.stemSeparateNote': 'The stem is a separate part printed in the stem colour, not the legend colour',

  // ---- status ----
  'status.ready': 'Ready',
  'status.generating': 'Generating…',
  'status.exporting': 'Rebuilding at export quality…',
  'status.wasmLoading': 'Loading geometry engine…',
  'status.coreMissing': 'Core modules not available yet (geometry/legend missing).',
  'status.legendBuilding': 'Building legend contours…',
  'status.importingFont': 'Parsing font…',
  'status.importingSvg': 'Parsing SVG…',
  'status.loadingProject': 'Loading project…',
  'status.saved': 'Project saved',
  'status.loaded': 'Project loaded',
  'status.noLegend': 'No legend',
  'status.capOnly': 'Cap only (legend not generated)',
  'status.error': 'Error',
  'status.done': 'Done',

  // ---- stats ----
  'stats.tris': 'tris',
  'stats.ms': 'ms',
  'stats.empty': '—',

  // ---- warnings ----
  'warn.topTooSmall': 'Top face too small: insets were reduced to keep the top ≥ 4 mm.',
  'warn.dishTooDeep': 'Dish too deep: depth was limited for the top-face size.',
  'warn.tooThin': 'Shell too thin: wall or top thickness is near its limit.',
  'warn.innerInvalid': 'Inner body too small for the stem plus wall.',
  'warn.topTooThick': 'Top too thick: thickness was limited by height and dish depth.',
  'warn.bodyTooThin': 'Body too thin relative to the stem.',
  'warn.wallThinTilt': 'Wall may be thin under strong tilt — consider a thicker wall.',
  'warn.legendOverflow': 'Legend extends beyond the top face and may be clipped.',
  'warn.legendEmpty': 'Legend is empty — generated a cap without legend.',
  'warn.legendUnavailable': 'Legend module not available yet — generated the cap without legend.',
  'warn.glyphMissing': 'The font lacks some glyphs; those characters were skipped.',

  // ---- errors ----
  'err.coreMissing': 'Core modules missing: geometry / legend / export modules are not provided yet.',
  'err.wasmLoad': 'Failed to load the geometry engine (WASM).',
  'err.fontLoad': 'Failed to load or parse the font.',
  'err.svgNoShapes': 'The SVG contains no usable shapes.',
  'err.svgParse': 'Failed to parse the SVG.',
  'err.buildFailed': 'Model generation failed.',
  'err.projectLoad': 'The project file could not be parsed.',
  'err.exportFailed': 'Export failed.',
  'err.noLegendExport': 'There is no legend to export.',
  'err.noStemExport': 'There is no separate stem to export.',

  // ---- help ----
  'help.title': 'Help',
  'help.intro': 'A fully offline parametric keycap generator. Adjust the geometry on the left, watch the live preview in the centre, and set the legend and export on the right. All lengths are in millimetres, angles in degrees.',
  'help.insets.title': 'Top insets / bottom extension',
  'help.insets.body': '"Top inset" is how far each top edge is pulled in from the matching bottom edge; front/back can differ to create a real keycap\'s asymmetric skirt. "Bottom extension" lengthens each bottom edge outward while the stem stays put — ideal for longer thumb keys.',
  'help.tilt.title': 'Tilt sign convention',
  'help.tilt.body': 'Axes: +X right, +Y back (away from the typist), +Z up. tiltX is pitch — + raises the back edge so the top faces the typist; tiltY is roll — + raises the right edge.',
  'help.dish.title': 'Dish',
  'help.dish.body': 'Cylindrical curves one way (Cherry/OEM), spherical curves both ways (SA/DSA), flat has no dish. Dish depth is the sagitta at the centre.',
  'help.legend.title': 'Legend modes',
  'help.legend.body': 'Inlay: flush two-colour insert. Recessed: single-colour engraving. Raised: legend stands proud. Shine: legend and stems are the shine-through colour while the cap stays opaque.',
  'help.stem.title': 'Stem',
  'help.stem.body': 'The MX cross is modelled to real dimensions with an adjustable tolerance (+ is looser). Cherry stabilizer stems are added automatically for ≥2u. The homing bump is the bar on F/J keys. Fillet flares and cross ribs reinforce the stem, and a separate stem part enables multi-colour / multi-material printing.',
  'help.export.title': 'Export & project',
  'help.export.body': '"Download 3MF" exports a multi-colour model that opens as one object with colour parts in common slicers; STL is also available. Projects save as JSON (including uploaded fonts and SVGs) and restore on load.',
  'help.coords': 'Axes: +X right, +Y back, +Z up; origin at the stem centre on the bottom plane.',
};

export const dictionaries = { zh, en };

Object.assign(zh, {
  'R1': 'R1', 'R2': 'R2', 'R3': 'R3', 'R4': 'R4',
  'tip.unitW': '键宽以 u 为单位；名义底宽 = u × 19.05 − 间隙。',
  'tip.unitD': '键深以 u 为单位，支持数字区加号等竖向长键。',
  'help.diagramTop': '顶面', 'help.diagramBottom': '底面',
  'label.legendMode': '字符模式',
  'err.exportColor': '导出颜色格式无效。',
});
Object.assign(en, {
  'R1': 'R1', 'R2': 'R2', 'R3': 'R3', 'R4': 'R4',
  'tip.unitW': 'Width in u; nominal bottom width = u × 19.05 minus gap.',
  'tip.unitD': 'Depth in u; supports vertical keys such as numpad plus.',
  'help.diagramTop': 'Top face', 'help.diagramBottom': 'Footprint',
  'label.legendMode': 'Legend mode',
  'err.exportColor': 'Invalid export colour format.',
});

// ---- FEAT-02: KLP Lamé–style caps, Choc stems and sizes ----
Object.assign(zh, {
  'preset.klp': 'KLP 常规（矮轴）',
  'preset.klp-thumb': 'KLP 拇指键',
  'preset.klp-saddle': 'KLP 马鞍',
  'row.flat': '平置',
  'row.tilted': '倾斜 15°',
  'row.homing': '定位（三点）',
  'credit.klp': '造型参考 KLP Lamé，作者 braindefender',
  'credit.link': '（GitHub 链接）',
  'label.advanced': '高级',
  'label.switchSize': '轴体 / 尺寸',
  'tip.switchSize': '快速切换轴心类型与键距标准：Choc 尺寸为 18 × 17 mm 键距（1u 底面 17.5 × 16.5），MX 尺寸为 19.05 mm 键距（1u 底面 18 × 18）。',
  'switchSize.choc-choc': 'Choc 轴 + Choc 尺寸',
  'switchSize.choc-mx': 'Choc 轴 + MX 尺寸',
  'switchSize.mx-mx': 'MX 轴 + MX 尺寸',
  'switchSize.mx-choc': 'MX 轴 + Choc 尺寸',
  'label.skirtStyle': '侧裙',
  'tip.skirtStyle': '直线：底面到顶面直接连接。圆弧：先竖直一段，再以圆弧向内收到顶面（KLP 造型）。',
  'skirt.straight': '直线',
  'skirt.rounded': '圆弧',
  'label.skirtStraight': '竖直段高度',
  'tip.skirtStraight': '圆弧侧裙：从底面起竖直部分的高度（mm）。',
  'label.skirtRadius': '圆弧半径',
  'tip.skirtRadius': '圆弧侧裙的弧半径（mm），越小越圆。',
  'dish.klp': 'KLP 凹面',
  'dish.klpThumb': 'KLP 拇指',
  'dish.klpSaddle': 'KLP 马鞍',
  'tip.dishType': '顶面凹陷类型：圆柱面（Cherry/OEM）、球面（SA/DSA）、平面；KLP 凹面为带窄边缘的雕刻凹面，KLP 拇指在前侧额外下削，KLP 马鞍在前后两侧下削。',
  'label.sculptRim': '凹面边缘宽度',
  'tip.sculptRim': 'KLP 凹面：顶面边缘到凹陷开始处的平边宽度（mm）。',
  'label.sculptDrop': '边缘下削量',
  'tip.sculptDrop': 'KLP 拇指/马鞍：前（后）边缘相对顶面平面额外下削的高度（mm）。',
  'stem.choc': 'Choc 双脚',
  'tip.stemType': '轴心接口类型：MX 十字轴、Kailh Choc v1 双脚，或完全不加轴心。',
  'label.stemRotate': '轴心旋转 90°',
  'tip.stemRotate': '将轴心整体绕 Z 轴旋转 90°（如 KLP 的“旋转”与 1.5U 竖向版本）。',
  'label.chocProngW': '脚宽（X）',
  'tip.chocProngW': 'Choc 每只脚沿 X 的宽度（mm）。公差为正时会减小。',
  'label.chocProngL': '脚长（Y）',
  'tip.chocProngL': 'Choc 每只脚沿 Y 的长度（mm）。公差为正时会减小。',
  'label.chocSpacing': '两脚中心距',
  'tip.chocSpacing': '两只脚中心之间的距离（mm）。',
  'label.chocProngZ': '脚底高度',
  'tip.chocProngZ': '脚尖的 Z 高度（mm），负值表示伸出键帽底面以下。',
  'label.homingType': '定位样式',
  'tip.homingType': '横杠：顶面下部的 5 mm 横杠。三点：顶面中央的三个小凸点（KLP）。',
  'homing.bar': '横杠',
  'homing.dots3': '三点',
  'warn.chocStabs': 'Choc 轴暂不支持卫星轴：≥2u 时只生成中间的轴心。',
  'warn.chocRibs': 'Choc 轴不使用十字补强筋（会挡住轴体），已跳过。',
});
Object.assign(en, {
  'preset.klp': 'KLP Normal (low profile)',
  'preset.klp-thumb': 'KLP Thumb',
  'preset.klp-saddle': 'KLP Saddle',
  'row.flat': 'Flat',
  'row.tilted': 'Tilted 15°',
  'row.homing': 'Homing (3 dots)',
  'credit.klp': 'Shape based on KLP Lamé by braindefender',
  'credit.link': '(GitHub link)',
  'label.advanced': 'Advanced',
  'label.switchSize': 'Switch / size',
  'tip.switchSize': 'Quick switch of stem type and spacing standard: Choc size uses an 18 × 17 mm pitch (1u footprint 17.5 × 16.5), MX size a 19.05 mm pitch (1u footprint 18 × 18).',
  'switchSize.choc-choc': 'Choc stem + Choc size',
  'switchSize.choc-mx': 'Choc stem + MX size',
  'switchSize.mx-mx': 'MX stem + MX size',
  'switchSize.mx-choc': 'MX stem + Choc size',
  'label.skirtStyle': 'Skirt',
  'tip.skirtStyle': 'Straight: footprint joined directly to the top. Rounded: vertical at first, then a circular arc curving in to the top (KLP shape).',
  'skirt.straight': 'Straight',
  'skirt.rounded': 'Rounded',
  'label.skirtStraight': 'Vertical part',
  'tip.skirtStraight': 'Rounded skirt: height of the vertical part above the bottom (mm).',
  'label.skirtRadius': 'Arc radius',
  'tip.skirtRadius': 'Rounded skirt: arc radius (mm). Smaller is rounder.',
  'dish.klp': 'KLP recess',
  'dish.klpThumb': 'KLP thumb',
  'dish.klpSaddle': 'KLP saddle',
  'tip.dishType': 'Type of the concave top: cylindrical (Cherry/OEM), spherical (SA/DSA) or flat. KLP recess is a sculpted recess with a narrow rim; KLP thumb also drops the front edge, KLP saddle drops front and back.',
  'label.sculptRim': 'Recess rim',
  'tip.sculptRim': 'KLP recess: width of the flat rim between the top edge and the recess (mm).',
  'label.sculptDrop': 'Edge drop',
  'tip.sculptDrop': 'KLP thumb/saddle: how far the front (and back) edge drops below the top plane (mm).',
  'stem.choc': 'Choc prongs',
  'tip.stemType': 'Stem interface: MX cross, Kailh Choc v1 prongs, or no stem at all.',
  'label.stemRotate': 'Rotate stem 90°',
  'tip.stemRotate': 'Rotate the whole stem pattern 90° about Z (KLP “rotated” and 1.5U vertical variants).',
  'label.chocProngW': 'Prong width (X)',
  'tip.chocProngW': 'Width of each Choc prong along X (mm). A positive tolerance makes it thinner.',
  'label.chocProngL': 'Prong length (Y)',
  'tip.chocProngL': 'Length of each Choc prong along Y (mm). A positive tolerance makes it shorter.',
  'label.chocSpacing': 'Prong spacing',
  'tip.chocSpacing': 'Distance between the two prong centres (mm).',
  'label.chocProngZ': 'Prong tip Z',
  'tip.chocProngZ': 'Z of the prong tips (mm); negative reaches below the cap bottom.',
  'label.homingType': 'Homing style',
  'tip.homingType': 'Bar: a 5 mm bar on the lower top face. Dots: three small bumps at the top centre (KLP).',
  'homing.bar': 'Bar',
  'homing.dots3': '3 dots',
  'warn.chocStabs': 'Choc stems have no stabilizer support yet: only the centre stem is built for ≥ 2u.',
  'warn.chocRibs': 'Cross ribs are not used with Choc stems (they would block the switch) and were skipped.',
});

const STORAGE_KEY = 'kcg-lang';
let current = 'zh';

function detectLang() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    }
  } catch (_) { /* private mode */ }
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return /^zh/i.test(navigator.language) ? 'zh' : 'en';
    }
  } catch (_) { /* ignore */ }
  return 'zh';
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/** Translate a key, falling back to en then the key itself. */
export function t(key, vars) {
  const dict = dictionaries[current] || dictionaries.en;
  let s = dict[key];
  if (s == null) s = dictionaries.en[key];
  if (s == null) return key;
  return interpolate(s, vars);
}

export function getLang() { return current; }

export function setLang(lang) {
  if (lang !== 'zh' && lang !== 'en') lang = 'en';
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    applyI18n(document);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }
}

export function toggleLang() {
  setLang(current === 'zh' ? 'en' : 'zh');
  return current;
}

/** Apply translations to a DOM subtree. Handles the documented data-* attrs. */
export function applyI18n(root) {
  if (typeof document === 'undefined') return;
  root = root || document;
  const q = (sel) => root.querySelectorAll(sel);

  q('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  q('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  q('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  q('[data-i18n-tip]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-tip')));
  });
  q('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
}

/** Dev-only guard: both dictionaries must share the same key set. */
export function assertDictionaryParity() {
  const a = Object.keys(zh).sort();
  const b = Object.keys(en).sort();
  const onlyZh = a.filter((k) => !(k in en));
  const onlyEn = b.filter((k) => !(k in zh));
  if (onlyZh.length || onlyEn.length) {
    console.warn('[i18n] dictionary key mismatch', { onlyZh, onlyEn });
  }
  console.assert(!onlyZh.length && !onlyEn.length, '[i18n] dictionary parity');
  return { onlyZh, onlyEn };
}

// Initialise language from storage/OS as early as possible.
current = detectLang();

// Keep the <html lang> attribute honest on load.
if (typeof document !== 'undefined') {
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
}
