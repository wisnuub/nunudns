package main

import (
	"embed"

	"github.com/wisnuub/nunudns/internal/config"
	"github.com/wisnuub/nunudns/internal/logstream"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	model, _ := config.NewModel("config.toml")
	stream := logstream.NewStream()
	app := NewApp(model, stream, "config.toml")

	err := wails.Run(&options.App{
		Title:            "NunuDNS",
		Width:            1100,
		Height:           700,
		MinWidth:         800,
		MinHeight:        500,
		Frameless:        true,
		BackgroundColour: &options.RGBA{R: 13, G: 15, B: 20, A: 255},
		AssetServer:      &assetserver.Options{Assets: assets},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind:             []interface{}{app},
		Windows: &windows.Options{
			WebviewIsTransparent:  false,
			WindowIsTranslucent:   false,
			DisableWindowIcon:     false,
			IsZoomControlEnabled:  false,
			EnableSwipeGestures:   false,
		},
	})
	if err != nil {
		panic(err)
	}
}
