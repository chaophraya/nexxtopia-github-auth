#!/bin/bash

REV=$(git rev-parse HEAD)
URL=$(git config --get remote.origin.url)
AUTHOR=$(git --no-pager show -s --format=%ae HEAD)

echo "{\"url\":\"git:$URL\", \"revision\":\"$REV\", \"author\":\"$AUTHOR\", \"status\":\"\"}" > ./dist/scm-source.json
