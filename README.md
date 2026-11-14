# Halo 插件：2048 小游戏（plugin-game-2048）

一个完整可运行的 Halo 2.x 插件，为站点加入 2048 数字滑块游戏。**插件面向所有 Halo 站点，不绑定任何具体域名。**

> **1.0.8 起：插件启动会自动创建并发布 slug 为 `game2048` 的页面**，装好 JAR 就能打开 `https://你的域名/game2048`，不再需要手动新建页面。原来手动粘贴片段的方式仍作为兜底保留。
>
> **1.0.11 起：浏览器 100% 缩放、游戏内部零滚动**，浏览器保持 100% 缩放即可一屏游玩，不用再手动缩小网页（见「自适应视口」）。

## 访问约定（硬性要求）：`https://你的域名/game2048`

> 「你的域名」指的是**安装本插件的那个 Halo 站点自己的域名**，不是某个固定值。插件里**没有任何域名配置、host 白名单、回调地址或绝对外链**：自定义页面、iframe、静态资源、排行榜 API 全部使用同源根相对路径，协议、域名、端口由浏览器当前地址自动决定。
>
> 因此同一份 JAR 可以直接装到任意数量的站点上——个人域名、二级域名、新顶级域、内网 IP + 端口、本地 `localhost:8090` 都适用，**无需改代码、无需填域名、无需按域名重新打包**。站点启用 HTTPS 后即自动是 `https://你的域名/game2048`；用 HTTP 访问时同样自动是 `http://你的域名/game2048`。
>
> 后台唯一动作是上传 / 启用 JAR：插件启动会自动创建 slug 为 `game2048` 的已发布公开页面（见「使用方式」），这一步与域名无关，插件本身不知道也不需要知道站点域名。

> **当前形态：仅前台模式（frontend-only）**。插件**不在 Console 侧边栏注册菜单页**，也**不向前台导航自动添加菜单项**；游戏只通过自定义页面 `https://你的域名/game2048` 访问。Console 的「插件」列表里仍会列出本插件（Halo 机制，无法隐藏），但点进去只有插件详情，没有游戏页面。恢复方法见「恢复 Console 页面」。

- **零域名配置**：所有 URL 均为同源根相对路径（`/game2048`、`/plugins/...`、`/apis/...`），运行时不读取 hostname，主题同步仅用 `location.origin` 做同源校验
- **自动建页**：`Game2048PageInitializer` 在插件启动时幂等创建 `SinglePage` + 内容 `Snapshot`，已发布、公开、slug = `game2048`，重启不会重复创建、不覆盖已有内容
- **前台唯一入口**：Halo 自定义页面 `/{slug}`（slug = `game2048`），内容用同源 iframe 承载游戏页
- **静态游戏页**：`ReverseProxy` 暴露 `/plugins/plugin-game-2048/assets/game/index.html`，纯 HTML/CSS/JS，被上述页面引用
- **自适应视口**：iframe 高度取父视口剩余空间，嵌入时精简重复页头，棋盘按可用高度动态缩放，`dvh` 兜底；100% 缩放直接可玩
- **Ethereal 主题适配**：自动跟随站点明暗模式与 `--hue` 主题色，提供主题同款卡片容器，无需修改主题文件或注入脚本
- **全站排行榜**：Halo 自定义模型 `GameScore` 持久化，公开 `CustomEndpoint` 读写，匿名角色模板授权
- **任意博客也能用**：前台页是纯 HTML/CSS/JS，`standalone/` 提供免后端的单文件版与四文件版
- **一份规则，三处复用**：`ui/src/core/game2048.js` 是唯一算法源码；Console 页面源码保留但不打包进 JAR，前台页面由构建脚本生成 IIFE 版本，Node 测试直接 import

---

## 目录结构

```
.
├── build.gradle                     # 根 Gradle：Java 21 + Halo 平台 BOM + 排除 Console UI 产物
├── settings.gradle                  # 多项目（root + ui）
├── gradle.properties                # version=1.0.8（构建时写入 plugin.yaml 的 spec.version）
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
│   │   ├── Game2048Plugin.java      # 生命周期：Scheme / score 索引 + 触发自动建页
│   │   ├── Game2048PageInitializer.java # ★ 幂等创建已发布的 /game2048 页面与内容快照
│   │   ├── GameScore.java           # 自定义模型（GVK: game2048.halo.run/v1alpha1）
│   │   ├── ScoreService.java        # 输入校验、规范化、排行榜查询与写入
│   │   ├── ScoreEndpoint.java       # 公开 API + 每 IP 滑动窗口限流
│   │   ├── ScoreSubmit.java         # 请求 DTO
│   │   └── ScoreView.java           # 响应投影
│   ├── resources/
│   │   ├── plugin.yaml              # 插件清单（requires >=2.27.0）
│   │   ├── logo.svg
│   │   ├── page/game2048.html       # 自动创建页面时写入的 HTML 内容（同源、零脚本）
│   │   ├── extensions/
│   │   │   ├── reverse-proxy.yaml   # 静态资源代理 /game/**
│   │   │   └── role-template.yaml   # 匿名只读+提交权限 / 可选管理角色
│   │   └── static/game/
│   │       ├── index.html           # 前台游戏页（也是 standalone/ 的源文件）
│   │       ├── style.css
│   │       ├── app.js               # 前台控制器（模式可配置，默认本地榜）
│   │       └── game-core.js         # 由 scripts/build-standalone.mjs 生成
│   └── test/java/run/halo/game2048/
│       └── Game2048PageInitializerTest.java # 自动建页的 JUnit + Mockito 单测（5 项）
└── ui/                              # 算法源码 + Node 测试；产物默认不进 JAR
    ├── package.json / vite.config.ts / build.gradle
    ├── src/
    │   ├── index.ts                 # definePlugin 菜单路由（源码保留，不打包）
    │   ├── api/scores.ts            # 排行榜 API 封装
    │   ├── core/game2048.js         # ★ 唯一算法源码
    │   ├── core/game2048.d.ts       # 算法类型声明
    │   └── views/GameView.vue       # Console 游戏页面（当前形态未启用）
    └── test/
        ├── game2048.test.mjs        # 核心算法单测（19 例）
        ├── standalone.test.mjs     # 前台本地模式冒烟（6 项）
        ├── halo-mode.test.mjs      # Halo 在线模式 API 冒烟（4 项）
        ├── blog-pack.test.mjs      # 静态包 / 单文件版部署冒烟（4 项）
        ├── nav-entry.test.mjs      # 仅前台构建契约 / 返回链接 / 部署片段（5 项）
        ├── ethereal-theme.test.mjs # Ethereal 明暗/色相同步与主题片段（7 项）
        ├── domain-agnostic.test.mjs # 域名无关契约 / 多站点运行时 / 子路径前缀（5 项）
        └── auto-page.test.mjs      # 自动建页契约 / 内容片段同源零脚本（5 项）
```

