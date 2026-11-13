package main

import (
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

func terminalRequestAllowed(r *http.Request) bool {
	remote, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || !net.ParseIP(remote).IsLoopback() {
		return false
	}
	host := r.Host
	if name, _, err := net.SplitHostPort(host); err == nil {
		host = name
	}
	host = strings.Trim(host, "[]")
	if host != "localhost" && !net.ParseIP(host).IsLoopback() {
		return false
	}
	origin, err := url.Parse(r.Header.Get("Origin"))
	return err == nil && (origin.Scheme == "http" || origin.Scheme == "https") && origin.Host == r.Host
}

func (s *Server) handleTerminal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "GET only")
		return
	}
	if !terminalRequestAllowed(r) {
		fail(w, http.StatusForbidden, "terminal requires a same-origin page on localhost")
		return
	}
	if !atomic.CompareAndSwapInt32(&s.terminalActive, 0, 1) {
		fail(w, http.StatusConflict, "a terminal is already open for this workspace")
		return
	}
	defer atomic.StoreInt32(&s.terminalActive, 0)
	upgrader := websocket.Upgrader{CheckOrigin: terminalRequestAllowed, ReadBufferSize: 4096, WriteBufferSize: 4096}
	connection, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer connection.Close()
	runWorkspaceTerminal(connection, s.ix.Root(), s.streamsDone)
}
