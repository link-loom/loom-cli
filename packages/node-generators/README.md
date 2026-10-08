# @link-loom/node-generators

Backend generators for the Link Loom CLI.

- `service` (`link-loom create service`): a Link Loom backend service, monolith or microservice.

Until this collection ships its own layers, `service` starts from `link-loom/loom-svc-js` at the requested ref and
replaces its `%LOOM%` placeholders (three known places). If the template moves its placeholders, the result is
reported as a warning instead of guessing.

## License

The generators are [Apache-2.0](LICENSE). The files they write into a project belong to that project: use,
change and license them under any terms, with no attribution required.
