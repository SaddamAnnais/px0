<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://px0.ai/logo/px0-logo-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://px0.ai/logo/px0-logo-light.png">
  <img alt="px0" src="https://px0.ai/logo/px0-logo-dark.png" width="120">
</picture>

---

px0 is a review workbench and speed-first IDE built for AI-generated code. It turns your browser into a zero-latency console with native Git and GitHub integrations, instant search across massive codebases, in-place quick fixes, and seamless handoff to local AI coding harnesses.

As AI agents author more code directly from the terminal, engineering productivity is no longer constrained by how fast you type - it is constrained by how fast you can review, navigate, and verify changes. px0 replaces heavy, multi-gigabyte editing suites with an instant, distraction-free environment built specifically for this review loop.

- < 1 ms cold start
- ~20–30 MB server daemon RAM (~100–180 MB total with browser tab, vs. VS Code's ~1,440 MB)
- Single static Go binary with zero runtime dependencies (no Electron, no Node, no CGO)
- ~280 languages tokenized natively via Chroma

See full performance benchmarks and comparisons at [px0.ai/benchmarks](https://px0.ai/benchmarks).

## Features

- Review workbench: Run `px0` with no arguments to open a unified launchpad on a single port, browse projects, and keep unsubmitted review drafts across sessions.
- Pull request reviews & Git control: Review GitHub, GitLab, Gitea/Forgejo, and Bitbucket Cloud PRs directly (`px0 <pr-url>`), inspect scoped merge-base diffs, draft inline comments, 1-click agentic rebase for conflict resolution, squash and merge, browse commit diffs, and stage, commit, or push from the browser.
- Multi-turn agent threads: Anchor conversations to code ranges (`Alt+T`), stream live tool execution over Server-Sent Events, queue batch inline edits across files (`Alt+E`), and dispatch to Claude Code, Cursor Agent, Antigravity, OpenCode, Codex, Aider, or Goose.
- Unpushed commit review: Read the commits your branch is ahead of its tracking branch by, one file diff at a time, before you push them.
- In-place quick edits: Edit and save a file in the browser (`Cmd/Ctrl+E`, `Cmd/Ctrl+S`) with unsaved-change protection when an agent prompt is overkill.
- Fast navigation: Fuzzy file search (`Cmd/Ctrl+P`), symbol outline (`Cmd/Ctrl+Shift+O`), and workspace regex search (`Cmd/Ctrl+Shift+F`) in milliseconds.
- Remote-first: Spin up on any remote server, VM, or container in `< 1 ms` (`-host 0.0.0.0`) with sandboxed traversal guards and origin verification—no SSH keys, tunnels, or remote daemons required.
- Virtual rendering: Opens 400,000-line files smoothly by mounting only visible rows (~60 DOM rows); frees memory back to the OS after 15 seconds of inactivity.
- Rich code viewer: 14 built-in themes, rendered Markdown with Mermaid diagrams, CSV/TSV table view, image inspector, and optional zero-config LSP.

## Installation

Quick install (macOS, Linux, BSD):

```bash
curl -fsSL https://px0.ai/install.sh | sh
```

Build from source (requires Go 1.24+ and Node.js or Bun):

```bash
git clone https://github.com/px0-ai/px0.git
cd px0
make build
install -d ~/.local/bin && install px0 ~/.local/bin/
```

To update an existing installation:

```bash
px0 --update
```

## Usage

```bash
# Open the review workbench: pick any directory or paste a PR URL
px0

# Inspect current directory
px0 .

# Inspect a specific directory or file
px0 ~/workspace/project
px0 main.go:42

# Review a pull request: GitHub, GitLab, Gitea/Forgejo/Codeberg, or Bitbucket Cloud
# (first time? see docs/features/pr-review-getting-started.md)
px0 https://github.com/owner/repo/pull/123
px0 https://gitlab.com/group/project/-/merge_requests/45
px0 https://codeberg.org/owner/repo/pulls/7
px0 https://bitbucket.org/workspace/repo/pull-requests/9

# Remote or headless server mode
px0 -host 0.0.0.0 -port 7777 ~/workspace

# Behind a reverse proxy under a subpath
px0 -base-path /rev-123/ -host 0.0.0.0 -port 7777 ~/workspace
```

When px0 binds to `0.0.0.0`, it prints a `network` URL for every unique
non-loopback IPv4 address on the machine, using the port selected by the
listener:

```text
  url:        http://0.0.0.0:7777
  network:    http://10.0.0.15:7777
  network:    http://192.168.1.42:7777
```

With no target, px0 serves the [review workbench](docs/features/workbench.md)
instead, which runs each directory or PR you open as its own px0 under
`/w/<id>/` on the same port. Its list of what you opened is saved in
`$XDG_STATE_HOME/px0/workbench.json` (or `~/.px0/workbench.json`).

Open the address that is reachable from your local machine. The list can
include LAN, VPN, and container-network addresses, depending on the remote
host's interfaces.

Access securely over Tailscale, WireGuard, reverse proxy, or Cloudflare Tunnel
with zero remote setup overhead and workspace-confined file access
(path traversal protection & DNS rebinding checks). Anyone who can reach the
address can also edit files in that workspace, so expose it only over trusted networks.
The workbench goes further: anyone who can reach it can browse and open any directory px0 can read.

## Development

```bash
git clone https://github.com/px0-ai/px0.git
cd px0

# Run tests
make test

# Live frontend development (serves web/ assets directly from disk)
go run . -dev .

# Build binary
make build
```

## Benchmarks

```bash
# Clone the benchmark corpus (~3 GB: Linux, Kubernetes, TypeScript, etc.)
./benchmark.sh --clone

# Run benchmarks across the corpus
./benchmark.sh

# Compare px0 directly against VS Code on the current workspace
./benchmark.sh --vscode .

# Profile memory lifecycle (index, search, idle memory release)
./benchmark.sh --memory bench-repos/linux
```

> **Architecture & Memory Accounting**: px0 separates the lightweight native Go daemon from the browser-rendered UI. The Go server consumes ~20–30 MB resident RAM (RSS). The active browser tab allocates ~80–150 MB for DOM nodes, V8 JS runtime, and GPU compositing. Combined, the total local memory footprint is ~100–180 MB (~85–90% lighter than Electron IDEs like VS Code at ~1,440 MB, which bundle dedicated Chromium and Node runtimes). In remote or container environments (`px0 -host 0.0.0.0`), the remote host pays strictly the ~20–30 MB server cost. See [BENCHMARKS.md](BENCHMARKS.md) for full methodology and breakdowns.

## Documentation

- [Docs](https://px0.ai/docs)
- [Benchmarks](https://px0.ai/benchmarks)
- [Blog](https://px0.ai/blog)
- [Changelog](https://px0.ai/changelog)
- [Partners](https://px0.ai/design-partners)

## License

[MIT License](LICENSE) © Arpit Bhayani

## Integrated terminal (fork)

Click **>_ Terminal** in the status bar, press **Ctrl+`** (including on macOS), or choose **View: Toggle Terminal** from the command palette. A login shell starts in the current project folder only when you first open the terminal. Standard interactive commands, ANSI colors, arrow keys, and Ctrl+C are supported.

Drag the divider above the terminal to resize it. **Interrupt** sends Ctrl+C to the foreground command. **Hide** keeps the shell running; **Stop** terminates the session; **Restart** starts another shell after it stops. Closing or reloading the page ends its session. Each workspace allows one terminal connection. Terminal scrollback is limited to 2,000 lines.

This fork supports terminals on macOS and Unix, using the shell in `SHELL` (falling back to `/bin/sh`). Terminal access requires a same-origin browser page accessed through a loopback address such as `http://127.0.0.1:7777`; remote access is not supported. A workbench workspace uses its own project folder. Terminal assets are embedded and loaded on demand, with no Node.js runtime requirement.

Automatic upstream updates are disabled by default in this fork so they do not replace the terminal feature. Build updates from this fork instead.

To build this fork without replacing the original px0 installation:

```sh
bun scripts/build-web.js
go build -trimpath -ldflags='-s -w' -o px0-terminal .
./px0-terminal
```

Go 1.25+ and Bun are build tools only. The resulting binary includes terminal assets.

## Open recent projects (fork)

Press **Ctrl+R** on the Workbench dashboard or inside any open project to show a searchable recent-project picker. Type a partial name such as `resol` to find `xps-pot-product-resolution-backend`; matching is case-insensitive and also supports characters in order with gaps. Paths support partial substring matches. Use **↑/↓** to select, **Enter** to open in the current tab, **Cmd+Enter** (macOS) or **Ctrl+Enter** (other platforms) to open in a new browser tab, and **Esc** to close. There is also a **Recent Projects** button and a **File: Open Recent Project** command.

This shortcut uses Control on macOS too. It takes priority over browser reload and terminal history search; Command+R remains the browser reload shortcut on macOS. Standalone project sessions create a lightweight embedded workbench on first use and stop its project processes at shutdown.

Code navigation uses **Ctrl+-** for back and **Ctrl+Shift+-** for forward, including on macOS. The old Option+arrow history bindings are removed. Terminal input retains its shell shortcuts.
