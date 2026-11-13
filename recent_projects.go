package main

import (
	"net/http"
	"os"
)

func (s *Server) handleProjectWorkbench(w http.ResponseWriter, r *http.Request) {
	if !trustedGet(w, r) {
		return
	}
	s.projectWorkbenchMu.Lock()
	if s.projectWorkbenchClosed {
		s.projectWorkbenchMu.Unlock()
		fail(w, http.StatusServiceUnavailable, "workspace is shutting down")
		return
	}
	if s.projectWorkbench == nil {
		executable, err := os.Executable()
		if err != nil {
			s.projectWorkbenchMu.Unlock()
			fail(w, http.StatusInternalServerError, "could not locate px0 executable")
			return
		}
		var arguments []string
		if !s.lsp.Enabled() {
			arguments = append(arguments, "-no-lsp")
		}
		if s.agent == nil {
			arguments = append(arguments, "-no-agent")
		}
		s.projectWorkbench = newWorkbench(s.routePath("/projects/"), s.ix.Root(), executable, arguments)
	}
	workbench := s.projectWorkbench
	s.projectWorkbenchMu.Unlock()
	workbench.ServeHTTP(w, r)
}

func (s *Server) CloseProjectWorkbench() {
	s.projectWorkbenchMu.Lock()
	s.projectWorkbenchClosed = true
	workbench := s.projectWorkbench
	s.projectWorkbenchMu.Unlock()
	if workbench != nil {
		workbench.Close()
	}
}
