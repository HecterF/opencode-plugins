import { Plugin } from "@opencode/plugin/tui"

// 复刻 @mohak34/opencode-notifier 的 bell 通道（~/.config/opencode/opencode-notifier.json: bell: true）。
// opencode v2 中 server 插件的 stdout 不再连接终端（daemon 模式为 /dev/null），
// TUI 插件与终端同进程，process.stdout 即用户终端，BEL 可直达 Tabby。
//
// 多 TUI 通知规则（前提：session tabs 已禁用，一个 TUI 同时只显示一个会话）：
// - server 事件全局广播，每个 TUI 都会收到所有会话的事件，因此必须判断会话归属。
// - 会话在本 TUI 中显示过（router 指向它）即记为本 TUI 的会话（owned）；
//   登记后即使切到别的会话，该会话内任何 running→done 的任务完成仍会通知。
// - 其他 TUI 的会话不响铃，避免别的终端 tab 重复弹通知。
// - 已 done 的任务不重复通知（terminal/errored 按次去重）。
const lastBell = { time: 0 }

export default Plugin.define({
  id: "user.bell-notifier",
  setup(context) {
    // 本 TUI 显示过的会话（root sessionID）
    const owned = new Set<string>()

    // router.current() 的 sessionID → root，避免每个事件都调 session.root()
    let routerMemo: { sessionID: string; root: string } | undefined
    const routerRoot = (): string | undefined => {
      const route = context.ui.router.current()
      if (route?.type !== "session") return undefined
      if (routerMemo?.sessionID === route.sessionID) return routerMemo.root
      let root = route.sessionID
      try {
        root = context.data.session.root(route.sessionID)
      } catch {
        // root() 失败时退化为 sessionID 本身
      }
      routerMemo = { sessionID: route.sessionID, root }
      return root
    }

    function sessionRoot(sessionID: string): string {
      try {
        return context.data.session.root(sessionID)
      } catch {
        return sessionID
      }
    }

    // 每个事件到达时登记本 TUI 当前显示的会话：
    // 用户在会话视图里发起任务（started 事件）时登记；
    // 也覆盖 TUI 重启/插件热重载后 router 恢复到运行中会话的场景。
    const track = context.data.listen(() => {
      const root = routerRoot()
      if (root !== undefined) owned.add(root)
    })

    const errored = new Set<string>()
    const terminal = new Set<string>()
    const forms = new Set<string>()
    const permissions = new Set<string>()

    function ringBell(sessionID: string | undefined) {
      if (!sessionID) return
      if (!owned.has(sessionRoot(sessionID))) return // 其他 TUI 的会话不响
      // 子会话不通知（对齐 v1 配置 subagent_complete: false）
      const session = context.data.session.get(sessionID)
      if (session?.parentID !== undefined) return
      const now = Date.now()
      if (now - lastBell.time < 500) return
      lastBell.time = now
      if (process.stdout.isTTY) process.stdout.write("\x07")
    }

    const started = (sessionID: string) => {
      errored.delete(sessionID)
      terminal.delete(sessionID)
    }
    const ended = (sessionID: string) => {
      if (terminal.has(sessionID)) return
      terminal.add(sessionID)
      if (errored.delete(sessionID)) return // failed 已响过，不再响 done
      ringBell(sessionID)
    }

    const dispose = [
      track,
      context.data.on("form.created", (event) => {
        if (forms.has(event.data.form.id)) return
        forms.add(event.data.form.id)
        ringBell(event.data.form.sessionID) // question
      }),
      context.data.on("form.replied", (event) => forms.delete(event.data.id)),
      context.data.on("form.cancelled", (event) => forms.delete(event.data.id)),
      context.data.on("permission.asked", (event) => {
        if (permissions.has(event.data.id)) return
        permissions.add(event.data.id)
        ringBell(event.data.sessionID) // permission
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
        ringBell(sessionID) // error
      }),
      context.data.on("session.deleted", (event) => owned.delete(sessionRoot(event.data.sessionID))),
    ]
    return () => dispose.reverse().forEach((cleanup) => cleanup())
  },
})
