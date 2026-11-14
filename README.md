# Halo 插件：2048 小游戏（plugin-game-2048）

一个完整可运行的 Halo 2.x 插件，为站点加入 2048 数字滑块游戏：

- **Console 后台**：左侧「工具」分组下新增「2048 小游戏」页面（Vue 3 + TypeScript）
- **前台页面**：通过 `ReverseProxy` 暴露独立游戏页，自动注册 `primary` 主菜单入口，也可 iframe 嵌入文章/自定义页面
- **Ethereal 主题适配**：自动跟随站点明暗模式与 `--hue` 主题色，提供主题同款卡片容器，无需修改主题文件或注入脚本
- **全站排行榜**：Halo 自定义模型 `GameScore` 持久化，公开 `CustomEndpoint` 读写，匿名角色模板授权
- **任意博客也能用**：前台页是纯 HTML/CSS/JS，`standalone/` 提供免后端的单文件版与四文件版
- **一份规则，三处复用**：`ui/src/core/game2048.js` 是唯一算法源码，Console 直接 import，前台页面由构建脚本生成 IIFE 版本，Node 测试直接 import

---

## 目录结构

```
.
├── build.gradle                     # 根 Gradle：Java 21 + Halo 平台 BOM + UI 产物打包
├── settings.gradle                  # 多项目（root + ui）
├── gradle.properties                # version=1.0.0（构建时写入 plugin.yaml 的 spec.version）
├── gradlew / gradlew.bat            # Gradle Wrapper 脚本
├── gradle/wrapper/
│   ├── gradle-wrapper.jar           # Wrapper 二进制（随仓库提供）
│   └── gradle-wrapper.properties    # Gradle 9.4.0 + 国内镜像 + sha256 校验
├── scripts/
│   ├── build-standalone.mjs         # 由核心算法生成前台 game-core.js（零第三方依赖）
│   └── build-blog-pack.mjs          # 生成 standalone/ 静态包与单文件版
├── deploy/
│   ├── embed-snippet.html           # 可直接粘贴到文章 HTML 块的 iframe 片段
│   ├── page-2048.html               # 完整的自定义页面内容（零脚本、同源相对路径）
│   └── ethereal/                    # Ethereal 主题专用
│       ├── embed.html               # 主题同款卡片容器片段
│       ├── page.html                # 主题风格的完整自定义页面
│       └── theme-bridge.js          # 可选：不写 localStorage 的主题用 postMessage 同步
├── standalone/
│   ├── 2048.html                    # 单文件版：CSS/JS 全内联，强制本地榜（约 30 KB）
│   └── game/                        # 四文件版：index.html + style.css + app.js + game-core.js
├── src/main/
│   ├── java/run/halo/game2048/
│   │   ├── Game2048Plugin.java      # 生命周期：注册/注销 Scheme + score 索引
│   │   ├── GameScore.java           # 自定义模型（GVK: game2048.halo.run/v1alpha1）
│   │   ├── ScoreService.java        # 输入校验、规范化、排行榜查询与写入
│   │   ├── ScoreEndpoint.java       # 公开 API + 每 IP 滑动窗口限流
│   │   ├── ScoreSubmit.java         # 请求 DTO
│   │   └── ScoreView.java           # 响应投影
│   └── resources/
│       ├── plugin.yaml              # 插件清单（requires >=2.27.0）
│       ├── logo.svg
│       ├── extensions/
│       │   ├── menu-item.yaml       # 预置前台导航菜单项（primary 主菜单）
│       │   ├── reverse-proxy.yaml   # 静态资源代理 /game/**
│       │   └── role-template.yaml   # 匿名只读+提交权限 / 可选管理角色
│       └── static/game/
│           ├── index.html           # 前台游戏页（也是 standalone/ 的源文件）
│           ├── style.css
│           ├── app.js               # 前台控制器（模式可配置，默认本地榜）
│           └── game-core.js         # 由 scripts/build-standalone.mjs 生成
└── ui/
    ├── package.json / vite.config.ts / build.gradle
    ├── src/
    │   ├── index.ts                 # definePlugin 注册菜单路由
    │   ├── api/scores.ts            # 排行榜 API 封装
    │   ├── core/game2048.js         # ★ 唯一算法源码
    │   ├── core/game2048.d.ts       # 算法类型声明
    │   └── views/GameView.vue       # Console 游戏页面
    └── test/
        ├── game2048.test.mjs        # 核心算法单测（19 例）
        ├── standalone.test.mjs     # 前台本地模式冒烟（6 项）
        ├── halo-mode.test.mjs      # Halo 在线模式 API 冒烟（4 项）
        ├── blog-pack.test.mjs      # 静态包 / 单文件版部署冒烟（4 项）
        ├── nav-entry.test.mjs      # 导航菜单契约 / 返回链接 / 部署片段（4 项）
        └── ethereal-theme.test.mjs # Ethereal 明暗/色相同步与主题片段（7 项）
```

