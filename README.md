# 安全技术错题本

从 macOS 备忘录 `26技术` 导出的移动端优先错题本。

## 内容

- `data.json`：从备忘录解析出的章节与错题条目
- `title-config.json`：可云同步的错题本标题配置
- `user-data.json`：可云同步的标题、背诵记录、测试记录和自定义命题
- `index.html`：静态页面入口
- `styles.css`：桌面端与手机端样式
- `app.js`：背诵复习、测试模式、搜索、筛选、复习次数、掌握状态、错题分析图

## 更新

重新导出备忘录后替换 `data.json`，GitHub Pages 会展示最新错题内容。

当前版本不会自动读取 macOS 备忘录。备忘录更新后，需要重新导出并更新 `data.json`，再推送到 GitHub。

顶部标题和学习数据会优先读取 `user-data.json`。页面里的“保存标题”和“编辑命题”会先保存到本机浏览器；“云同步全部”需要输入具备仓库 Contents 写入权限的 GitHub Token，用于更新 `user-data.json`，同时同步 `title-config.json` 以保持兼容。

建议使用 GitHub fine-grained token：只选择仓库 `zxtt1998/safety-tech-notebook`，Repository permissions 里把 Contents 设置为 Read and write。Token 只保存在本机浏览器。

薄弱章节雷达分两套：

- 背诵复习薄弱度：按备忘录中的章节错题量、未掌握数量、复习覆盖率计算。
- 测试结果薄弱度：按每章测试错误率、答错次数、答题覆盖率计算。
