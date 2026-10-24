# opencode-plugins

My custom [opencode](https://opencode.ai) v2 TUI plugins. Each plugin is its own git repo cloned
directly into `~/.config/opencode/plugins/<name>/` (the v2 TUI plugin discovery auto-loads
directory plugins there; no config registration needed).

## plugins/bell-notifier

Restores terminal bell (BEL, `\x07`) notifications on opencode v2.

**Why**: on opencode v2 the server runs as a separate detached process whose stdout is `/dev/null`
(`stdio: ["ignore","ignore","pipe"]`), so server plugins that write BEL or escape sequences to
stdout can no longer reach the terminal. This TUI plugin runs inside the TUI process (stdout = your
terminal) and rings the bell on the same events, which is enough for terminals like Tabby to mark
the tab active and pop a click-to-tab notification (Tabby "Notify on activity").

**Events** → bell: `form.created` (question), `permission.asked` (permission),
`session.execution.succeeded/interrupted` (complete), `session.execution.failed` (error).
Subagent sessions are skipped; 500 ms debounce.

**Multiple TUIs** (session tabs disabled — `tui.json` `"tabs": {"mode": "off"}`): all TUIs
connect to the same server and every TUI receives events for *all* sessions. The plugin rings
only for sessions this TUI has displayed (recorded while the router points at them):
a task started here keeps ringing on completion even after you switch to another session in
this TUI, and a task in another terminal's TUI never rings here. Already-done tasks don't
re-ring (per-execution dedup). Restarting the TUI re-registers the restored session, so
in-flight tasks still notify.

**Install**:

```bash
git clone https://github.com/HecterF/opencode-plugins ~/.config/opencode/plugins/bell-notifier
```

The plugin directory *is* the git repo, so updates are just `git pull` inside it. No config
registration needed — opencode v2 auto-discovers directory plugins under
`~/.config/opencode/plugins/`.

**Background**: upstream bug report for the bell channel of `@mohak34/opencode-notifier` on v2:
[mohak34/opencode-notifier#147](https://github.com/mohak34/opencode-notifier/issues/147)
