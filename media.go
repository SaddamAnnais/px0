package main

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var mediaTypes = map[string]string{
	".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
	".mov": "video/quicktime", ".ogv": "video/ogg", ".mkv": "video/x-matroska",
	".avi": "video/x-msvideo", ".mpg": "video/mpeg", ".mpeg": "video/mpeg",
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
	".oga": "audio/ogg", ".opus": "audio/ogg", ".m4a": "audio/mp4",
	".aac": "audio/aac", ".flac": "audio/flac", ".weba": "audio/webm",
	".aif": "audio/aiff", ".aiff": "audio/aiff", ".wma": "audio/x-ms-wma",
}

func mediaType(path string) string {
	return mediaTypes[strings.ToLower(filepath.Ext(path))]
}

func (s *Server) handleMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		fail(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	abs, rel, ok := s.safePath(r.URL.Query().Get("path"))
	if !ok || mediaType(rel) == "" {
		fail(w, http.StatusBadRequest, "invalid media path")
		return
	}
	file, err := os.Open(abs)
	if err != nil {
		fail(w, http.StatusNotFound, "media file not found")
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		fail(w, http.StatusBadRequest, "not a regular file")
		return
	}
	bypassGzip(w)
	w.Header().Del("Content-Encoding")
	w.Header().Set("Content-Type", mediaType(rel))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": filepath.Base(rel)}))
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}
