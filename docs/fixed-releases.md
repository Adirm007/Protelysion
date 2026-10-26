# 数字固定版发行

现有 `install/普罗泰利西翁-书海外链加载正则.json` 和 Pages 安装器继续提供跟随更新的外链版。固定版使用独立 ID `cfc0375e-3c5c-4ea1-8b7b-2093c7df0a12`，发行附件名称为 `protelysion-fixed.regex.json`。两版匹配同一个书海标签，玩家应只启用一版；切换时停用旧的外链版。

## 玩家如何更新

固定正则内有 `const VERSION = "0.42.3";`。默认版本同时内嵌完整源码提交 SHA 和根清单 SHA-256，每次打开直接读取该提交，不查询最新版。若手动把 VERSION 改为另一个已发布的数字版本，加载器从静态更新清单读取该版本的 GitHub 签名发布证明，验证证明与附件后，取得附件里的源码 SHA 和根哈希。只把下载到的正则作为数据读取，不执行其中的加载器。版本不存在或校验失败时明确报错，不退回 main 或其他版本。

读者固定版的「检查正则更新」入口会检查两个仓库，显示两份正则的当前版本与可用版本。玩家确认后才下载、验证、备份并替换正则；没有可用更新时明确显示，网络或校验失败时不能据此判断已是最新。固定版本不会在刷新时自行升级，修改 VERSION 和确认更新都是玩家主动操作。

玩家不需要 GitHub token 或账号登录，更新检查和手动切换版本不调用 GitHub REST API。正常打开当前固定版本不会下载发布证明验证模块，也不增加更新轮询。

## 固定范围

- 根 `release-manifest.json` 必须匹配正则内嵌的 SHA-256，之后才解析。
- `distribution.js`、Godot JS、音频 worklet、PCK/WASM 分片、解压后的 PCK/WASM、音频和清单内的其他资源，逐份校验完整 SHA-256。
- 运行资源的 raw、jsDelivr、fastly 镜像使用同一个完整源码提交 SHA，没有 main、latest 或 Pages 回退。
- 启动信息按仓库、数字版本、根哈希隔离。大资源沿用按内容哈希寻址的共享缓存，每次读取仍验证当前固定清单要求的 SHA-256。切换版本或从外链版迁移时，相同资源不因版本号变化而重复下载；不同哈希的资源不能互相替代。下载资源缓存与聊天、存档分离。
- HTTPS/localhost 使用 Web Crypto 和 Cache Storage。局域网 HTTP 使用随正则导入的软件 SHA-256 与 IndexedDB，仍完整核验内容，不降级为仅比对字节数。Godot、音频等浏览器能力仍取决于设备和浏览器。
- 按作者选择，字体与棋引擎继续使用原先第三方来源。外部头像、用户填写的 API、聊天与模型回复属于运行数据，不因固定程序版本而冻结。

## 静态清单与发布证明

各仓库的 `fixed-updates` 分支保存 `index.json` 数字版本列表，以及 `releases/v<版本>.json` GitHub 原始签名证明。客户端只使用已固定的仓库与路径，通过 raw/jsDelivr 获取这些数据，不接受清单指定的任意下载地址，也不执行清单内容。清单本身不能为附件提供可信摘要。

`tools/release-verifier` 使用官方 sigstore-go 逻辑，在浏览器中离线验证 Sigstore DSSE 发布证明。运行脚本与 WASM 仅在检查或切换版本时按需下载，完整提交 SHA、内容 SHA-256 和大小固定在本版代码中，校验后才运行；正常启动当前固定版不加载验证器。

客户端内置 GitHub TUF 信任种子。`trust.json` 保存镜像的官方签名元数据链和 `trusted_root`，由每日 Actions 和发布器刷新。客户端验证签名、信任根轮换及元数据有效期；不能仅凭镜像自声明的密钥建立信任。签名失败、轮换链不完整或元数据过期时检查失败，不跳过验证，也不选择旧证明冒充最新。