---

## 环境要求

| 组件         | 版本                                   |
| ---------- | ------------------------------------ |
| Halo       | **>= 2.27.0**（仅插件模式需要；纯前端部署不需要 Halo） |
| JDK        | 21                                   |
| Gradle     | 9.4.0（wrapper 已内置，也可用系统安装）           |
| Node / npm | 22+ / 10+                            |

<details>

<summary>Windows 免安装部署示例（可选，仅作环境配置参考）</summary>

从清华 TUNA Adoptium 镜像下载 JDK 21 的 Windows ZIP、从华为云镜像下载 Gradle 9.4.0，解压到用户目录（无需管理员权限），例如 `~/.workbuddy/tools/jdk/jdk-21.0.13+9` 与 `~/.workbuddy/tools/gradle/gradle-9.4.0`，再写入用户级 `JAVA_HOME` / `GRADLE_HOME` / `Path`。

**新打开的终端窗口**即可直接使用 `java`、`javac`、`gradle` 与 `.\gradlew.bat`；已经开着的窗口需重新打开才会读到新环境变量——这是 Windows 环境变量的常规行为。

项目自带的 `gradle/wrapper/gradle-wrapper.properties` 将分发地址指向华为云镜像并附带 sha256 校验（因为 `services.gradle.org` 会重定向到 GitHub Release，部分网络环境下不可达）；需要切回官方源时改回 `https\://services.gradle.org/distributions/gradle-9.4.0-bin.zip` 并删除 `distributionSha256Sum` 与 `validateDistributionUrl=false` 即可。

</details>

## 下载（推荐）

不想装 JDK / Gradle 时，直接用 GitHub Release 里已构建好的 JAR：