---

## 环境要求

| 组件 | 版本 |
| --- | --- |
| Halo | **>= 2.27.0**（仅插件模式需要；纯前端部署不需要 Halo） |
| JDK | 21 |
| Gradle | 9.4.0（wrapper 已内置，也可用系统安装） |
| Node / npm | 22+ / 10+ |

<details>
<summary>Windows 免安装部署示例（可选，仅作环境配置参考）</summary>

从清华 TUNA Adoptium 镜像下载 JDK 21 的 Windows ZIP、从华为云镜像下载 Gradle 9.4.0，解压到用户目录（无需管理员权限），例如 `~/.workbuddy/tools/jdk/jdk-21.0.13+9` 与 `~/.workbuddy/tools/gradle/gradle-9.4.0`，再写入用户级 `JAVA_HOME` / `GRADLE_HOME` / `Path`。

**新打开的终端窗口**即可直接使用 `java`、`javac`、`gradle` 与 `.\gradlew.bat`；已经开着的窗口需重新打开才会读到新环境变量——这是 Windows 环境变量的常规行为。

项目自带的 `gradle/wrapper/gradle-wrapper.properties` 将分发地址指向华为云镜像并附带 sha256 校验（因为 `services.gradle.org` 会重定向到 GitHub Release，部分网络环境下不可达）；需要切回官方源时改回 `https\://services.gradle.org/distributions/gradle-9.4.0-bin.zip` 并删除 `distributionSha256Sum` 与 `validateDistributionUrl=false` 即可。

</details>

## 构建

```bash
# 1) 算法源码变更后，重新生成前台页面的核心脚本
node scripts/build-standalone.mjs

# 1b) 生成可部署到任意博客的静态包（standalone/）
node scripts/build-blog-pack.mjs

# 2) 一条命令完成：UI 依赖安装 + Vite 构建 + 44 项测试 + Java 编译 + JAR 打包
./gradlew build          # Windows: .\gradlew.bat build
# 产物：build/libs/plugin-game-2048-1.0.0.jar
```

Gradle 的 `classes` 依赖 `ui:assemble`，因此第 2 步会自动执行 `npmInstall` / `vite build` / `npm test`，并把 `ui/build/dist` 复制进 JAR 的 `ui/` 目录（Halo 2.11+ 优先读这里）。也可以单独跑 `cd ui && npm install && npm test && npm run build`。

> **Wrapper 分发源**：`gradle/wrapper/gradle-wrapper.properties` 指向华为云镜像（`repo.huaweicloud.com`），带 `distributionSha256Sum` 完整性校验，并设置 `validateDistributionUrl=false`——官方源会重定向到 GitHub，国内网络不可达。  
> 如需切回官方源：把 `distributionUrl` 改为 `https\://services.gradle.org/distributions/gradle-9.4.0-bin.zip`，并把 `validateDistributionUrl` 改回 `true`。

安装：Halo 控制台 → 插件 → 上传插件 → 选择 JAR → 启用。

本地联调（需 Docker）：`./gradlew haloServer`，访问 `http://localhost:8090/console`（admin / admin）。

---

## 使用方式

### 1. Console 后台

插件启用后，左侧「工具」分组出现 **2048 小游戏**。方向键 / WASD 移动，支持撤销一步、昵称、提交成绩和全站排行榜。

