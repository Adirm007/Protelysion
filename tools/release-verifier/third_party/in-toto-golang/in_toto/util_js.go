//go:build js

package in_toto

import "errors"

func isWritable(path string) error { return errors.New("filesystem writes unavailable in browser") }
