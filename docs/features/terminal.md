# Integrated terminal

Use the status bar **Terminal** button, **Ctrl+`**, or the command palette **View: Toggle Terminal** action. The shell starts in the workspace root, including workbench child workspaces.

The terminal supports interactive shells and applications, ANSI colors, Unicode, copy/paste, Ctrl+C, and terminal resizing. Drag the top edge to change panel height.

- Hide preserves the running session and its output.
- Stop ends the shell session; Restart opens another once stopped.
- Closing/reloading the browser page or shutting down px0 ends the session.
- One connection per workspace prevents duplicate shells from accumulating across tabs.

The panel and shell start only on demand; output scrollback is bounded at 2,000 lines. Assets are embedded, so no CDN or additional runtime is needed. Language servers are independent of the terminal.

Available on macOS and Unix. Open px0 through localhost or a loopback IP. Remote terminal connections are rejected. A terminal runs with your account's permissions, just like your regular Terminal app.