### 2. 前台独立页面

```
/plugins/plugin-game-2048/assets/game/index.html
```

插件启用后，`extensions/menu-item.yaml` 会向 `primary` 主菜单注册「2048 小游戏」，访客点击即全屏打开游戏页；全屏页顶部有「← 返回博客首页」（iframe 内自动隐藏）。若站点改过主菜单名，可在后台「外观 → 菜单」手工加一条自定义链接。

嵌入文章或自定义页面，可直接复制 `deploy/embed-snippet.html`；想要带标题与说明的完整页面内容则用 `deploy/page-2048.html`：

```html
<iframe
  src="/plugins/plugin-game-2048/assets/game/index.html"
  title="2048 小游戏"
  loading="lazy"
  style="display:block;width:100%;max-width:920px;height:clamp(720px,92vh,900px);border:0"></iframe>
```

两个片段都是同源相对路径、零脚本，兼容 `X-Frame-Options: SAMEORIGIN`。iframe 内需先点一下游戏区域，方向键才会被捕获；编辑器若过滤 iframe，可直接写进主题模板。

> 该页面**也可以直接用浏览器打开本地文件预览**：不在 Halo 环境下时会自动降级为 `localStorage` 本地排行榜，游戏本身完全可玩。

### 3. 游戏操作

| 操作 | 方式 |
| --- | --- |
| 移动 | 方向键 / WASD / 触屏滑动 |
| 撤销 | 「撤销一步」按钮（保留最近一步） |
| 重开 | 「新游戏」按钮 |
| 上榜 | 游戏结束自动提交，或点「提交成绩」手动提交 |

---

## 部署到个人博客前端

**结论：能，而且大多数情况下根本不需要 Halo 插件。** 前台游戏页是纯 HTML/CSS/JS，只有「全站排行榜」依赖 Halo 后端；游戏本身、键盘/触屏操作、撤销、最高分完全在浏览器里运行。

| 你的博客 | 做法 | 排行榜 |
| --- | --- | --- |
| Halo >= 2.27 | 上传 JAR 并启用，iframe 指向插件静态页 | 全站榜（Halo API） |
| Hexo / Hugo / VuePress / GitHub Pages | 上传 `standalone/2048.html` 或 `standalone/game/` | 浏览器本地榜 |
| WordPress / Typecho / 任意 PHP 站 | 上传到站点目录，用「自定义 HTML」区块放 iframe | 浏览器本地榜 |
| 纯本地预览 | 双击 `standalone/2048.html` | 浏览器本地榜 |

### 方案 A：博客就是 Halo

无需改动前端代码：上传 `build/libs/plugin-game-2048-1.0.0.jar` → 启用 → 按上文用 iframe 嵌入。Console 菜单、全站排行榜、匿名提交权限随插件一起生效。

### 方案 B：任意静态博客（推荐单文件版）

1. 生成静态包：`node scripts/build-blog-pack.mjs`
2. 把 `standalone/2048.html`（约 30 KB，CSS/JS 已内联，零外部依赖、零网络请求）上传到站点任意目录，例如 `/games/2048.html`
3. 在文章或自定义页面嵌入：

```html
<iframe
  src="/games/2048.html"
  style="width:100%;max-width:920px;height:780px;border:0"
  loading="lazy"
  title="2048 小游戏"></iframe>
```

四文件版 `standalone/game/` 适合希望单独托管/缓存 CSS 与 JS 的情况，整个目录原样上传即可（内部使用相对路径）。

> 单文件版内置 `window.GAME2048_CONFIG = { mode: 'local' }`，**不会向任何接口发请求**；成绩保存在访客浏览器的 `localStorage`，页脚也不再标注 Halo 插件。

平台提示：

- **Hexo / Hugo**：文件放进 `source/`（Hexo）或 `static/`（Hugo），Markdown 中直接写 iframe；若主题过滤 HTML，用各自的 raw HTML shortcode。
- **WordPress**：上传到媒体库或主题目录，用「自定义 HTML」区块放 iframe；部分编辑器会过滤 iframe，需改用支持 HTML 的区块或短代码。
- **GitHub Pages / 对象存储 / CDN**：直接托管 `2048.html`，iframe 的 `src` 换成绝对 URL。
- **CSP 限制**：单文件内联了脚本与样式，若站点 CSP 禁止 `unsafe-inline`，改用四文件版（外部 `app.js` / `style.css`）并放行同源资源。

