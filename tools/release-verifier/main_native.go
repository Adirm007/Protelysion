//go:build !js

package main

import (
	"encoding/json"
	"io"
	"os"
)

func main() {
	data, _ := io.ReadAll(io.LimitReader(os.Stdin, 1024*1024+1))
	json.NewEncoder(os.Stdout).Encode(verifyRequest(string(data)))
}
