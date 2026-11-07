# Cube model management service

The user explicitly authorized this Express backend. Keep frontend workspace behavior separate.

- Management endpoints require a server-configured management key. Never put it in a VITE_ environment variable or persist it in browser storage.
- Only write structured, validated model definitions inside the configured real model directory. Never accept filesystem paths, raw YAML or command strings from requests.
- Model creation must not overwrite existing models. Keep exclusive and atomic file creation; refuse duplicate cube names.
- Never mount the Docker socket, execute shell commands, or claim a model is active merely because a file was saved.
- Cube metadata verification confirms model visibility, not SQL correctness or successful data queries.
- Use temporary directories and fake Cube metadata in automated tests; never modify the actual user's Cube volume during tests.
- The service defaults to loopback. Production deployment requires a protected management network and HTTPS reverse proxy; do not expose the development management key as user authentication.
