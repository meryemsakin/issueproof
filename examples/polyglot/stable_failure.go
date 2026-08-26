package main

import (
	"fmt"
	"os"
	"time"
)

func main() {
	fmt.Fprintf(os.Stderr, "[%s] Error: checkout total mismatch\n", time.Now().UTC().Format(time.RFC3339Nano))
	fmt.Fprintf(os.Stderr, "pid=%d\n", os.Getpid())
	os.Exit(1)
}
