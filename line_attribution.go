package main

type lineAttribution struct {
	Available bool             `json:"available"`
	Author    string           `json:"author,omitempty"`
	Date      string           `json:"date,omitempty"`
	Summary   string           `json:"summary,omitempty"`
	Commit    string           `json:"commit,omitempty"`
	CommitURL string           `json:"commitUrl,omitempty"`
	Local     bool             `json:"local"`
	Pulls     []map[string]any `json:"pulls,omitempty"`
	PRLookup  string           `json:"prLookup,omitempty"`
}
