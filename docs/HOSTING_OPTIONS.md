# 公网部署选型（静态 Vite / React 项目）

> 调研日期：2026-07-31。本文只引用平台或产品的官方文档、官方定价页。

## 结论先行

当前 Focus Space 是一个纯前端静态站点：执行 `npm run build` 后产生 `dist/` 文件，部署时把该目录发布即可。番茄钟设置和历史记录使用浏览器 IndexedDB，**当前版本不需要后端服务器、数据库、Node.js 常驻进程或 VPS**。

若主要面向个人使用或海外/全球访问，优先考虑 Cloudflare Pages、Vercel 或 Netlify 的免费层；想要代码与网站一起托管可选择 GitHub Pages。若主要服务中国大陆用户、希望用国内云的访问速度与支持，选择腾讯云 COS 或阿里云 OSS 静态网站托管，并准备域名与 ICP 备案。

## 部署前需要准备什么

1. Node.js（仅在本机或 CI 构建时需要）：项目根目录运行 `npm install`、`npm run build`。
2. 构建输出：Vite 官方指南将静态部署产物指定为 `dist`（本项目也是如此）。[Vite：Static Site Deployment](https://vite.dev/guide/static-deploy.html)
3. 一个托管平台账号；若使用自定义域名，再购买域名并配置 DNS。
4. HTTPS：下列主流静态平台都可为其平台域名提供 HTTPS；绑定自定义域名时需按平台文档完成 DNS 验证/解析，并等待证书签发。
5. 不需要购买数据库或应用服务器。未来若增加跨设备同步、登录、团队统计，才需要 API + 数据库（可另选 Supabase、Cloudflare Workers/D1 或国内云服务）。

## 平台比较

| 方案 | 费用与适用性 | Vite 静态部署 | 自定义域名 / HTTPS | 适合与注意事项 |
| --- | --- | --- | --- | --- |
| **Cloudflare Pages** | 官方产品页提供 Free 计划，适合个人静态站；具体配额以当期定价页为准。 | 配置构建命令与构建输出目录；Vite 输出为 `dist`。 | 支持 apex 域和子域绑定；需按 Pages 域名文档配置 DNS。 | 全球 CDN、免运维，个人项目首选之一；中国大陆访问体验受网络环境影响。 |
| **Vercel** | 有 Hobby（免费）计划；官方定价页明确其面向 personal/non-commercial use，商业用途应选择 Pro。 | 官方 Vite 指南支持从 Git 仓库导入或用 CLI 部署。 | 可添加项目域名，平台为域名配置 HTTPS。 | Git 推送自动部署体验好；免费层的用途限制要特别注意。 |
| **Netlify** | 官方定价页提供 Free 计划；具体带宽/构建额度以页面为准。 | 构建命令 `npm run build`，发布目录 `dist`。 | 官方 Domains 文档支持绑定自有域名，HTTPS 由 Netlify 管理。 | 操作直观、支持 Git 自动部署；检查免费配额及商业使用条款。 |
| **GitHub Pages** | GitHub Free 可用于公开仓库的 Pages；私有仓库/组织可用性受 GitHub 当前套餐和仓库可见性限制。 | 可由 GitHub Actions 构建 Vite 后发布 `dist`；也可从分支/目录发布。 | 支持自定义域名；支持为自定义域名启用 HTTPS。 | 最省钱、代码与站点同处；仅适合静态站，不提供服务器端 API。 |
| **腾讯云 COS 静态网站托管** | 按 COS 存储、请求、下行流量及可能的 CDN/域名费用计费；不是典型“永久免费”。 | 上传 `dist` 内文件，设置默认首页/错误页；可接入 CDN。 | 域名、证书、CDN 按腾讯云相关产品配置。 | 面向中国大陆更合适；使用中国大陆接入资源前通常需 ICP 备案。 |
| **阿里云 OSS 静态网站托管** | 按 OSS 存储、请求、流量及可能的 CDN/域名费用计费；不是典型“永久免费”。 | 上传 `dist` 内文件，在 Bucket 中开启静态网站托管并设首页/错误页。 | 域名、证书、CDN 按阿里云相关产品配置。 | 面向中国大陆更合适；使用中国大陆接入资源前通常需 ICP 备案。 |
| **低价 VPS（腾讯云 Lighthouse/ECS、阿里云 ECS）** | 常有新用户/年付优惠，但价格与库存变动大，应以官方购买页实时价格为准。 | 可用 Nginx/Caddy 托管 `dist`；需自行维护系统、证书、更新、监控和安全。 | 自购域名并用 Let's Encrypt 或云证书配置 HTTPS。 | 对本项目没有必要；只有未来要自建 API、WebSocket、定时任务或特殊反向代理时才建议选择。 |

## 官方依据

- [Vite：静态站点部署](https://vite.dev/guide/static-deploy.html)：说明静态部署流程及 `dist` 输出。
- [Cloudflare Pages：构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)；[自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)；[Pages 产品/定价入口](https://www.cloudflare.com/developer-platform/products/pages/)。
- [Vercel：部署 Vite](https://vercel.com/docs/frameworks/frontend/vite)；[添加域名](https://vercel.com/docs/domains/working-with-domains/add-a-domain)；[官方定价](https://vercel.com/pricing)。
- [Netlify：官方定价](https://www.netlify.com/pricing/)；[构建配置](https://docs.netlify.com/build/configure-builds/overview/)；[域名入门](https://docs.netlify.com/manage/domains/get-started-with-domains/)；[免费 HTTPS](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)。
- [GitHub Pages：选择发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)；[管理自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)；[HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)；[定价](https://github.com/pricing)。
- [腾讯云 COS：静态网站托管](https://www.tencentcloud.com/document/product/436/14984)；[腾讯云：ICP备案说明](https://cloud.tencent.com/document/product/243/18905)。
- [阿里云 OSS：静态网站托管](https://www.alibabacloud.com/help/en/oss/user-guide/static-website-hosting)；[阿里云：ICP Filing 概览](https://www.alibabacloud.com/help/en/icp-filing/latest/overview)。

## 中国大陆备案与域名提醒

- 当网站实际接入**中国大陆境内**服务器、对象存储静态站点或 CDN 时，通常必须先完成 ICP 备案；云厂商会要求备案信息与接入资源、域名主体相匹配。请以所选云厂商当前备案流程和所在地监管要求为准。
- 使用 Cloudflare Pages、Vercel、Netlify、GitHub Pages 等境外平台通常不会让你走中国大陆云接入商的备案流程，但这不等同于保证大陆访问质量或免除所有合规义务。若面向大陆公开运营，仍应评估业务内容、个人信息处理、域名实名和相关监管要求。
- 域名本身是独立费用。注册商、后缀和续费价格差别很大；`.com`、`.cn` 等价格请以注册商实时页面为准。`.cn` 等域名往往还涉及实名审核。

## 给本项目的推荐路径

**最省事（推荐先做）**：GitHub 仓库 + Cloudflare Pages。连接仓库，设置 Build command 为 `npm run build`、Build output directory 为 `dist`，每次推送自动发布；先使用 `*.pages.dev` 免费子域，稳定后再买域名并绑定。

**主要给中国大陆用户使用**：阿里云 OSS 或腾讯云 COS + CDN + 已备案域名。依旧只上传 `dist`，无需 VPS；成本一般由域名、少量对象存储/流量和可选 CDN 组成。

**仅个人演示**：GitHub Pages 足够；注意 SPA 路由（如果未来引入 React Router）需要额外处理 404 回退。目前本项目为单页计时器，不存在这个问题。
