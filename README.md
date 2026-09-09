# 稿迹（Paper Trail）

一个可独立部署的投稿状态追踪网站，支持手动记录、编辑和删除投稿信息，以及 Elsevier、Taylor & Francis、Springer Nature 投稿系统的浏览器插件同步。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个空仓库。
2. 将本文件夹中的全部文件上传到仓库根目录，并使用 `main` 分支。
3. 打开仓库 **Settings → Pages**，在 **Build and deployment** 中选择 **GitHub Actions**。
4. 等待仓库顶部 **Actions** 完成，即可获得公开网址。

若绑定自己的域名，请在 GitHub Pages 设置中填写域名，并按域名服务商提示添加 DNS 记录。

## 投稿系统同步插件

`extension` 文件夹是 Chrome/Edge 浏览器插件。首次发布网站后，在扩展管理页以“加载已解压的扩展程序”方式安装，再点击插件图标填写发布后的新网址。登录出版社的官方投稿系统并打开稿件列表后，插件会自动记录页面上显示的稿件状态。

插件会读取 Taylor & Francis 页面中的阶段时间线；在 Elsevier Editorial Manager 中，会分别读取 `Initial Date Submitted` 和 `Status Date`。

网站记录默认保存在浏览器本地，不会上传到公开仓库，也不会让其他访问者看到。不同设备之间需要账户和后端数据库才能同步。

## 中国大陆访问

GitHub Pages 适合公开演示和保存源码，但中国大陆的访问速度和稳定性不能保证。面向中国大陆稳定运营时，可将同一组静态文件同时部署到境内云服务，并使用自有域名；具体备案要求以所选服务商的当前说明为准。