### 想要跨访客排行榜，但博客不是 Halo？

在页面脚本之前设置自定义接口地址：

```html
<script>window.GAME2048_CONFIG = { apiBase: "https://your-api.example.com/scores" };</script>
```

接口需实现 `GET /scores?size=10`（返回数组）与 `POST /scores`（返回 JSON），允许博客域名跨域（CORS），或反代到博客同域避免跨域。字段格式见下方 API 章节。反过来，若部署在 Halo 上却只想用本地榜，设 `{ mode: 'local' }` 即可强制离线。

> 模式判定优先级：`mode: 'local'` > 显式 `apiBase` > Halo 插件自身路径 > 默认本地榜。插件路径现在是精确匹配 `/plugins/plugin-game-2048/assets/game/`，普通博客路径里出现 `/plugins/` 不会再误发请求。

### 前端接入实操：mlingxi.cn（Halo 2.27.2 / 强制 HTTPS）

只读探测结果（2026-11-14）：

| 项目 | 结果 |
| --- | --- |
| 建站程序 | Halo **2.27.2**（`meta generator`），主题 Ethereal，满足 `requires >=2.27.0` |
| 主菜单标识 | 主题渲染数据中出现 `"menu":"primary"`，即默认主菜单名为 `primary` |
| 协议 | HTTP 302 → HTTPS，全站使用 `https://mlingxi.cn`；HEAD 请求被 WAF 处理返回 404，GET 正常 200 |
| 后台入口 | `https://mlingxi.cn/console`（未登录跳 `/login?authentication_required`） |
| 插件静态资源 | 已有插件 `/plugins/PluginCodeEnhance/assets/...` 返回 200，ReverseProxy 机制可用 |
| 响应头 | **`X-Frame-Options: SAMEORIGIN`**（iframe 必须同源）、无 CSP、有 WAF（`X-WAF-UUID`）、下发 `XSRF-TOKEN` |
| 线上插件状态 | `index.html` / `style.css` / `app.js` / `game-core.js` 均 200；`GET /apis/api.game2048.halo.run/v1alpha1/scores` 返回真实成绩，说明匿名读取与成绩写入均已打通、WAF 未拦截 |
| 已有游戏入口 | 探测时导航中无 2048 入口，`/2048`、`/game` 等路径均 404 |

**结论：插件已经在跑，缺的只是「前台入口」。** 下面三种方式任选其一，都需要你在后台点最后一下（上传或保存），我无法代登录。

#### 方式 1（推荐 · 零手工）：让插件自动把游戏挂进导航栏

新版 JAR 内置 `extensions/menu-item.yaml`，插件启动时向 `primary` 主菜单注册一个 `MenuItem`：

| 字段 | 值 |
| --- | --- |
| `spec.displayName` | `2048 小游戏` |
| `spec.href` | `/plugins/plugin-game-2048/assets/game/index.html`（同源相对路径） |
| `spec.menuName` | `primary` |
| `status.*` | 显式写入，主题读 `status.displayName/status.href` 也能渲染 |

操作：控制台 → 插件 → 找到 2048 插件 → **「更新插件」**上传 `build/libs/plugin-game-2048-1.0.0.jar` → 等待重启 → 刷新前台（必要时清 `/plugins/plugin-game-2048/**` 的 CDN 缓存）。导航栏出现「2048 小游戏」，点击全屏打开游戏，页面顶部有「← 返回博客首页」。

> ⚠️ 用「更新插件」覆盖上传，**不要卸载再安装**：Halo 会清理预置资源，且可能连带清掉 `GameScore` 里的成绩数据。若你的主菜单被改过、不再叫 `primary`，自动项不会显示，改用方式 2。

#### 方式 2（不升级插件 · 30 秒）：后台手工加菜单项

