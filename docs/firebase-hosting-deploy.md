# Firebase Hosting 部署

这个项目已经按 Firebase Hosting 的静态站点方式配置好了。

## 1. 安装 Firebase CLI

Windows 可以直接用：

```powershell
cmd /c npm install -g firebase-tools
```

如果你不想全局安装，也可以在项目里安装：

```powershell
cmd /c npm install -D firebase-tools
```

## 2. 登录 Firebase

```powershell
firebase login
```

如果浏览器回跳失败，可以改用：

```powershell
firebase login --no-localhost
```

## 3. 检查项目是否已连上

```powershell
firebase projects:list
```

这里应该能看到：

```text
fire-plan-41689
```

## 4. 部署 Hosting

在项目根目录运行：

```powershell
firebase deploy --only hosting
```

部署成功后，Firebase 会给你两个可访问地址：

- `https://fire-plan-41689.web.app`
- `https://fire-plan-41689.firebaseapp.com`

## 5. 回 Firebase Console 补授权域名

打开：

1. `Authentication`
2. `Settings`
3. `Authorized domains`

把下面两个域名都加进去：

- `fire-plan-41689.web.app`
- `fire-plan-41689.firebaseapp.com`

## 6. 上线后验证

至少验证：

1. 页面能打开
2. Google 登录成功
3. 保存方案成功
4. 刷新后还能读回历史方案
