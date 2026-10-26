//go:build !windows && !js
// +build !windows,!js

package in_toto

import "golang.org/x/sys/unix"

func isWritable(path string) error {
	err := unix.Access(path, unix.W_OK)
	if err != nil {
		return err
	}
	return nil
}
