const Koa = require('koa')
const dotenv = require('dotenv')
const koa2Req = require('koa2-request')
const bodyParser = require('koa-bodyparser')
const { Configuration, OpenAIApi } = require("openai")

dotenv.config()

// GitLab API接口和访问令牌
const apiUrl = process.env.API_URL
const accessToken = process.env.ACCESS_TOKEN
// ChatGPT OPENAI_AI_KEY
const chatgptAccessToken = process.env.OPENAI_AI_KEY

// 启动 Koa 服务器，监听 4003 端口
const app = new Koa()
app.use(bodyParser())
const port = 4003

const configuration = new Configuration({
    apiKey: chatgptAccessToken,
})

const openai = new OpenAIApi(configuration)

/**
 * @description 重试函数，在失败后重新执行
 * @param {()=> Promise<any>} fn 执行函数
 * @param {number} delay 重试间隔
 * @param {number} count 重试次数
 * @return {Promise<any>}
 */
const retry = async (fn, delay, count) => {
    if(count <= 0) {
        return {content: '请求超时，请稍后重试'}
    }
    try {
        const res = await fn()
        return res
    } catch (error) {
        setTimeout(async () => {
            await retry(fn, delay, count - 1)
        }, delay)
    }
}

/**
 * @description 延迟函数
 * @param {number} delay
 * @return {Promise<void>}
 */
const sleep = (delay) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, delay)
    })
}

/**
 * @description 将更改发送到 ChatGPT 以进行代码审查
 * @param {string} content 更改内容
 * @return {Promise<string>} 返回的评论内容
 */
const sendChangesToChatGPT = (content) => async () => {
    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content}],
    })
    return completion.data.choices[0].message
}

/**
 * @description 获取这次合并请求的更改内容
 * @param {number} projectId 项目 ID
 * @param {number} mergeRequestId 合并请求 ID
 * @return {Promise<string>} 返回的评论内容
 */
const getMergeRequestChanges = async (projectId, mergeRequestId) => {
    try {
        const options = {
            url: `${apiUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}/changes`,
            headers: {
                'Private-Token': accessToken,
            },
        }
        const response = await koa2Req.get(options)
        if (response.statusCode === 200 || response.statusCode === 201) {
            const change = JSON.parse(response.body)
            return change
        } else {
            throw new Error(response.body)
        }
    } catch (error) {
        throw error
    }
}

/**
 * @description 获取发送给 ChatGPT 的评论
 * @param {string} body
 * @param {{diff: string}} change
 * @return {string}
 */
const getComment = (body, change) => {
    let oldCode = ''
    let newCode = ''
    change.diff.split('\n').forEach((line) => {
      if (line.startsWith('-')) {
        oldCode += `${line}\n`
      } else if (line.startsWith('+')) {
        newCode += `${line}\n`
      } else {
        oldCode += `${line}\n`
        newCode += `${line}\n`
      }
    })
    return `你作为一个前端开发工程师，正在进行 code review，这是一个 merge request，这个变更的作用是什么? 这部分代码有问题吗? 如果有问题有没有更好的写法?\n\n${body}\n原代码：\n${oldCode}\n新代码：\n${newCode}`
}

/**
 * @description 获取更改并发送到 ChatGPT 进行代码审查
 * @param {{diff: string}} change
 * @param {number} projectId 项目 ID
 * @param {number} mergeRequestId 合并请求 ID
 */
const getChangeSendChatGpt = async (change, projectId, mergeRequestId) => {
    try {
        let body = `文件${change.new_path}`
        const content = getComment(body, change)
        const res = await retry(sendChangesToChatGPT(content), 5000, 5)
        const comment = res.content
        if (comment.length < 0) {
            return
        }
        body += `: ${comment}\n\n---这个评论由gitlab自动codereview机器人发出`
        // 向合并请求添加评论
        const options = {
            uri: `${apiUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestId}/discussions?body=${encodeURI(body)}`,
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'PRIVATE-TOKEN': accessToken
            }
        }
        const response = await koa2Req(options)
        if (response.statusCode === 200 || response.statusCode === 201) {
            console.log('评论成功')
        } else {
            console.log('response: ', response.statusCode, response.body)
        }
    } catch (error) {
        console.log('error: ', error)
    }
}

/**
 * @description 监听合并请求事件，获取更改内容并发送到 ChatGPT 进行代码审查
 */
app.use(async (ctx) => {
    try {
        // 检查请求是否为 GitLab 的合并请求事件
        if (ctx.request.headers['x-gitlab-event'] !== 'Merge Request Hook' || !ctx.request.method === 'POST') {
            return
        }
        const body = ctx.request.body
        // 检查事件是否为打开或重新打开合并请求
        if (body.object_kind !== 'merge_request' || !['open', 'reopen'].includes(body.object_attributes.action)) {
            return
        }
        // 获取合并请求信息
        const projectId = body.project.id
        const mergeRequestId = body.object_attributes.iid
        const response = await getMergeRequestChanges(projectId, mergeRequestId)
        const changes = response.changes || []
        // 链式串行调用
        await changes.map((change, index) => async () => {
            await getChangeSendChatGpt(change, projectId, mergeRequestId)
            if (index < changes.length - 1) {
                // 为了避免触发 chatGpt 请求过多的报错，我们在每次发送评论后等待 5 秒
                await sleep(5000)
            }
        }).reduce((p, n) => p.then(n), Promise.resolve())
        console.log('评论结束')
    } catch (error) {
        console.log('error: ', error)
    }
    ctx.body = 'ok'
})

app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
})