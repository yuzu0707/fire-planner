# GitHub + Vercel 部署

## 1. 先本地检查

```powershell
npm run check
```

如果 PowerShell 拦住 `npm`，直接改用：

```powershell
node scripts/check.mjs
```

如果要本地预览：

```powershell
npm run dev
```

如果 `npm` 被执行策略拦住，改用：

```powershell
node scripts/dev-server.mjs
```

## 2. 推到 GitHub

如果这个仓库还没连远端：

```powershell
git remote add origin <你的-github-repo-url>
```

然后提交并推送：

```powershell
git add .
git commit -m "feat: fire planner with firebase auth"
git push -u origin main
```

## 3. 在 Vercel 导入仓库

1. 打开 Vercel
2. 点击 `Add New...`
3. 选择 `Project`
4. 导入你的 GitHub 仓库

这是一个纯静态站点，通常不需要复杂构建设置。

如果 Vercel 要你填：

- Framework Preset：`Other`
- Build Command：留空
- Output Directory：留空

## 4. 把正式域名回填到 Firebase

Vercel 第一次部署完成后，会拿到一个正式 URL，例如：

```text
https://your-app.vercel.app
```

然后去 Firebase Console：

1. `Authentication`
2. `Settings`
3. `Authorized domains`

把你的正式域名加进去，例如：

- `your-app.vercel.app`

如果你后面绑定自定义域名，也要把自定义域名加进去。

## 5. 正式环境测试

至少测试这几件事：

1. Google 登录能成功
2. 保存方案后刷新仍在
3. 退出后再登录仍能看到自己的历史方案
