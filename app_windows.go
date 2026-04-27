//go:build windows

package main

import "os"

// executablePath returns the absolute path to the running executable.
func executablePath() (string, error) {
	return os.Executable()
}

// serviceSupported returns true on Windows.
func serviceSupported() bool {
	return true
}