证明必须由 GitHub 发布服务签发，验证包括证书身份、证书链与签名时间戳。签名内容绑定仓库名称、owner ID、repository ID、数字版本标签、分发提交 D 和固定正则附件 SHA-256。客户端按这个摘要验证附件；附件中的标记再固定源码提交 C 与根清单摘要，后续程序和资源按该根清单核验。附件跨域下载受限时，raw/CDN 回退使用证明里的完整 D 提交。

因此，作者不能只靠改动静态清单或镜像证明来替换同一已签发版本的附件。签名不保证新版本代码没有恶意行为，确认更新仍是对新版本代码的信任。静态清单不能证明作者没有隐瞒新版，CDN 缓存也可能延迟新版出现。本机记录最高已验证版本以拒绝清单回退；它不能证明绝对最新，清除浏览器存储后也不会保留。

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

`rebuild-distribution.mjs` 只重建 `site/distribution.js` 并重算根清单中的对应条目，不重建 Godot、美术或音频。提交源码、启动器与根清单后得到源码提交 C，再生成固定正则：

```powershell
node tools/build-fixed-release.mjs --version 0.42.3 --output artifacts/fixed-release
python tools/publish-fixed-release.py --version 0.42.3
```

后一个命令默认只进行本地检查并打印发布计划。构建器读取 C 的 Git blob 字节，忽略未提交资源；可用 `--commit <40位SHA>` 明确选择源码提交。旧提交不支持固定资源传输时拒绝构建，不能给旧版启动器直接标注固定版。`artifacts/` 已忽略，不会被误提交。

完整发行验证仍须在包含全部资源的 checkout 中执行 `python tools/materialize.py`；轻量 sparse checkout 的源码测试不能代替该检查。

## 正式发布与自引用处理

GitHub 仓库须先启用不可变 Releases。发布器在作者端检查该设置，并核对上传附件摘要；这些检查不替代玩家端的签名验证。现有发行 Actions 使用有 Contents write 和 Administration read 权限的 `FIXED_RELEASE_TOKEN`，管理读取权限用于预检仓库设置。玩家不需要持有或填写该凭据。

人工触发 **Publish immutable fixed regex**，输入新的纯数字版本。流程如下：

1. 检查源码、缓存与传输测试及全部资源哈希，从当前源码提交 C 生成正则。
2. 将与附件相同的字节放到 `install/protelysion-fixed.regex.json`，创建父提交为 C 的独立分发提交 D，不更新 main。
3. 将新 tag `v<版本>` 指向 D，创建草稿 Release、上传附件、核对上传摘要，再正式发布并确认不可变状态。
4. GitHub 生成签名发布证明后，发布器获取证明、刷新官方信任材料，再更新 `fixed-updates` 清单。证明就绪前不把版本加入清单。

正则固定的是 C，tag 指向包含正则的 D，因此没有正则内嵌自身提交 SHA 的问题。Release 附件与 D 中的文件保持相同字节。

已存在的 tag 或无法确认 tag 不存在时流程失败，绝不覆盖版本。发布中断应先核对线上 tag、草稿和正式 Release。脚本不删除 tag，不修改旧附件，也不重试覆盖。已正式发布后，如果只剩证明或清单更新失败，可补齐清单：

```powershell
python tools/publish_update_catalog.py Adirm007/Protelysion 0.42.3 --publish
```

单独刷新官方签名信任材料：

```powershell
python tools/publish_update_catalog.py Adirm007/Protelysion --refresh-trust --publish
```

修复已发布代码必须使用新的数字版本，不重用旧 tag。

固定版 schema 1 marker 为：

```html
<!-- FIXED_RELEASE:{"schema":1,"repository":"Adirm007/Protelysion","version":"0.42.3","sourceCommit":"完整40位SHA","manifestSha256":"完整64位SHA256"} -->
```

`tools/fixed-release-client.js` 与 reader 的 `source/fixed-release-client.js` 使用同一协议。修改公共协议时须同步两个副本；旧加载器不能理解的新协议应提升 schema，并让旧客户端明确拒绝。
