# ChatGPT 自动 Code Review 机器人

本项目使用 ChatGPT 自动进行 GitLab Merge Request 的 Code Review。

## 如何使用

1. 首先，在 GitLab 上创建一个新的机器人用户，并生成对应的 Access Token。请确保该用户对于要进行 Code Review 的仓库拥有访问权限。

2. 克隆本项目代码并安装依赖：

   ```
   git clone https://github.com/peng-yw/ChatGPT-Gitlab-CodeReview.git
   cd ChatGPT-Gitlab-CodeReview
   npm install
   ```

3. 在项目根目录下找到 `.env` 文件，并填写以下信息：

   ```
   API_URL=<GitLab 地址>
   ACCESS_TOKEN=<机器人用户的 Access Token>
   OPENAI_AI_KEY=<ChatGPT API Key>
   ```

   其中 `API_URL` 为你的gitlab地址，`ACCESS_TOKEN`为你的个人访问令牌（可以在 gitlab的 User Setting - Access Tokens 中生成），`OPENAI_AI_KEY` 为你的 ChatGPT API Key。

4. 启动机器人：

   ```
   npm start
   ```

5. 在 GitLab 项目的 Settings - Webhooks 中配置机器人的请求地址，勾选 "Merge Request events" 选项以将事件发送到机器人，从而启动自动化 Code Review。


## 注意事项

- 本项目使用了 ChatGPT 提供的 AI 服务，请确保你已经拥有了对应的 API Key，否则机器人无法正常工作。

- 机器人默认只会对新增的代码进行 Code Review，如果需要对修改的代码也进行检查，请修改 `index.js` 中的代码。

- 由于本项目依赖于外部 AI 服务，代码 Review 的速度会受到网络状况等因素的影响。如果 Review 的速度较慢，请耐心等待。

## 作者信息

本项目由 [peng-yw](https://github.com/peng-yw) 开发。如果您有任何问题或建议，欢迎提交 [Issue](https://github.com/peng-yw/ChatGPT-Gitlab-CodeReview/issues) 或 [Pull Request](https://github.com/peng-yw/ChatGPT-Gitlab-CodeReview/pulls)。

---- 这个README.md由ChatGPT自动生成