| 版本 | 文件 | 大小 | SHA-256 |
| --- | --- | --- | --- |
| **v1.0.11（最新）** | [plugin-game-2048-1.0.11.jar](https://github.com/LinuxOega/plugin-game-2048/releases/download/v1.0.11/plugin-game-2048-1.0.11.jar) | 41,769 B | `27e551a45c1873d4a0caee6fd2380b38f1265ec561a5a1d3bec98af1349c2d31` |
| v1.0.10 | [plugin-game-2048-1.0.10.jar](https://github.com/LinuxOega/plugin-game-2048/releases/download/v1.0.10/plugin-game-2048-1.0.10.jar) | 41,161 B | `3fac419331388275fe624c121ebd9cc465a60646ec87fb8735c723430fdde272` |
| v1.0.9 | [plugin-game-2048-1.0.9.jar](https://github.com/LinuxOega/plugin-game-2048/releases/download/v1.0.9/plugin-game-2048-1.0.9.jar) | 40,022 B | `043df78b4d29637554a789b505e8a160cdf89140b9b39d916cb09898957040e1` |

发布页：[LinuxOega/plugin-game-2048 Releases](https://github.com/LinuxOega/plugin-game-2048/releases)，含各版本更新说明与附件。下载后按「使用方式」在 Halo 控制台上传 / 更新即可；源码构建步骤见下一节。

> Release 附件实际从 `objects.githubusercontent.com` 下载，部分网络环境下不可达；此时改用下面的本地构建，产物与 Release 完全一致。`.gitignore` 有意不把 JAR 放进源码仓库，避免二进制文件随每次提交膨胀。

## 构建

```bash
# 1) 算法源码变更后，重新生成前台页面的核心脚本
node scripts/build-standalone.mjs

# 1b) 生成可部署到任意博客的静态包（standalone/）
node scripts/build-blog-pack.mjs

# 2) 一条命令完成：UI 依赖安装 + Vite 构建 + 全部 Node 测试 + Java 编译/单测 + JAR 打包
./gradlew build          # Windows: .\gradlew.bat build
# 产物：build/libs/plugin-game-2048-1.0.11.jar（同一份 JAR 可用于任意域名）
```

`./gradlew build` 仍会跑 `ui:npmInstall` / `vite build` / `npm test`（含域名无关契约测试），但 **Vite 产物不再复制进 JAR**：`build.gradle` 的 `jar` 显式 `exclude 'ui/**'` 与 `exclude 'ui-plugin.json'`，并在 `processResources` 之后清理旧残留。Halo 靠 `resources/ui/ui-plugin.json` 识别 Console 插件入口，JAR 里没有这个文件就不会注册侧边栏菜单。`ui/` 因此只承担「算法唯一源码 + Node 测试」的职责。也可以单独跑 `cd ui && npm install && npm test && npm run build`。

### 恢复 Console 页面

若以后想让「2048 小游戏」重新出现在 Console 左侧「工具」分组：在 `build.gradle` 加回一个 `Copy` 任务，把 `ui/build/dist` 复制到 `build/resources/main/ui`，并删掉 `jar` 里的两条 `exclude`（源码 `ui/src/index.ts` 与 `GameView.vue` 一直保留）。重新构建上传即可。

> **Wrapper 分发源**：`gradle/wrapper/gradle-wrapper.properties` 指向华为云镜像（`repo.huaweicloud.com`），带 `distributionSha256Sum` 完整性校验，并设置 `validateDistributionUrl=false`——官方源会重定向到 GitHub，国内网络不可达。  
> 如需切回官方源：把 `distributionUrl` 改为 `https\://services.gradle.org/distributions/gradle-9.4.0-bin.zip`，并把 `validateDistributionUrl` 改回 `true`。

安装：Halo 控制台 → 插件 → 上传插件 → 选择 JAR → 启用。**启用后插件会自动建好 `/game2048` 页面**，无需再手工建页面。

本地联调（需 Docker）：`./gradlew haloServer`，访问 `http://localhost:8090/console`（admin / admin）。

---

## 使用方式

### 1. 唯一入口：`https://你的域名/game2048`（插件自动创建）

插件**不注册 Console 菜单页**，也**不注册前台导航菜单项**。1.0.8 起，插件启动时会自己把入口建好：**上传 / 启用 JAR 后直接打开 `https://你的域名/game2048`**，不再需要手动新建页面。这一步在任何站点上都完全相同、与域名无关。

| 自动写入的对象 | 关键字段 |
| --- | --- |
| `SinglePage` · `plugin-game-2048-page` | 标题「2048 小游戏」、slug `game2048`、`publish=true`、`visible=PUBLIC`、`deleted=false`、`content.halo.run/published=true`、专属标记 `game2048.halo.run/managed=true` |
| `Snapshot` · `plugin-game-2048-page-content` | `rawType=HTML`、带 `content.halo.run/keep-raw` 的**基础快照**，正文是 `src/main/resources/page/game2048.html`；页面的 `baseSnapshot` / `headSnapshot` / `releaseSnapshot` 都指向它 |

Halo 2.27 把页面正文存在 `Snapshot` 里，只有「已发布 + 公开 + 有 `releaseSnapshot`」三者齐备，主题路由 `/{slug}` 才会被注册，因此两个对象必须一起写、且 Snapshot 先写。Halo 自定义页面的访问链接固定为 `/{slug}`（官方文档；示例站点上 `/about`、`/links` 均为 200），所以打开 **`https://你的域名/game2048`** 就能直接玩。域名由访问者浏览器当前所在的站点决定，插件既不读取、也不需要知道它是什么；同一份 JAR 装到多少站点，就有多少个互相独立、但都遵循 `https://你的域名/game2048` 这一写法的游戏入口，排行榜数据也各自留在各自的 Halo 实例里。

页面内容是**同源根相对路径 + 零脚本 + 无固定域名**的 iframe，兼容 `X-Frame-Options: SAMEORIGIN`，卡片与游戏页自动跟随 Ethereal 明暗与色相。站点启用 HTTPS 就是 `https://`，本地 HTTP 联调自动是 `http://`，无需任何开关。

**幂等行为**（每次启动 / 更新插件都会检查，不会重复创建）：

- 页面已存在且带 `managed=true`：**不覆盖内容与标题**；只在被误改成草稿、私有、删除或改名时把发布状态修回来，内容快照丢失时自动补建。
- 已有**别的**页面占用 slug `game2048`：跳过创建并写 WARN 日志，避免路由冲突；把那个页面改名或删除后重启插件即可接管。
- **卸载 / 更新插件不删除页面**：避免连带删掉你在页面上加过的文字。要清理就到后台「页面」里删除标题为「2048 小游戏」、`game2048.halo.run/managed=true` 的那一条。
- 自动建页失败不会拖垮插件：启动时会退避重试 3 次，仍失败只写 WARN 日志，游戏始终能从静态页地址打开。

> **手动兜底**：若日志出现 `Could not ensure the /game2048 page`，仍可按老办法操作：后台 → 页面 → 新建 → 标题「2048 小游戏」→ 别名 / slug 填 `game2048` → HTML / 源码模式整段粘贴 `deploy/ethereal/page.html` → 可见性「公开」→ 点 **「发布」**。

> **子路径部署**：若 Halo 通过反向代理挂在站点子路径（例如 `/blog/`）下，把页面内容里两处 `/plugins/...` 改成 `/blog/plugins/...` 即可。游戏页会自动从自身 URL 推导出 `/blog` 前缀，排行榜 API 随之变成 `/blog/apis/...`；也可在页面脚本前显式设置 `{ basePath: '/blog' }`。根路径部署时什么都不用改。

> **为什么是「自动创建页面」而不是插件直接注册路由**：Halo 把插件静态资源前缀固定为 `/plugins/{name}/assets/**`，`CustomEndpoint` 又固定挂在 `/apis/` 下，插件无法占用站点根路径（示例站点实测 `/game2048` 返回 404）。折中做法是插件启动时写入标准的 `SinglePage` + `Snapshot` 对象（会往内容库写 2 个对象），由 Halo 自己按 `/{slug}` 生成路由——仍是官方支持的机制，也不需要改主题文件。

最短片段（`deploy/` 里的版本额外做了高度自适应、圆角、键盘焦点提示与全屏链接）：

```html
<iframe
  src="/plugins/plugin-game-2048/assets/game/index.html"
  title="2048 小游戏"
  style="display:block;width:100%;max-width:920px;height:clamp(240px,calc(100vh - 380px),620px);height:clamp(240px,calc(100dvh - 380px),620px);border:0"></iframe>
```

iframe 内需先点一下游戏区域，方向键才会被捕获；编辑器若过滤 iframe，可直接写进主题模板。

### 2. 静态资源路径

```
/plugins/plugin-game-2048/assets/game/index.html
```

这是 `ReverseProxy` 暴露的真实游戏页，上面的自定义页面通过 iframe 引用它。它仍可直接打开（Halo 插件机制决定，无法禁止），但**没有任何菜单或链接指向它**；直接打开时全站排行榜与主题同步同样生效，页顶部会出现「← 返回博客首页」。若需严格禁止直接访问，只能在反向代理层拦截该路径。

**域名无关性由下面四条共同保证，全工程没有一处写死站点域名：**

| 环节            | 实际写法                                                                        | 为什么与域名无关                   |
| ------------- | --------------------------------------------------------------------------- | -------------------------- |
| 访问入口          | 自定义页面 slug <u>`game2048` → `/game2048`</u>                                  | Halo 按 slug 生成页面，域名由站点自身决定 |
| iframe / 静态资源 | `/plugins/plugin-game-2048/assets/game/index.html`、`./style.css`、`./app.js` | 根相对 / 相对路径，浏览器自动补当前 origin |
| 排行榜 API       | `/apis/api.game2048.halo.run/v1alpha1/scores`                               | 根相对自动同源；子路径部署时自动推导前缀       |
| 主题同步          | `location.origin` 同源校验 + 同源 `localStorage`                                  | 只判断「是否同源」，不比较、不存储任何具体域名    |

`app.js` 里唯一与地址有关的是 `location.pathname`（用于识别插件自身路径与子路径前缀），**从不读取 `location.hostname`**。自动化测试会在多个不同域名、协议、端口下启动页面，断言发出的请求完全一致且不含主机名。

> 本地用浏览器直接打开 `standalone/2048.html` 时会自动降级为 `localStorage` 本地排行榜，游戏本身完全可玩。

### 3. 游戏操作

| 操作 | 方式                    |
| -- | --------------------- |
| 移动 | 方向键 / WASD / 触屏滑动     |
| 撤销 | 「撤销一步」按钮（保留最近一步）      |
| 重开 | 「新游戏」按钮               |
| 上榜 | 游戏结束自动提交，或点「提交成绩」手动提交 |

### 自适应视口（无需缩小网页）

**1.0.11 起不用再按 `Ctrl+-` 缩小浏览器。** 旧版 iframe 高度被固定为 720–900px，游戏页内部又是固定 460px 棋盘加两栏布局，外层主题还有标题与说明，三段高度相加超过一屏，只能靠浏览器缩放才能看全。现在改成三层自适应：

| 层 | 做法 |
| --- | --- |
| 父页面 iframe | 片段高度改为 `clamp(240px, calc(100dvh - 380px), 620px)`（同时保留 `100vh` 兜底），即视口减去站点头部后的剩余空间 |
| 同源 iframe 运行时 | 游戏页通过 `window.frameElement` 直接按父视口剩余高度修正 iframe 高度（240–880px）；内容超高时整体等比缩小并隐藏内部滚动条；窗口缩放、手机旋转、主题头部高度变化都会重算 |
| 游戏页内部 | iframe 内自动启用 `is-embedded` 精简重复的标题 / 说明 / 页脚；棋盘按「视口高度 − 页头 − 工具栏 − 提示」动态计算宽度，CSS 另有 `100dvh` 兜底，JS 被禁用也不溢出 |

因此**已装过旧版、页面里仍是 720px 旧 iframe 也无需重建页面**：更新 JAR 后，游戏页会从 iframe 内部按父视口剩余空间直接改写外层高度；主题头部占用太多时页面会自动定位到游戏区，让 iframe 占满整个视口。更关键的是 **1.0.11 起游戏页内部也零滚动**：当内容自然高度超过 iframe 高度时，整个界面会等比缩小（宁可小一点也不出现内部滚动条），并隐藏 iframe 自身的滚动条——浏览器保持 100% 缩放，打开就能直接玩，既不用下翻也不用 `Ctrl+-`。同时插件启动时会把**由旧版本生成的页面正文**自动升级为新版片段（你自己编辑过的内容不会被覆盖）。若想手动替换，后台编辑该页面，HTML / 源码模式整段粘贴 `deploy/ethereal/page.html` 即可。

直接全屏打开 `/plugins/plugin-game-2048/assets/game/index.html`，或双击本地 `standalone/2048.html`，同样自适应；只是没有父页面可调整，走的是 CSS `dvh` 兜底加棋盘动态计算。契约测试 `ui/test/fit-viewport.test.mjs` 锁死了「不得再出现固定 iframe 高度」「iframe 内部零滚动」与无布局环境下的降级行为。

---

## 部署到个人博客前端

**结论：能，而且大多数情况下根本不需要 Halo 插件。** 前台游戏页是纯 HTML/CSS/JS，只有「全站排行榜」依赖 Halo 后端；游戏本身、键盘/触屏操作、撤销、最高分完全在浏览器里运行。

| 你的博客                                  | 做法                                             | 排行榜           |
| ------------------------------------- | ---------------------------------------------- | ------------- |
| Halo >= 2.27                          | 上传 JAR 并启用，iframe 指向插件静态页                      | 全站榜（Halo API） |
| Hexo / Hugo / VuePress / GitHub Pages | 上传 `standalone/2048.html` 或 `standalone/game/` | 浏览器本地榜        |
| WordPress / Typecho / 任意 PHP 站        | 上传到站点目录，用「自定义 HTML」区块放 iframe                  | 浏览器本地榜        |
| 纯本地预览                                 | 双击 `standalone/2048.html`                      | 浏览器本地榜        |

### 方案 A：博客就是 Halo

上传 JAR → 启用 → 按上文新建 slug 为 `game2048` 的自定义页面并粘贴 `deploy/ethereal/page.html`。全站排行榜、匿名提交权限随插件一起生效；**Console 不出现游戏菜单，前台导航也不会自动多出入口**。

### 方案 B：任意静态博客（推荐单文件版）

1. 生成静态包：`node scripts/build-blog-pack.mjs`
2. 把 `standalone/2048.html`（约 30 KB，CSS/JS 已内联，零外部依赖、零网络请求）上传到站点任意目录，例如 `/games/2048.html`
3. 在文章或自定义页面嵌入：

```html
<iframe
  src="/games/2048.html"
  style="width:100%;max-width:920px;height:780px;border:0"
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
<script>window.GAME2048_CONFIG = { apiBase: "/scores-proxy/scores" };</script>
```

接口需实现 `GET /scores?size=10`（返回数组）与 `POST /scores`（返回 JSON）。推荐反代到博客同域的相对路径（如上例），这样同样不含任何域名；只有确实要连外部服务时才填绝对 URL 并配好 CORS。字段格式见下方 API 章节。反过来，若部署在 Halo 上却只想用本地榜，设 `{ mode: 'local' }` 即可强制离线。Halo 插件模式**不需要**这一步，它默认就用同源的 `/apis/...`。

> 模式判定优先级：`mode: 'local'` > 显式 `apiBase` > Halo 插件自身路径 > 默认本地榜。插件路径现在是精确匹配 `/plugins/plugin-game-2048/assets/game/`，普通博客路径里出现 `/plugins/` 不会再误发请求。

### 通用部署规范：任意域名，一步完成

下面适用于**任何** Halo >= 2.27 站点，步骤中没有任何需要按域名替换的内容。`https://你的域名/game2048` 里的域名就是站点自身域名，插件不参与、也不需要知道它是什么。**1.0.8 起插件会自动建页，后台只需安装 / 更新 JAR。**

#### 第 1 步 · 安装或更新插件（唯一必做）

控制台 → 插件 → 上传插件（已装旧版则用**「更新插件」**）→ 选择 `build/libs/plugin-game-2048-1.0.8.jar` → 启用 / 等待重启。启动完成后 `https://你的域名/game2048` 即可访问。

| 形态                                  | 效果                                |
| ----------------------------------- | --------------------------------- |
| **启动时幂等创建 `SinglePage` + `Snapshot`** | **自动生成已发布的 `/game2048` 页面，无需手工建页** |
| JAR 不含 `ui/ui-plugin.json` 与 ESM 产物 | Halo 不注册 Console 侧边栏的「2048 小游戏」页面 |
| 不含 `extensions/menu-item.yaml`      | 不向 `primary` 主菜单自动添加导航项           |
| 静态资源 / 排行榜 API / 主题同步全部为同源相对路径      | 不含任何域名配置，装到任意站点都无需改文件、无需重新打包      |

排行榜 API、`ReverseProxy` 静态资源、Ethereal 主题同步全部不变。1.0.8 相对 1.0.7 的核心变化就是**自动创建页面**：之前需要你手动新建 slug 为 `game2048` 的页面，否则 `/game2048` 一直是 404；现在插件启动时会写好页面对象与内容快照。

> ⚠️ 已安装旧版时用「更新插件」覆盖，**不要卸载再安装**：Halo 清理插件时可能连带清掉 `GameScore` 里的成绩数据。若之前版本已在导航栏生成过「2048 小游戏」，更新后去「外观 → 菜单」检查，有残留就手工删除。必要时清 `/plugins/plugin-game-2048/**` 的 CDN 缓存（这是路径，与域名无关）。

#### 第 2 步 · 确认页面已自动生成（可选）

后台 → 页面，应能看到标题「2048 小游戏」、别名 `game2048`、状态「已发布」的一条页面。插件写入的正文等价于 `deploy/ethereal/page.html`，核心是：

```html
<iframe src="/plugins/plugin-game-2048/assets/game/index.html"
  title="2048 小游戏"
  style="display:block;width:100%;height:clamp(240px,calc(100vh - 380px),620px);height:clamp(240px,calc(100dvh - 380px),620px);border:0"></iframe>
```

`src` 必须是同源**相对**路径，不能写死任何域名或 CDN：既会被 `X-Frame-Options: SAMEORIGIN` 拒绝，也会让插件失去跨站点复用能力。正文零脚本，不怕编辑器过滤 `<script>`；若主题连 `iframe` 也过滤，就写进主题模板。想改成自己的排版可以直接编辑这个页面，插件重启时**不会覆盖你的内容**。

只读自检（把域名换成站点实际域名，接口返回站点**已公开**的页面列表）：

```bash
curl -s "https://你的域名/apis/api.content.halo.run/v1alpha1/singlepages?size=50"
```

`items` 里应出现 `slug: "game2048"`、`publish: true`、`visible: "PUBLIC"`、`phase: "PUBLISHED"`。

#### 部署后核对清单（把「你的域名」换成站点实际域名）

1. `https://你的域名/game2048` 返回 200 并显示 4×4 棋盘
2. 后台「页面」里自动出现标题「2048 小游戏」、slug `game2048`、已发布且公开的一条（**只有一条**）
3. Console 左侧菜单**没有**「2048 小游戏」页面（「插件」列表里仍能看到本插件，属正常）
4. 前台导航栏**没有**自动生成的游戏入口
5. 方向键 / WASD 能移动，触屏可滑动；提交成绩后刷新排行榜能看到新记录
6. 浏览器 Network 面板里资源与 API 请求均指向**当前站点域名**，没有写死的第三方域名
7. `.../assets/game/app.js` 含 `GAME2048_CONFIG` 与 `setupThemeSync`，说明新 JAR 已生效

#### 如果 `https://你的域名/game2048` 返回 404

看响应体即可判断来源：若返回 Halo 的 `application/problem+json`、内容是 `No static resource game2048.`，说明请求到了 Halo，但**没有可公开访问的 `game2048` 页面路由**——也就是自动建页没有生效。插件静态资源与 API 固定在 `/plugins/...`、`/apis/...`，根路径只能由页面对象提供。

按顺序自查：

1. **装的是 1.0.8 吗？** 1.0.7 及更早版本不会自动建页。控制台「插件」里确认版本；用**「更新插件」**上传 1.0.8 JAR（不要卸载重装，以免清掉排行榜成绩），等待插件重启完成。
2. **看日志**：出现 `Could not ensure the /game2048 page` 说明自动建页失败（多为启动时序或权限问题，插件会退避重试 3 次）；出现 `Slug /game2048 is already used by another SinglePage` 说明 slug 被别的页面占用，插件主动跳过了。后者把那个页面改名/删除后重启插件即可。
3. **页面是「已发布 + 公开」吗？** 后台 → 页面，找到自动创建的「2048 小游戏」：草稿、私有、回收站状态前台一律 404。slug 要恰好是 `game2048`，不带 `/`、域名、空格或 `.html`。
4. **别把它建成文章或菜单链接**：必须是「页面」（SinglePage）；「外观 → 菜单」里的自定义链接只会让 sitemap 多一条 URL，不会产生页面对象。
5. **站点挂子路径 / 有 CDN**：子路径部署时入口应是 `https://你的域名/blog/game2048` 这类地址；必要时清 `/game2048` 与 `/plugins/plugin-game-2048/**` 的缓存。

只读自检（接口返回站点**已公开**的页面列表）：

```bash
curl -s "https://你的域名/apis/api.content.halo.run/v1alpha1/singlepages?size=50"
```

`items` 里应出现 `slug: "game2048"`、`publish: true`、`visible: "PUBLIC"`、`phase: "PUBLISHED"`；没有就说明页面尚未公开。同时确认插件本身正常：`/plugins/plugin-game-2048/assets/game/index.html` 与 `/apis/api.game2048.halo.run/v1alpha1/scores` 都应返回 200——**这两个 200 但 `/game2048` 404，就一定是页面对象的问题，不是游戏资源的问题**。

> 兜底：自动建页始终失败时，可手动新建 slug 为 `game2048` 的页面并粘贴 `deploy/ethereal/page.html` 发布，效果完全相同。若 sitemap 里已有 `/game2048` 但前台仍 404，多半是第 4 条：sitemap 会收录菜单链接，不等于页面已发布。Halo 的 404 响应带 `Cache-Control: no-store`，一般不是浏览器 / CDN 缓存问题。

#### 示例站点兼容性记录（不绑定域名，仅作验证）

下表是一次线上只读探测的结论，用来说明机制可行；**这些结论不构成对域名的要求**，换成任意域名，安装步骤完全一致（2026-11-14，某 Halo 2.27.2 + Ethereal 2.1.0 站点）：

| 项目      | 结果                                                                                    |
| ------- | ------------------------------------------------------------------------------------- |
| 建站程序    | Halo **2.27.2**（`meta generator`），主题 Ethereal，满足 `requires >=2.27.0`                  |
| 自定义页面路由 | Halo 文档明确访问链接为 `/{slug}`；站点上 `/about`、`/links` 均 200；探测时 `/game2048` 404（当时装的是 1.0.7，插件还不会自动建页、页面也未手动创建）——这正是 1.0.8 要解决的问题 |
| 协议      | HTTP 302 → HTTPS；HEAD 请求被 WAF 处理返回 404，GET 正常 200                                     |
| 后台入口    | `/console`（未登录跳 `/login?authentication_required`）                                     |
| 插件静态资源  | `/plugins/{name}/assets/...` 返回 200，ReverseProxy 机制可用                                 |
| 响应头     | **`X-Frame-Options: SAMEORIGIN`**（iframe 必须同源）、无 CSP、有 WAF、下发 `XSRF-TOKEN`            |
| 线上插件状态  | 静态页四个资源 200；`GET /apis/api.game2048.halo.run/v1alpha1/scores` 返回真实成绩，匿名读写均已打通、WAF 未拦截 |
| 已有游戏入口  | 探测时导航中无 2048 入口，`/2048`、`/game` 等路径均 404                                              |

---

## 适配 Ethereal 主题

**能，而且不需要修改主题文件，也不需要注入脚本。** 以下主题契约来自某 Halo 2.27.2 站点的线上实测（Ethereal **2.1.0**，Fuwari 系 / Astro + Tailwind v4），不是通用猜测；主题变量、同源 `localStorage` 与 `postMessage` 校验都只依赖「同源」这件事，**与站点域名无关**，因此换到任意域名的 Ethereal 站点同样生效。

### 实测到的主题契约

| 项目   | 实测值                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 明暗标记 | `<html data-color-scheme="auto" class="... color-scheme-auto">`；切换时加 `.dark`、改 `color-scheme-*`                                                  |
| 主题状态 | `localStorage.theme`（`light` / `dark` / `auto`）、`__user_chose_theme`、`hue`（站点当前 `themeColor.hue = 250`，`data-hue-fixed="false"` 表示访客可调）          |
| 亮色变量 | `--primary: oklch(.7 .14 var(--hue))`、`--card-bg: white`、`--deep-text: oklch(.25 .02 var(--hue))`、`--btn-regular-bg: oklch(.95 .025 var(--hue))` |
| 暗色变量 | `:root.dark` → `--primary: oklch(.75 .14 var(--hue))`、`--card-bg: oklch(.23 .015 var(--hue))`、`--deep-text: oklch(.85 .02 var(--hue))`           |
| 卡片风格 | `--radius-large: 1rem`；站点启用了 `card-border-enabled`、`card-follow-theme-enabled`                                                                   |

Halo 官方「与插件集成」文档要求主题在 `<html>`/`<body>` 上打 `color-scheme-*` / `data-color-scheme` 公共标记，插件组件据此继承明暗；Ethereal 2.0.1 起也补齐了「插件配色支持」与页脚注入扩展点。

### 适配做了什么

1. **明暗与主题色自动跟随**：游戏页是 ReverseProxy 暴露的独立 HTML 文档，拿不到父页 CSS 变量；但它与站点**同源**，因此 `app.js` 直接读上述 `localStorage`，设置同样的 `.dark` / `data-color-scheme` / `color-scheme-*` 标记，并监听 `storage` 事件与 `prefers-color-scheme` 变化。`style.css` 复用同一套 `oklch(...)` 变量，主题色相与明暗切换实时生效——**访客切主题时游戏不刷新、进度不丢**。
2. **主题同款容器**：`deploy/ethereal/embed.html`、`page.html` 用 `--card-bg` / `--primary` / `--radius-large` 构建卡片，游戏页内部自动对齐。棋盘保留 2048 经典配色保证数字可读性，只把外围（背景、卡片、按钮、文字、边框）主题化。
3. **页面容器与入口**：`deploy/ethereal/page.html` 用主题变量做卡片，粘贴到 slug 为 `game2048` 的自定义页面后由 `/game2048` 直达。当前形态**不再注册导航菜单项**（`menu-item.yaml` 已移除），避免出现第二个入口；主题变量同步本身不依赖菜单。

### 配置

在页面脚本之前设置（一般无需设置，自动识别即可）：

| 键            | 值             | 说明                             |
| ------------ | ------------- | ------------------------------ |
| `theme`      | 不设 / `'auto'` | 自动识别同源 Ethereal（**仅 Halo 部署**） |
|              | `'ethereal'`  | 强制启用主题皮肤                       |
|              | `'off'`       | 关闭，回到 2048 经典配色                |
| `defaultHue` | 数字，默认 `250`   | 读不到 `localStorage.hue` 时的色相    |

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

| 方法   | 路径                                                    | 说明                                 |
| ---- | ----------------------------------------------------- | ---------------------------------- |
| GET  | `/apis/api.game2048.halo.run/v1alpha1/scores?size=10` | 排行榜，按 `spec.score` 降序，size 范围 1–50 |
| POST | `/apis/api.game2048.halo.run/v1alpha1/scores`         | 提交成绩                               |

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

- ✅ **`./gradlew build`：BUILD SUCCESSFUL** — `compileJava` / `compileTestJava` 真实编译通过，`jar` 产出 `build/libs/plugin-game-2048-1.0.11.jar`（41,769 B / 27 条目）；自适应视口改造后重新构建成功
- ✅ **JAR 内容核验**：含 8 个 `.class`、`plugin.yaml`（version 1.0.11 / requires >=2.27.0）、**2 个 extensions YAML**（`reverse-proxy.yaml`、`role-template.yaml`）、`page/game2048.html`（自动建页正文）、`static/game/` 4 个前台文件、`META-INF/plugin-components.idx`（4 个组件，含 `Game2048PageInitializer`）；已确认 **无 `ui/`、无 `ui-plugin.json`、无 `menu-item.yaml`**，即不会注册 Console 菜单或前台导航项
- ✅ **Java 单测 7/7 通过**（JUnit 5 + Mockito）：创建 `SinglePage` + 基础 `Snapshot` 的字段契约、已存在页面只修复不覆盖、健康页面零写入、slug 被占用时不重复创建、页面片段同源零脚本、旧模板自动升级、自定义内容不被覆盖
- ✅ **`npm test` / `ui:npmCheck`：65 项全部通过**（57 个顶层用例）— 核心算法 19 + 前台本地模式 6 + Halo 在线模式 4 + 静态部署包 4 + 仅前台构建契约与部署片段 5 + Ethereal 适配 7 + 域名无关契约 5 + 自动建页契约 5 + **自适应视口契约 10（无固定 iframe 高度、dvh 兜底、运行时测量、静态包同步、jsdom 降级）**
- ✅ `./gradlew --version` 自举下载 Gradle 9.4.0 并通过 sha256 校验；`java -version` / `javac -version` 均为 21.0.13
- ✅ 7 个 Java 文件 + 1 个 JUnit 文件编译通过、3 个 YAML 解析、`theme-bridge.js` 语法检查、API 路径一致性检查通过
- ✅ **线上只读实测（示例站点，不绑定域名）**：插件静态页四个资源 200；排行榜 API 返回真实成绩，匿名读写均通；`/about`、`/links` 200 验证 `/{slug}` 路由；当时 `/game2048` 404 正是 1.0.7 未自动建页导致的；Ethereal 2.1.0 的 `data-color-scheme` / `--hue` / `oklch` 变量均从渲染页面与主题 CSS 确认

**仍未验证**：本机无 Docker、无本地 Halo 实例，因此**插件在真实 Halo 中写入 `SinglePage` / `Snapshot` 后，路由是否即时刷新、Console 菜单是否仍不出现、以及 `/game2048` 在浏览器里的实际表现**，需要你在站点上传 1.0.11 JAR 后确认。自动建页的字段契约、幂等分支与启动重试已由单测覆盖；Halo 2.27.3 的 `SinglePageEndpoint` / `SinglePageServiceImpl` / `SinglePageReconciler` / `SinglePageRoute` 源码已逐一对齐（发布条件 = `publish=true` + `visible=PUBLIC` + `releaseSnapshot` 指向存在的 `Snapshot` + `published` label）。域名无关性也由自动化测试覆盖：多个不同域名 / 协议 / 端口下，页面发出的请求完全一致且不含任何主机名。**纯前端静态包不依赖 Halo，可直接部署。**

> 构建日志中有一条 `Deprecated Gradle features ... incompatible with Gradle 10` 提示，来自第三方 Gradle 插件，不影响 Gradle 9.4.0 构建；将来升级 Gradle 10 时需同步升级这些插件。

---

## 已知限制

- 排行榜按单局分数排序，不做同名玩家去重；同一玩家每局结束产生一条记录。
- 限流是**单实例内存级**滑动窗口；Halo 集群部署时应改用网关或 Redis 限流。
- 撤销只保留最近一步。
- 独立部署版默认只有浏览器本地排行榜（每位访客各存各的）；要全站榜需自建 API 或使用 Halo 插件模式。
- 插件默认按**站点根路径**部署；若 Halo 挂在子路径（如 `/blog/`）下，需按「使用方式」编辑自动生成的页面内容（或手动片段），给两处 `/plugins/...` 加上前缀。游戏页自身会自动推导 API 前缀。域名、协议、端口始终无需配置。
- 访问约定是 `https://你的域名/game2048`（站点启用 HTTPS 时）；若站点仍走 HTTP，则自动是 `http://你的域名/game2048`，插件不做协议强制跳转，HTTPS 由站点 / 反向代理负责。
- 当前形态下，插件静态页 `/plugins/plugin-game-2048/assets/game/index.html` 仍可直接打开（Halo 插件机制决定，无法禁止）；只是没有任何菜单或链接指向它。要严格只允许 `/game2048`，需在反向代理层拦截该路径。
- Console UI 源码保留在 `ui/` 但默认不打包；JAR 不含 `ui/ui-plugin.json`，Halo 因此不会注册菜单。恢复方法见「恢复 Console 页面」。
- **自动建页会往内容库写入 2 个对象**（`SinglePage` + `Snapshot`）。为避免删掉站长在页面上加的内容，**停用 / 卸载 / 更新插件都不会自动删除它们**；不需要了就到后台「页面」里手动删掉标题「2048 小游戏」、`game2048.halo.run/managed=true` 的那条（关联快照由 Halo 自行回收）。
- 若已有别的页面占用 slug `game2048`，插件**不会抢**，只会跳过并写 WARN 日志；需先改名/删除该页面再重启插件。若站点在 `外观 → 菜单` 里已有一条 `/game2048` 自定义链接，它不影响页面对象，但也不能替代页面。
- 移除 `menu-item.yaml` 后，若之前版本已在导航栏生成过「2048 小游戏」，Halo 更新时未必会清理该对象，需在「外观 → 菜单」手工删除。
- Ethereal 主题同步依赖**同源** `localStorage`；若把游戏页托管到独立子域/CDN，无法读取站点主题状态，需改用 `theme-bridge.js` 的 `postMessage` 通道或直接设 `theme: 'off'`。
- ESM 产物要求 Halo >= 2.27.0；若需兼容更旧的 Halo，可在 `ui/vite.config.ts` 里显式设置 `format: "iife"` 并相应调整 `plugin.yaml` 的 `requires`。

## 许可

MIT
