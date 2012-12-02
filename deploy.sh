#! /bin/bash

rm -f app.zip
zip -r -q app.zip app/

echo "Upload app.zip"
open https://chrome.google.com/webstore/developer/edit/mnkpgnliajdfbokhlehijhofdpepfmlh
