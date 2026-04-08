# Firebase + Google 登录配置

这套步骤是给当前这个 FIRE Planner 项目用的。

## 你最终会拿到什么

你最后需要填进项目的是一组 Firebase Web 配置：

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

这些值都要填进 [config.js](../config.js)。

## 1. 创建 Firebase 项目

1. 打开 Firebase Console
2. 点击 `Add project`
3. 创建完成后进入项目

## 2. 给项目添加 Web App

1. 在 Firebase 项目首页点击 Web 图标 `</>`
2. 给应用起一个名字
3. 创建完成后，你会看到一段 `firebaseConfig`

把这些值填进 [config.js](../config.js)：

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

## 3. 开启 Google 登录

1. 打开 Firebase Console
2. 进入 `Authentication`
3. 点击 `Get started`
4. 打开 `Sign-in method`
5. 启用 `Google`
6. 填好公开显示的项目名称和 support email
7. 保存

官方文档：

- [Firebase Google 登录](https://firebase.google.com/docs/auth/web/google-signin)

## 4. 配置 Authorized Domains

打开：

1. `Authentication`
2. `Settings`
3. `Authorized domains`

至少加上：

- `localhost`
- 你的正式域名，例如 `your-app.vercel.app`

注意：Firebase 官方文档提到，2025 年 4 月 28 日之后创建的项目，`localhost` 不再默认加入 authorized domains，需要手动加。

参考：

- [Firebase Auth authorized domains 相关说明](https://firebase.google.com/docs/auth/web/email-link-auth)

## 5. 创建 Firestore Database

1. 进入 `Firestore Database`
2. 点击 `Create database`
3. 先选一个离你用户更近的区域
4. 创建完成后进入 `Rules`

把 [firebase/firestore.rules](../firebase/firestore.rules) 里的内容粘进去并发布。

这个规则的含义是：

- 每个用户只能读写自己的方案
- 数据路径是 `users/{uid}/plans/{planId}`

参考：

- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## 6. 本地测试

运行：

```powershell
npm run dev
```

如果 PowerShell 拦住 `npm`，直接改用：

```powershell
node scripts/dev-server.mjs
```

然后打开：

```text
http://localhost:8080
```

测试这几件事：

1. 点击 `Google 登录`
2. 使用任意允许的 Google 账号登录
3. 保存一条方案
4. 刷新页面
5. 确认历史方案还能读出来

## 7. 如果别人登录不了

优先检查：

1. `Authentication -> Sign-in method -> Google` 是否已启用
2. `Authentication -> Settings -> Authorized domains` 里是否加了当前域名
3. [config.js](../config.js) 的 Firebase Web 配置是否填对
4. Firestore 是否已创建
5. [firebase/firestore.rules](../firebase/firestore.rules) 是否已经发布

## 官方文档

- Firebase Web Setup：
  - https://firebase.google.com/docs/web/setup
- Firebase Google 登录：
  - https://firebase.google.com/docs/auth/web/google-signin
- Firebase Firestore Security Rules：
  - https://firebase.google.com/docs/firestore/security/get-started
- Firebase Web SDK 兼容版：
  - https://firebase.google.com/docs/web/learn-more
