import { Plugin } from "@opencode/plugin/tui"

// 复刻 @mohak34/opencode-notifier 的 bell 通道（~/.config/opencode/opencode-notifier.json: bell: true）。
// opencode v2 中 server 插件的 stdout 不再连接终端（daemon 模式为 /dev/null），
// TUI 插件与终端同进程，process.stdout 即用户终端，BEL 可直达 Tabby。
const lastBell = { time: 0 }

function ringBell(context: Plugin.Context, sessionID: string | undefined) {
  // 子会话不通知（对齐 v1 配置 subagent_complete: false）
  const session = sessionID ? context.data.session.get(sessionID) : undefined
  if (session?.parentID !== undefined) return
  const now = Date.now()
  if (now - lastBell.time < 500) return
  lastBell.time = now
  if (process.stdout.isTTY) process.stdout.write("\x07")
}

export default Plugin.define({
  id: "user.bell-notifier",
  setup(context) {
    const errored = new Set<string>()
    const terminal = new Set<string>()
    const forms = new Set<string>()
    const permissions = new Set<string>()

    const started = (sessionID: string) => {
      errored.delete(sessionID)
      terminal.delete(sessionID)
    }
    const ended = (sessionID: string) => {
      if (terminal.has(sessionID)) return
      terminal.add(sessionID)
      if (errored.delete(sessionID)) return // failed 已响过，不再响 done
      ringBell(context, sessionID)
    }

    const dispose = [
      context.data.on("form.created", (event) => {
        if (forms.has(event.data.form.id)) return
        forms.add(event.data.form.id)
        ringBell(context, event.data.form.sessionID) // question
      }),
      context.data.on("form.replied", (event) => forms.delete(event.data.id)),
      context.data.on("form.cancelled", (event) => forms.delete(event.data.id)),
      context.data.on("permission.asked", (event) => {
        if (permissions.has(event.data.id)) return
        permissions.add(event.data.id)
        ringBell(context, event.data.sessionID) // permission
      }),
      context.data.on("permission.replied", (event) => permissions.delete(event.data.requestID)),
      context.data.on("session.execution.started", (event) => started(event.data.sessionID)),
      context.data.on("session.execution.succeeded", (event) => ended(event.data.sessionID)), // complete
      context.data.on("session.execution.interrupted", (event) => ended(event.data.sessionID)), // complete
      context.data.on("session.execution.failed", (event) => {
        const sessionID = event.data.sessionID
        if (terminal.has(sessionID)) return
        terminal.add(sessionID)
        errored.add(sessionID)
        ringBell(context, sessionID) // error
      }),
    ]
    return () => dispose.reverse().forEach((cleanup) => cleanup())
  },
})
