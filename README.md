# 1836 Alpha (纯前端 PWA 版)

这个版本不需要服务器，所有数据都保存在你的设备浏览器 IndexedDB 里（iPhone/iPad 也支持）。
功能：英法 1836Q1 种子、生成建议值、季度结算（殖民回填 + 1季滞后 + 港口/航线乘子 + 财政/债务/信用 + 伦理钩子）、季度新闻、建议值可编辑、存档导入/导出、PWA 离线。

## 本地预览
用任何静态服务器打开本目录，例如：
```bash
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000
```

## 部署到 GitHub Pages
1. 上传本目录全部文件到你的仓库根目录（例如 1836-alpha-pwa）。
2. 仓库 Settings → Pages → 选择 `Deploy from a branch`，分支 `main`，目录 `/ (root)`，保存。
3. 访问生成的 HTTPS 链接（例如 https://用户名.github.io/1836-alpha-pwa/）。
4. 在 iPhone/iPad 的 Safari 中打开 → 分享 → 加到主屏幕。

> 数据都在本机；换设备请用“导出存档 / 导入存档”迁移。

## 文件结构
- index.html / styles.css：界面与样式（历史风格）
- js/
  - db.js：Dexie + IndexedDB 表结构，导入导出
  - seed.js：英法 1836Q1 初始数据
  - logic.js：建议值生成与季度结算（含殖民回填、滞后、财政等）
  - ui.js：渲染逻辑与事件绑定
- manifest.webmanifest / sw.js：PWA 清单与离线缓存
- assets/icons：PWA 图标（你可替换为更美观的图标）
- .nojekyll：GitHub Pages 无需 Jekyll 处理

## 备份
- 顶部按钮“导出存档”会下载一个 JSON（例如 1836_save.json）。
- 在另一台设备打开同站点后，用“导入存档”选择该 JSON，即可继续游戏。

祝内测顺利！
