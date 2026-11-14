package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"px0/internal/settings"
)

func (s *Server) handleLineAttribution(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	_, path, ok := s.safePath(r.URL.Query().Get("path"))
	line, err := strconv.Atoi(r.URL.Query().Get("line"))
	if !ok || path == "" || err != nil || line < 1 {
		fail(w, http.StatusBadRequest, "invalid file or line")
		return
	}
	root := s.ix.Root()
	if !gitAvailable(root) {
		writeJSON(w, lineAttribution{})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	args := []string{"-C", root, "blame", "--line-porcelain", "-L", fmt.Sprintf("%d,%d", line, line)}
	if ref := r.URL.Query().Get("ref"); ref != "" {
		if ref == "@diff-base" {
			ref = s.diffBase
			if ref == "" {
				ref = "HEAD"
			}
		}
		resolved, err := exec.CommandContext(ctx, "git", "-C", root, "rev-parse", "--verify", "--end-of-options", ref+"^{commit}").Output()
		if err != nil {
			writeJSON(w, lineAttribution{})
			return
		}
		args = append(args, strings.TrimSpace(string(resolved)))
	}
	args = append(args, "--", path)
	output, err := exec.CommandContext(ctx, "git", args...).Output()
	if err != nil {
		writeJSON(w, lineAttribution{})
		return
	}
	lines := strings.Split(string(output), "\n")
	header := strings.Fields(lines[0])
	if len(header) < 3 {
		writeJSON(w, lineAttribution{})
		return
	}
	result := lineAttribution{Available: true, Commit: header[0]}
	result.Local = strings.Trim(result.Commit, "0") == ""
	for _, line := range lines[1:] {
		key, value, _ := strings.Cut(line, " ")
		switch key {
		case "author":
			result.Author = value
		case "author-time":
			if seconds, err := strconv.ParseInt(value, 10, 64); err == nil {
				result.Date = time.Unix(seconds, 0).UTC().Format(time.RFC3339)
			}
		case "summary":
			result.Summary = value
		}
	}
	if result.Local {
		result.Author = "You"
		result.Summary = "Uncommitted changes"
		result.Commit = ""
		result.Date = ""
	} else {
		result.CommitURL = gitCommitWebURL(root, result.Commit)
		if r.URL.Query().Get("details") == "1" {
			result.Pulls, result.PRLookup = findLinePullRequests(ctx, root, result.Commit)
		}
	}
	writeJSON(w, result)
}

func findLinePullRequests(ctx context.Context, root, commit string) ([]map[string]any, string) {
	remotes := []string{gitRemoteURL(root, gitCurrentBranch(root))}
	if upstream, err := exec.CommandContext(ctx, "git", "-C", root, "remote", "get-url", "upstream").Output(); err == nil {
		remotes = append([]string{strings.TrimSpace(string(upstream))}, remotes...)
	}
	token, _ := resolveGitHubToken(settings.Read())
	lookup := "unavailable"
	visited := map[string]bool{}
	for _, remote := range remotes {
		host, repo, ok := remoteHostPath(remote)
		if !ok || host != "github.com" || visited[repo] {
			continue
		}
		visited[repo] = true
		parts := strings.Split(repo, "/")
		if len(parts) != 2 {
			continue
		}
		endpoint := "/repos/" + url.PathEscape(parts[0]) + "/" + url.PathEscape(parts[1]) + "/commits/" + commit + "/pulls?per_page=10"
		response, err := githubRequest(ctx, http.MethodGet, endpoint, token, nil)
		if err != nil {
			continue
		}
		var pulls []map[string]any
		decodeErr := json.NewDecoder(response.Body).Decode(&pulls)
		response.Body.Close()
		if response.StatusCode != http.StatusOK || decodeErr != nil {
			continue
		}
		lookup = "none"
		if len(pulls) > 0 {
			result := make([]map[string]any, 0, len(pulls))
			for _, pull := range pulls {
				result = append(result, map[string]any{"number": pull["number"], "title": pull["title"], "url": pull["html_url"]})
			}
			return result, "found"
		}
	}
	return nil, lookup
}
