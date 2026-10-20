# opencode-plugins

My custom [opencode](https://opencode.ai) v2 TUI plugins, managed in one repo and symlinked into
`~/.config/opencode/plugins/` (the v2 TUI plugin discovery follows symlinks).

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

**Install**:

```bash
git clone https://github.com/HecterF/opencode-plugins ~/doc/github/opencode-plugins
ln -s ~/doc/github/opencode-plugins/plugins/bell-notifier ~/.config/opencode/plugins/bell-notifier
```

No config registration needed — opencode v2 auto-discovers directory plugins under
`~/.config/opencode/plugins/`.

**Background**: upstream bug report for the bell channel of `@mohak34/opencode-notifier` on v2:
[mohak34/opencode-notifier#147](https://github.com/mohak34/opencode-notifier/issues/147)
