# 余火 FIRE Planner

一个面向 FIRE 用户的退休测算工具，支持：

- 房贷、车贷、商业保障、居民养老补缴等阶段性支出
- 上海居民养老保险、商业保险 / 年金、退休后兼职收入
- 通胀折算后的实际购买力测算
- 自定义目标：活到多少岁、那时本金还剩多少
- Firebase Google 登录后按用户保存自己的历史方案

## 仓库结构

```text
.
├─ index.html
├─ styles.css
├─ app.js
├─ model.js
├─ cloud.js
├─ config.js
├─ package.json
├─ scripts/
│  ├─ check.mjs
│  └─ dev-server.mjs
├─ docs/
│  ├─ firebase-google-setup.md
│  └─ github-vercel-deploy.md
└─ firebase/
   └─ firestore.rules
```

## 文件说明

- `index.html`
  - 页面结构和问答式输入流程
- `styles.css`
  - 整体视觉和交互样式
- `model.js`
  - FIRE 计算核心
- `cloud.js`
  - Firebase Auth / Firestore 读写
- `app.js`
  - 页面渲染、步骤切换、保存和读取
- `config.js`
  - Firebase Web 配置
- `firebase/firestore.rules`
  - Firestore 权限规则
- `docs/firebase-google-setup.md`
  - Firebase + Google 登录配置步骤
- `docs/github-vercel-deploy.md`
  - GitHub + Vercel 部署步骤

## 本地开发

### 启动本地静态服务

```powershell
npm run dev
```

打开：

```text
http://localhost:8080
```

如果 PowerShell 提示 `npm.ps1 cannot be loaded because running scripts is disabled`，直接改用：

```powershell
node scripts/dev-server.mjs
```

### 语法检查

```powershell
npm run check
```

如果 `npm` 被系统策略拦住，也可以直接用：

```powershell
node scripts/check.mjs
```

## 建议顺序

1. 配 Firebase 和 Google 登录
   - 看 [docs/firebase-google-setup.md](./docs/firebase-google-setup.md)
2. 填 [config.js](./config.js)
3. 本地运行并测试登录、保存、刷新
4. 推到 GitHub
5. 用 Vercel 部署
   - 看 [docs/github-vercel-deploy.md](./docs/github-vercel-deploy.md)

## Firebase 配置

编辑 [config.js](./config.js)：

```js
window.FIRE_APP_CONFIG = {
  firebaseConfig: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
  },
};
```

## Firestore 规则

在 Firebase Console 的 Firestore Rules 页面粘贴：

- [firebase/firestore.rules](./firebase/firestore.rules)

## 部署

部署文档见：

- [docs/github-vercel-deploy.md](./docs/github-vercel-deploy.md)
