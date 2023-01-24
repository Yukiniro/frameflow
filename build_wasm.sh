#!/bin/bash

ROOT=$PWD
EMSDK_ROOT=$ROOT/emsdk
FFMPEG=$ROOT/FFmpeg

# activate emcc
source $EMSDK_ROOT/emsdk_env.sh

# verify Emscripten version
emcc -v


NAME="ffmpeg_built"
WASM_DIR="./src/wasm"

# build ffmpeg.wasm (FFmpeg library + src/cpp/*)
mkdir -p $WASM_DIR
ARGS=(
  -Isrc/cpp -I$FFMPEG src/cpp/*.cpp
  -L$FFMPEG/libavcodec -L$FFMPEG/libavfilter -L$FFMPEG/libavformat -L$FFMPEG/libavutil -L$FFMPEG/libswresample -L$FFMPEG/libswscale
  -lavfilter -lavformat -lavcodec -lavutil -lswresample -lswscale
  -Qunused-arguments
  -lembind
  -o $WASM_DIR/$NAME.js

  # all settings can be see at: https://github.com/emscripten-core/emscripten/blob/main/src/settings.js
  -s INITIAL_MEMORY=33554432      # 33554432 bytes = 32 MB
  -s MODULARIZE=1
  -s EXPORT_ES6=1
  -s EXPORT_NAME=$NAME
  -s FILESYSTEM=0
  -s WASM_BIGINT=1 # need platform support JS BigInt
  -s ENVIRONMENT='web,worker' # node?
  
  -s ASYNCIFY # need -O3 when enable asyncify
  -O3
)

em++ "${ARGS[@]}"

# copy *.d.ts to enable typescript
TYPE_WASM=src/ts/types/ffmpeg.d.ts
echo "copy $TYPE_WASM to $WASM_DIR/$NAME.d.ts"
cp $TYPE_WASM $WASM_DIR/$NAME.d.ts