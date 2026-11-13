//go:build !darwin && !linux && !freebsd && !openbsd && !netbsd && !dragonfly && !solaris

package main

import "github.com/gorilla/websocket"

func runWorkspaceTerminal(connection *websocket.Conn, root string, shutdown <-chan struct{}) {
	_ = connection.WriteMessage(websocket.BinaryMessage, []byte("\r\nThe integrated terminal is supported on macOS and Unix systems.\r\n"))
}
