# 🔧 Auto Confirm Input Helper

一个Chrome浏览器插件，用于自动填写确认输入框内容。支持腾讯云、阿里云、GitHub等平台的确认对话框。

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特点

- 🎯 **自动识别**：自动检测页面上的确认输入框
- 📝 **自动填写**：根据配置的模板自动填入内容（只填写不提交）
- 🔧 **自定义模板**：支持添加、编辑、删除自定义模板
- 🎨 **美观界面**：使用Vue3 + daisyUI构建的现代化界面
- 💾 **云端同步**：模板配置通过Chrome存储同步

## 📦 支持的平台

- ✅ 腾讯云 - 删除密钥确认
- ✅ 腾讯云 - 删除资源确认
- ✅ 阿里云 - 删除确认
- ✅ GitHub - 删除仓库确认
- ✅ 支持自定义添加更多...

## 🚀 安装方法

### 从Release安装（推荐）

1. 前往 [Releases](../../releases) 页面
2. 下载最新版本的 `auto-confirm-helper-vX.X.X.zip`
3. 解压到任意文件夹
4. 打开Chrome，进入 `chrome://extensions/`
5. 开启右上角的「开发者模式」
6. 点击「加载已解压的扩展程序」
7. 选择解压后的文件夹

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yourusername/suried-auto-confirm-input-helper.git
cd suried-auto-confirm-input-helper

# 安装依赖
pnpm install

# 生成图标
pnpm run generate-icons

# 构建
pnpm run build

# 构建产物在 dist 目录
```

## 🎮 使用方法

1. 安装插件后，点击浏览器工具栏中的插件图标
2. 在「模板列表」中查看和管理现有模板
3. 使用开关启用/禁用特定模板
4. 点击「添加模板」创建自定义模板
5. 当访问匹配的页面时，插件会自动填写确认内容

### 添加自定义模板

1. 点击「➕ 添加模板」标签
2. 填写模板名称和描述
3. 配置匹配条件（至少填一项）：
   - URL匹配模式（支持通配符 `*`）
   - 包含文本（页面需包含的关键词）
   - Input placeholder匹配
   - Input class匹配
   - 容器class匹配
4. 填写要自动填入的值
5. 点击保存

## 🔨 开发

```bash
# 开发模式
pnpm run dev

# 构建
pnpm run build

# 生成图标
pnpm run generate-icons
```

## 📁 项目结构

```
├── .github/workflows/    # GitHub Actions工作流
├── public/icons/         # 插件图标
├── src/
│   ├── background/       # Service Worker
│   ├── content/          # Content Script
│   ├── types/            # TypeScript类型定义
│   ├── utils/            # 工具函数
│   ├── App.vue           # Popup主组件
│   └── main.ts           # 入口文件
├── manifest.json         # Chrome扩展配置
└── vite.config.ts        # Vite配置
```

## 🔄 自动构建

每次推送到 `main` 或 `master` 分支时，GitHub Actions会自动：

1. 递增版本号（patch版本 +1）
2. 构建插件
3. 创建Release并上传ZIP包

## 📄 License

MIT License. See [LICENSE](LICENSE).
