#! /bin/bash
# requires inotify-tools: sudo apt-get install inotify-tools

testacular start --no-auto-watch &

while :; do
  echo ""
  echo ""
  echo ""

  ./build.sh && curl -s http://localhost:9100/ >/dev/null # tells testacular to run tests


  kqwait ./app/src/*.ts ./app/lib/*.ts ./app/lib/*.js ./test/*.ts
done
