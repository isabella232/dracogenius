#! /bin/bash
# requires inotify-tools: sudo apt-get install inotify-tools
./build.sh

while :; do
  kqwait ./app/src/* ./app/lib/*
  ./build.sh
done
