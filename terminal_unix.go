//go:build darwin || linux || freebsd || openbsd || netbsd || dragonfly || solaris

package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"
)

type terminalInput struct {
	Type string `json:"type"`
	Data string `json:"data"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func runWorkspaceTerminal(connection *websocket.Conn, root string, shutdown <-chan struct{}) {
	shell := os.Getenv("SHELL")
	if !filepath.IsAbs(shell) {
		shell = "/bin/sh"
	}
	command := exec.Command(shell, "-l")
	command.Dir = root
	for _, variable := range os.Environ() {
		if !strings.HasPrefix(variable, "TERM=") && !strings.HasPrefix(variable, "COLORTERM=") {
			command.Env = append(command.Env, variable)
		}
	}
	command.Env = append(command.Env, "TERM=xterm-256color", "COLORTERM=truecolor")
	terminal, err := pty.StartWithSize(command, &pty.Winsize{Rows: 24, Cols: 100})
	if err != nil {
		_ = connection.WriteMessage(websocket.BinaryMessage, []byte("\r\nCould not start terminal: "+err.Error()+"\r\n"))
		return
	}
	var closeOnce sync.Once
	stop := func() {
		closeOnce.Do(func() {
			_ = syscall.Kill(-command.Process.Pid, syscall.SIGKILL)
			_ = terminal.Close()
			_ = connection.Close()
		})
	}
	defer stop()
	finished := make(chan struct{})
	defer close(finished)
	go func() {
		select {
		case <-shutdown:
			stop()
		case <-finished:
		}
	}()
	processExited := make(chan struct{})
	go func() {
		_ = command.Wait()
		_ = terminal.Close()
		close(processExited)
	}()
	defer func() { stop(); <-processExited }()
	connection.SetReadLimit(65536)
	go func() {
		defer stop()
		for {
			_, data, err := connection.ReadMessage()
			if err != nil {
				return
			}
			var input terminalInput
			if json.Unmarshal(data, &input) != nil {
				return
			}
			switch input.Type {
			case "input":
				if _, err := terminal.Write([]byte(input.Data)); err != nil {
					return
				}
			case "resize":
				if input.Cols > 0 && input.Rows > 0 && input.Cols <= 1000 && input.Rows <= 1000 {
					_ = pty.Setsize(terminal, &pty.Winsize{Rows: input.Rows, Cols: input.Cols})
				}
			}
		}
	}()
	buffer := make([]byte, 16384)
	for {
		count, readErr := terminal.Read(buffer)
		if count > 0 {
			_ = connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if connection.WriteMessage(websocket.BinaryMessage, buffer[:count]) != nil {
				return
			}
		}
		if readErr != nil {
			_ = connection.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Shell exited"), time.Now().Add(time.Second))
			return
		}
	}
}
