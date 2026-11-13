# Integrated terminal

`terminal.go` registers `/api/terminal` and admits only WebSocket GET requests from a matching HTTP(S) Origin, loopback Host, and loopback peer. A workspace permits one active connection. The workbench reverse proxy preserves the original Host/Origin and forwards WebSocket upgrades. Terminal upgrades bypass response gzip.

`terminal_unix.go` starts a login shell in the workspace root using a PTY (`creack/pty`) and streams raw bytes through `gorilla/websocket`. Client messages are bounded JSON input or resize events. Output is binary to preserve split UTF-8 sequences and ANSI escapes. Resize dimensions are capped at 1,000 rows/columns. The shell is reaped on exit, the PTY is closed on disconnect, and shutdown closes active sessions. Unsupported platforms provide a message without launching a shell.

`web/src/terminal.js` loads embedded xterm.js 5.5.0 and addon-fit 0.10.0 only on the first open. The UI keeps a hidden terminal alive, separates Stop from Hide, limits scrollback, and disposes the session on page exit. Terminal keyboard events bypass editor shortcuts; Ctrl+Backquote toggles the panel from either area. Assets retain their upstream MIT licenses in `web/vendor/`.
