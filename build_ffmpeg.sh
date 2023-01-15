#!/bin/bash

ROOT=$PWD
EMSDK_ROOT=$ROOT/emsdk
FFMPEG=$ROOT/FFmpeg
LLVM_RANLIB=$EMSDK_ROOT/upstream/bin/llvm-ranlib
LLVM_NM=$EMSDK_ROOT/upstream/bin/llvm-nm


# activate emcc
source $EMSDK_ROOT/emsdk_env.sh


# configure FFmpeg with Emscripten
CFLAGS="" #"-s USE_PTHREADS"
# CFLAGS="$CFLAGS -O3"
LDFLAGS="$CFLAGS -s INITIAL_MEMORY=33554432" # 33554432 bytes = 32 MB
CONFIG_ARGS=(
  --target-os=none        # use none to prevent any os specific configurations
  --arch=x86_32           # use x86_32 to achieve minimal architectural optimization
  --enable-cross-compile  # enable cross compile
  --disable-x86asm        # disable x86 asm
  --disable-inline-asm    # disable inline asm
  --disable-stripping     # disable stripping
  --disable-programs
  --disable-avdevice
  --disable-ffplay
  --disable-ffprobe
  --disable-network
  --disable-sdl2
  --disable-doc
  --extra-cflags="$CFLAGS"
  --extra-cxxflags="$CFLAGS"
  --extra-ldflags="$LDFLAGS"
  --nm="$LLVM_NM -g"
  --ar=emar
  --as=llvm-as
  --ranlib=$LLVM_RANLIB
  --cc=emcc
  --cxx=em++
  --objcc=emcc
  --dep-cc=emcc
)
# build FFmpeg library
cd $FFMPEG
emconfigure ./configure "${CONFIG_ARGS[@]}"
emmake make -j4