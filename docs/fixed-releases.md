# 数字固定版发行

现有 `install/普罗泰利西翁-书海外链加载正则.json` 和 Pages 安装器继续提供自动跟随版。固定版使用独立 ID `cfc0375e-3c5c-4ea1-8b7b-2093c7df0a12`，发行附件名称为 `protelysion-fixed.regex.json`。两版会匹配同一个书海标签，玩家应只启用一版；切换时停用旧的自动跟随版。

## 玩家如何更新

固定正则内有 `const VERSION = "0.42.1";`。默认版本同时内嵌完整源码提交 SHA 和根清单 SHA-256；每次打开直接读取该提交，完全不查询最新版。若手动把 VERSION 改为另一个已正式发布的数字版本，加载器只查询该数字对应的 GitHub 不可变 Release，核验官方附件 digest，再读取其中的源码 SHA 和根哈希；不会执行下载得到的正则代码。协议不兼容时提示重新导入，未发布或下载失败时保留错误提示，不退回 main。

读者固定版里的统一「检查更新」入口会检查两个仓库，显示两个组件的当前版本与可用版本并经玩家确认后替换两份固定正则。固定版本不会在刷新时自行升级；修改 VERSION 和确认更新都是玩家主动操作。

## 固定范围

- 根 `release-manifest.json` 必须匹配正则内嵌的 SHA-256，之后才解析。
- `distribution.js`、Godot JS、音频 worklet、PCK/WASM 分片、解压后的 PCK/WASM、音频和清单内的其他资源，继续逐份校验完整 SHA-256。
- raw、jsDelivr、fastly 镜像全部使用同一个完整源码提交 SHA；没有 main、latest 或 Pages 回退。
- 启动信息按仓库、数字版本、根哈希隔离；大资源沿用原有按内容哈希寻址的共享缓存，每次读取仍验证当前固定清单要求的 SHA-256。切换版本或从自动版迁移时，相同资源不会仅因版本号变化而重复下载；不同哈希的资源不能互相替代。下载资源缓存与聊天/存档分离。
- HTTPS/localhost 使用 Web Crypto 和 Cache Storage。局域网 HTTP 使用随正则导入的软件 SHA-256 与 IndexedDB，仍完整核验内容；不会降级为仅比对字节数。Godot、音频等浏览器能力仍取决于设备和浏览器。
- 外部头像、用户填写的 API、聊天与模型回复属于运行数据，不因固定程序版本而冻结；不可变版本也不能证明其首次发布的代码本身没有问题。

## 本地准备与核验

在发行仓库根目录执行：

```powershell
cd dev-src/09-实现
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npx tsx --test tests/distribution-cache.test.ts
cd ../..
node --test tools/tests/fixed-release.test.mjs
node tools/rebuild-distribution.mjs
```

`rebuild-distribution.mjs` 仅重建 `site/distribution.js` 并重算根清单中的对应条目，不重建 Godot、美术或音频。提交源码、启动器与根清单后得到源码提交 C，再生成固定正则：

```powershell
node tools/build-fixed-release.mjs --version 0.42.1 --output artifacts/fixed-release
python tools/publish-fixed-release.py --version 0.42.1
```

后一个命令默认只进行本地检查并打印发布计划。构建器只读取 C 的 Git blob 字节，忽略未提交文件；可用 `--commit <40位SHA>` 明确选择源码提交。旧提交不支持固定资源传输时拒绝构建，不能给旧版启动器简单套上安全标签。`artifacts/` 已忽略，不会被误提交。

完整发行验证仍须在包含全部资源的 checkout 中执行 `python tools/materialize.py`；轻量 sparse checkout 的源码测试不能代替该检查。

## 正式发布与自引用处理

GitHub 仓库 Settings → Releases 中先启用 immutable releases。配置 Actions secret `FIXED_RELEASE_TOKEN` 为可访问此仓库的 token，需 Contents write 和 Administration read；后者用于正式发布前检查不可变功能已启用。发布器只读取该设置，不会自行打开或修改仓库设置。

人工触发 **Publish immutable fixed regex**，输入新的纯数字版本。流程如下：

1. 检查源码、缓存/传输测试和全部资源哈希，从当前源码提交 C 生成正则。
2. 把与发布附件完全相同的字节放到 `install/protelysion-fixed.regex.json`，创建独立的分发提交 D，父提交为 C；不会更新 main。
3. 将新 tag `v<版本>` 指向 D，并创建草稿 Release、上传附件、核验 GitHub 返回的附件 digest，最后正式发布并确认 `immutable: true`。

因此正则固定的是 C，tag 指向包含该正则的 D，没有「正则内嵌自己的提交 SHA」自引用。发布附件跨域下载受限时，客户端可从不可变 tag 的 raw/CDN 文件读取同字节附件，并与 GitHub 官方附件 digest 比对。

已存在的 tag 或无法确认 tag 不存在时流程失败，绝不覆盖版本。任何发布中断都应先检查 Actions 日志和线上 tag/草稿；脚本不会删除 tag、修改旧附件或自动重试覆盖。需要修复时发布新的数字版本。

固定版 schema 1 marker 为：

```html
<!-- FIXED_RELEASE:{"schema":1,"repository":"Adirm007/Protelysion","version":"0.42.1","sourceCommit":"完整40位SHA","manifestSha256":"完整64位SHA256"} -->
```

`tools/fixed-release-client.js` 与 reader 的 `source/fixed-release-client.js` 使用同一协议。修改公共协议时须同步两个副本；旧版加载器不能理解的新协议应提升 schema，并让旧客户端明确拒绝而非猜测加载。