控制台 → 外观 → 菜单 → 选中主菜单 → 新建：

- 类型：`自定义链接`
- 名称：`2048 小游戏`
- 链接地址：`/plugins/plugin-game-2048/assets/game/index.html`
- 打开方式：`当前窗口`

保存后前台导航立即出现入口，旧版插件也能用。这种方式不依赖新 JAR，但也不会有「返回博客首页」链接（浏览器后退即可）。

#### 方式 3：把游戏嵌进文章或自定义页面

新建「页面」（别名建议 `2048`），切到 HTML / 源码模式，整段粘贴 `deploy/page-2048.html`；或只在文章 HTML 块里粘贴 `deploy/embed-snippet.html`。两者都是**同源相对路径 + 零脚本**，兼容 `SAMEORIGIN`，也不怕编辑器过滤 `<script>`。

最短片段：

```html
<iframe
  src="/plugins/plugin-game-2048/assets/game/index.html"
  title="2048 小游戏"
  loading="lazy"
  style="display:block;width:100%;max-width:920px;height:clamp(720px,92vh,900px);border:0"></iframe>
```

`deploy/` 里的版本额外做了：高度随视口自适应、圆角与背景色、键盘焦点提示（iframe 内需先点一下游戏区域才能接收方向键）、以及「全屏打开」链接。若编辑器连 `iframe` 也过滤，就写进主题模板。

> iframe 的 `src` 必须是同源相对路径，不能写其他域名或 CDN，否则会被 `X-Frame-Options: SAMEORIGIN` 拒绝。

#### 部署后核对清单

1. 前台导航出现「2048 小游戏」（方式 1 / 2），或页面显示 4×4 棋盘（方式 3）
2. 方向键 / WASD 能移动，触屏可滑动；提交成绩后刷新排行榜能看到新记录
3. `https://mlingxi.cn/console` 的「工具」分组下有「2048 小游戏」
4. 若升级过 JAR：`.../assets/game/app.js` 含 `GAME2048_CONFIG`，全屏页顶部有返回链接

> 探测时线上 `app.js` 仍是 09:26 首版（`/plugins/` 子串判定 + 旧页脚），功能在本站路径下正常。新 JAR 除了加固模式判定，还新增了自动导航菜单项、返回链接与 Ethereal 主题适配，因此这次值得用「更新插件」覆盖上传。

---

## 适配 Ethereal 主题

**能，而且不需要修改主题文件，也不需要注入脚本。** 以下结论来自 mlingxi.cn 线上实测（Ethereal **2.1.0**，Fuwari 系 / Astro + Tailwind v4），不是通用猜测。

### 实测到的主题契约

| 项目 | 实测值 |
| --- | --- |
| 明暗标记 | `<html data-color-scheme="auto" class="... color-scheme-auto">`；切换时加 `.dark`、改 `color-scheme-*` |
| 主题状态 | `localStorage.theme`（`light` / `dark` / `auto`）、`__user_chose_theme`、`hue`（站点当前 `themeColor.hue = 250`，`data-hue-fixed="false"` 表示访客可调） |
| 亮色变量 | `--primary: oklch(.7 .14 var(--hue))`、`--card-bg: white`、`--deep-text: oklch(.25 .02 var(--hue))`、`--btn-regular-bg: oklch(.95 .025 var(--hue))` |
| 暗色变量 | `:root.dark` → `--primary: oklch(.75 .14 var(--hue))`、`--card-bg: oklch(.23 .015 var(--hue))`、`--deep-text: oklch(.85 .02 var(--hue))` |
| 卡片风格 | `--radius-large: 1rem`；站点启用了 `card-border-enabled`、`card-follow-theme-enabled` |

Halo 官方「与插件集成」文档要求主题在 `<html>`/`<body>` 上打 `color-scheme-*` / `data-color-scheme` 公共标记，插件组件据此继承明暗；Ethereal 2.0.1 起也补齐了「插件配色支持」与页脚注入扩展点。

### 适配做了什么

