BINARY  := NunuDNS
VERSION := 1.0.0

.PHONY: build build-windows tidy test clean dev

## build: build GUI app for the current platform (requires wails CLI)
build:
	wails build -ldflags "-s -w"

## build-windows: build GUI binary for Windows amd64
build-windows:
	wails build -platform windows/amd64 -ldflags "-s -w"

## dev: start Wails dev server with hot-reload
dev:
	wails dev

## tidy: tidy and verify Go modules
tidy:
	go mod tidy
	go mod verify

## test: run unit tests
test:
	go test ./...

## clean: remove build artifacts
clean:
	rm -rf build/bin
