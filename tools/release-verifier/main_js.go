//go:build js && wasm

package main

import (
	"encoding/json"
	"syscall/js"
)

func main() {
	fn := js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 || args[0].Type() != js.TypeString {
			return `{"ok":false,"error":"invalid verification input"}`
		}
		data, _ := json.Marshal(verifyRequest(args[0].String()))
		return string(data)
	})
	js.Global().Set("DreamReleaseAttestationVerify", fn)
	select {}
}