1. **明暗与主题色自动跟随**：游戏页是 ReverseProxy 暴露的独立 HTML 文档，拿不到父页 CSS 变量；但它与站点**同源**，因此 `app.js` 直接读上述 `localStorage`，设置同样的 `.dark` / `data-color-scheme` / `color-scheme-*` 标记，并监听 `storage` 事件与 `prefers-color-scheme` 变化。`style.css` 复用同一套 `oklch(...)` 变量，主题色相与明暗切换实时生效——**访客切主题时游戏不刷新、进度不丢**。
2. **主题同款容器**：`deploy/ethereal/embed.html`、`page.html` 用 `--card-bg` / `--primary` / `--radius-large` 构建卡片，游戏页内部自动对齐。棋盘保留 2048 经典配色保证数字可读性，只把外围（背景、卡片、按钮、文字、边框）主题化。
3. **导航入口**：`menu-item.yaml` 走 Halo 标准 `MenuItem`，Ethereal 的导航栏与移动抽屉都从 menuFinder 取 `primary` 菜单，因此「2048 小游戏」会自动出现；若改过菜单组名或主题写死菜单，用前面「方式 2」手工加。

### 配置

在页面脚本之前设置（一般无需设置，自动识别即可）：

| 键 | 值 | 说明 |
| --- | --- | --- |
| `theme` | 不设 / `'auto'` | 自动识别同源 Ethereal（**仅 Halo 部署**） |
| | `'ethereal'` | 强制启用主题皮肤 |
| | `'off'` | 关闭，回到 2048 经典配色 |
| `defaultHue` | 数字，默认 `250` | 读不到 `localStorage.hue` 时的色相 |

```html
<script>window.GAME2048_CONFIG = { theme: 'ethereal', defaultHue: 250 };</script>
```

### 可选：父页主动同步（一般不需要）

Ethereal 2.x 会把主题写进 localStorage，上面的机制已足够。若换成不写 localStorage 的主题，或希望切换时零延迟，把 `deploy/ethereal/theme-bridge.js` 放进「设置 → 代码注入 → 页脚」：它监听 `<iframe data-game2048>`，把 `data-color-scheme` 与 `--hue` 通过同源 `postMessage` 推给游戏页（`game2048:theme` 消息；游戏页只接受 `event.origin === location.origin`，不接受跨域消息）。

### 边界

- Halo 2.26+ 的 `templates/layout.html` 页面布局契约可让**由 Thymeleaf 渲染的插件前台页**复用主题外壳；本插件的游戏页是静态资源代理，不走该契约，因此采用「变量同步 + 卡片容器」而非模板覆盖。
- `oklch()` / `color-mix()` 需要较新浏览器，与 Ethereal 自身要求一致。
- 自动识别只在 Halo 部署（可访问排行榜 API）时启用；纯静态博客即使 localStorage 有同名键，也不会被误改皮肤。

---

## API

