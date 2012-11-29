#! /bin/bash

rm -f app.zip
zip -r -q app.zip app/

echo "Upload app.zip to the web store."
