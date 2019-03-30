// Code generated by stringdata. DO NOT EDIT.

package schema

// GitHubSchemaJSON is the content of the file "github.schema.json".
const GitHubSchemaJSON = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "github.schema.json#",
  "title": "GitHubConnection",
  "description": "Configuration for a connection to GitHub or GitHub Enterprise.",
  "type": "object",
  "additionalProperties": false,
  "required": ["url", "token"],
  "properties": {
    "url": {
      "description": "URL of a GitHub instance, such as https://github.com or https://github-enterprise.example.com.",
      "type": "string",
      "not": {
        "type": "string",
        "pattern": "example\\.com"
      },
      "pattern": "^https?://",
      "format": "uri",
      "examples": ["https://github.com", "https://github-enterprise.example.com"]
    },
    "gitURLType": {
      "description": "The type of Git URLs to use for cloning and fetching Git repositories on this GitHub instance.\n\nIf \"http\", Sourcegraph will access GitLab repositories using Git URLs of the form http(s)://github.com/myteam/myproject.git (using https: if the GitHub instance uses HTTPS).\n\nIf \"ssh\", Sourcegraph will access GitHub repositories using Git URLs of the form git@github.com:myteam/myproject.git. See the documentation for how to provide SSH private keys and known_hosts: https://docs.sourcegraph.com/admin/repo/auth#repositories-that-need-http-s-or-ssh-authentication.",
      "type": "string",
      "enum": ["http", "ssh"],
      "default": "http"
    },
    "token": {
      "description": "A GitHub personal access token. Create one for GitHub.com at https://github.com/settings/tokens/new?scopes=repo&description=Sourcegraph (for GitHub Enterprise, replace github.com with your instance's hostname). The \"repo\" scope is required to mirror private repositories. If using only public repositories, you can create the token with no scopes.",
      "type": "string",
      "minLength": 1
    },
    "certificate": {
      "description": "TLS certificate of the GitHub Enterprise instance. This is only necessary if the certificate is self-signed or signed by an internal CA. To get the certificate run ` + "`" + `openssl s_client -connect HOST:443 -showcerts < /dev/null 2> /dev/null | openssl x509 -outform PEM` + "`" + `",
      "type": "string",
      "pattern": "^-----BEGIN CERTIFICATE-----\n",
      "examples": ["-----BEGIN CERTIFICATE-----\n..."]
    },
    "repos": {
      "description": "An array of repository \"owner/name\" strings specifying which GitHub or GitHub Enterprise repositories to mirror on Sourcegraph.",
      "type": "array",
      "items": { "type": "string", "pattern": "^[\\w-]+/[\\w.-]+$" }
    },
    "exclude": {
      "description": "A list of repositories to never mirror from this GitHub instance. Takes precedence over \"repos\" and \"repositoryQuery\" configuration.",
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "title": "ExcludedGitHubRepo",
        "additionalProperties": false,
        "anyOf": [{ "required": ["name"] }, { "required": ["id"] }],
        "properties": {
          "name": {
            "description": "The name of a GitHub repository (\"owner/name\") to exclude from mirroring.",
            "type": "string",
            "pattern": "^[\\w-]+/[\\w.-]+$"
          },
          "id": {
            "description": "The ID of a GitHub repository (as returned by the GitHub instance's API) to exclude from mirroring.",
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "repositoryQuery": {
      "description": "An array of strings specifying which GitHub or GitHub Enterprise repositories to mirror on Sourcegraph. The valid values are:\n\n- ` + "`" + `public` + "`" + ` mirrors all public repositories for GitHub Enterprise and is the equivalent of ` + "`" + `none` + "`" + ` for GitHub\n\n- ` + "`" + `affiliated` + "`" + ` mirrors all repositories affiliated with the configured token's user:\n\t- Private repositories with read access\n\t- Public repositories owned by the user or their orgs\n\t- Public repositories with write access\n\n- ` + "`" + `none` + "`" + ` mirrors no repositories (except those specified in the ` + "`" + `repos` + "`" + ` configuration property or added manually)\n\n- All other values are executed as a GitHub advanced repository search as described at https://github.com/search/advanced. Example: to sync all repositories from the \"sourcegraph\" organization including forks the query would be \"org:sourcegraph fork:true\".\n\nIf multiple values are provided, their results are unioned.\n\nIf you need to narrow the set of mirrored repositories further (and don't want to enumerate it with a list or query set as above), create a new bot/machine user on GitHub or GitHub Enterprise that is only affiliated with the desired repositories.",
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "default": ["none"],
      "minItems": 1
    },
    "repositoryPathPattern": {
      "description": "The pattern used to generate the corresponding Sourcegraph repository name for a GitHub or GitHub Enterprise repository. In the pattern, the variable \"{host}\" is replaced with the GitHub host (such as github.example.com), and \"{nameWithOwner}\" is replaced with the GitHub repository's \"owner/path\" (such as \"myorg/myrepo\").\n\nFor example, if your GitHub Enterprise URL is https://github.example.com and your Sourcegraph URL is https://src.example.com, then a repositoryPathPattern of \"{host}/{nameWithOwner}\" would mean that a GitHub repository at https://github.example.com/myorg/myrepo is available on Sourcegraph at https://src.example.com/github.example.com/myorg/myrepo.\n\nIt is important that the Sourcegraph repository name generated with this pattern be unique to this code host. If different code hosts generate repository names that collide, Sourcegraph's behavior is undefined.",
      "type": "string",
      "default": "{host}/{nameWithOwner}"
    },
    "initialRepositoryEnablement": {
      "description": "Deprecated and ignored field which will be removed entirely in the next release. GitHub repositories can no longer be enabled or disabled explicitly. Configure repositories to be mirrored via \"repos\", \"exclude\" and \"repositoryQuery\" instead.",
      "type": "boolean"
    },
    "authorization": {
      "title": "GitHubAuthorization",
      "description": "If non-null, enforces GitHub repository permissions. This requires that there is an item in the ` + "`" + `auth.providers` + "`" + ` field of type \"github\" with the same ` + "`" + `url` + "`" + ` field as specified in this ` + "`" + `GitHubConnection` + "`" + `.",
      "type": "object",
      "properties": {
        "ttl": {
          "description": "The TTL of how long to cache permissions data. This is 3 hours by default.\n\nDecreasing the TTL will increase the load on the code host API. If you have X repositories on your instance, it will take ~X/100 API requests to fetch the complete list for 1 user.  If you have Y users, you will incur X*Y/100 API requests per cache refresh period.\n\nIf set to zero, Sourcegraph will sync a user's entire accessible repository list on every request (NOT recommended).",
          "type": "string",
          "default": "3h"
        }
      }
    }
  }
}
`