公开 `CustomEndpoint`（匿名可访问，由 `role-template.yaml` 聚合到 anonymous 角色）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/apis/api.game2048.halo.run/v1alpha1/scores?size=10` | 排行榜，按 `spec.score` 降序，size 范围 1–50 |
| POST | `/apis/api.game2048.halo.run/v1alpha1/scores` | 提交成绩 |

POST 请求体：

```json
{
  "player": "小明",
  "score": 20480,
  "maxTile": 2048,
  "moves": 930,
  "won": true
}
```

响应字段：`player / score / maxTile / moves / won / createdAt`。

底层自定义模型的管理 API（需角色授权，不对匿名开放）：

```
GET|POST /apis/game2048.halo.run/v1alpha1/gamescores
GET|PUT|DELETE /apis/game2048.halo.run/v1alpha1/gamescores/{name}
```

**服务端约束**：昵称去控制字符、去首尾空格、长度 1–24；分数 0–10,000,000；`maxTile`/`moves` 钳制到合法范围；每 IP 60 秒最多提交 10 次（超限返回 429）；匿名角色只有 `scores` 的 `get/list/create`，无法直接改写 `gamescores`。

---

## 验证状态

已在本机实际执行并通过（2026-11-14，JDK 21.0.13+9 / Gradle 9.4.0 / Node 22）：

- ✅ **`./gradlew build`：BUILD SUCCESSFUL** — `compileJava` 真实编译通过，`jar` 产出 `build/libs/plugin-game-2048-1.0.0.jar`（36 KB）；加入 Ethereal 主题适配后再次增量重建成功（25 秒）
- ✅ **JAR 内容核验**：32 个条目，含 7 个 `.class`、`plugin.yaml`（version 1.0.0 / requires >=2.27.0）、3 个 extensions YAML、`static/game/` 4 个前台文件、`ui/` ESM 产物与 `ui-plugin.json`、`META-INF/plugin-components.idx`；已解包核验 `menu-item.yaml` 字段、`app.js` 的 `setupThemeSync` / `game2048:theme` 与 `style.css` 的 `:root.theme-ethereal` + `oklch` 变量
- ✅ **`npm test` / `ui:npmCheck`：44 项全部通过**（36 个顶层用例）— 核心算法 19 + 前台本地模式 6 + Halo 在线模式 4 + 静态部署包 4 + 导航接入 4 + **Ethereal 适配 7**（自动识别暗色与色相、storage 事件免刷新切换、`theme:off`、强制启用、静态博客隔离、同域 postMessage 与跨域拒绝、主题片段契约）
- ✅ `./gradlew --version` 自举下载 Gradle 9.4.0 并通过 sha256 校验；`java -version` / `javac -version` 均为 21.0.13
- ✅ 6 个 Java 文件语法解析、4 个 YAML 解析、`theme-bridge.js` 语法检查、API 路径四端一致性检查全部通过
- ✅ **线上只读实测（mlingxi.cn）**：插件静态页四个资源 200；排行榜 API 返回真实成绩，证明匿名读取与写入均通；主菜单标识 `primary`、Ethereal 2.1.0 的 `data-color-scheme` / `--hue` / `oklch` 变量均从渲染页面与主题 CSS 中确认

**仍未验证**：本机无 Docker、无本地 Halo 实例，因此**新增的 `MenuItem` 预置资源加载、返回链接、Ethereal 明暗/色相在真实浏览器中的视觉表现**，需要在站点用「更新插件」上传新 JAR 后确认（同步逻辑已由 jsdom 覆盖）。旧能力（插件加载、Console 菜单、排行榜读写、ReverseProxy 路径）已由线上实测覆盖。**纯前端静态包不依赖 Halo，可直接部署。**

> 2026-11-14 10:38 复核：线上 `app.js` 仍为 11025 字节的首版，说明新 JAR 尚未上传，前台主题适配暂未生效。

> 构建日志中有一条 `Deprecated Gradle features ... incompatible with Gradle 10` 提示，来自第三方 Gradle 插件，不影响 Gradle 9.4.0 构建；将来升级 Gradle 10 时需同步升级这些插件。

---

## 已知限制

- 排行榜按单局分数排序，不做同名玩家去重；同一玩家每局结束产生一条记录。
- 限流是**单实例内存级**滑动窗口；Halo 集群部署时应改用网关或 Redis 限流。
- 撤销只保留最近一步。
- 独立部署版默认只有浏览器本地排行榜（每位访客各存各的）；要全站榜需自建 API 或使用 Halo 插件模式。
- 预置菜单项绑定 `primary` 主菜单；若站点改过菜单组名，需在后台手工添加自定义链接。插件被禁用时 Halo 会清理预置资源，该菜单项也会随之消失。
- `menu-item.yaml` 同时写入 `spec` 与 `status` 以兼容主题的渲染取值；若某版 Halo 在加载预置资源时剥离 `status`，菜单可能不渲染，此时用「外观 → 菜单」手工加一条即可。
- Ethereal 主题同步依赖**同源** `localStorage`；若把游戏页托管到独立子域/CDN，无法读取站点主题状态，需改用 `theme-bridge.js` 的 `postMessage` 通道或直接设 `theme: 'off'`。
- ESM 产物要求 Halo >= 2.27.0；若需兼容更旧的 Halo，可在 `ui/vite.config.ts` 里显式设置 `format: "iife"` 并相应调整 `plugin.yaml` 的 `requires` 与 Gradle 复制目录。

## 许可

MIT
