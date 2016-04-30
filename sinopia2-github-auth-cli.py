#!bin/env python
from subprocess import check_output
import json, time, sys
import requests
from urlparse import urlparse

registry = check_output(["npm", "config", "get", "registry"])
useDefaultRegistry = registry.find('registry.npmjs.org') > 0
if useDefaultRegistry:
    print("You are using default npm registry. Please update your registry.")
    print("Command: npm config set registry <url>")
    sys.exit(1)

print("Your sinopia registry is " + registry)

endpoint = registry + "/oauth/authorize"
response = requests.get(endpoint, verify=False)

parsedRegistryUrl = urlparse(registry)
token = "asdasdas"
registryHost = "//" + parsedRegistryUrl["netloc"] + "" + parsedRegistryUrl["path"]
check_output(["npm", "config", "set", registryHost, ":", "_authToken ", token])
check_output(["npm", "config", "set", registryHost, ":", "always-auth ", "true"])
