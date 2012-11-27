#! /bin/bash
# requires inotify-tools: sudo apt-get install inotify-tools

# Kill testacular when this script exits
trap 'kill $(jobs -p)' EXIT

testacular start &

while :; do
  ./build.sh
  echo "Compile done."
  echo ""

  kqwait ./app/src/*.ts ./app/lib/*.ts ./app/lib/*.js
done
