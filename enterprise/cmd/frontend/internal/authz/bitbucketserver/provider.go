// Package bitbucketserver contains an authorization provider for Bitbucket Server.
package bitbucketserver

import (
	"context"
	"fmt"
	"net/url"
	"strconv"

	"github.com/pkg/errors"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/auth/providers"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/authz"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/types"
	"github.com/sourcegraph/sourcegraph/pkg/api"
	"github.com/sourcegraph/sourcegraph/pkg/extsvc"
	"github.com/sourcegraph/sourcegraph/pkg/extsvc/bitbucketserver"
	"github.com/sourcegraph/sourcegraph/pkg/extsvc/gitlab"
	log15 "gopkg.in/inconshreveable/log15.v2"
)

type pcache interface {
	Get(key string) ([]byte, bool)
	Set(key string, b []byte)
	Delete(key string)
}

// Provider is an implementation of AuthzProvider that provides repository permissions as
// determined from a Bitbucket Server instance API.
type Provider struct {
	client   *bitbucketserver.Client
	codeHost *extsvc.CodeHost
	// cache    pcache
	// cacheTTL time.Duration
}

var _ authz.Provider = ((*Provider)(nil))

// TODO(tsenart): Inject cache
func NewProvider(cli *bitbucketserver.Client) *Provider {
	p := &Provider{
		client:   cli,
		codeHost: extsvc.NewCodeHost(cli.URL, bitbucketserver.ServiceType),
	}
	// if p.cache == nil {
	// 	p.cache = rcache.NewWithTTL(fmt.Sprintf("gitlabAuthz:%s", op.BaseURL.String()), int(math.Ceil(op.CacheTTL.Seconds())))
	// }
	return p
}

func (p *Provider) Validate() (problems []string) {
	// TODO(tsenart): Validate that the access token has the right permissions with the API
	return nil
}

func (p *Provider) ServiceID() string {
	return p.codeHost.ServiceID
}

func (p *Provider) ServiceType() string {
	return p.codeHost.ServiceType
}

func (p *Provider) Repos(ctx context.Context, repos map[authz.Repo]struct{}) (mine map[authz.Repo]struct{}, others map[authz.Repo]struct{}) {
	return authz.GetCodeHostRepos(p.codeHost, repos)
}

func (p *Provider) RepoPerms(ctx context.Context, account *extsvc.ExternalAccount, repos map[authz.Repo]struct{}) (map[api.RepoName]map[authz.Perm]bool, error) {
	perms := map[api.RepoName]map[authz.Perm]bool{}

	remaining, _ := p.Repos(ctx, repos)
	nextRemaining := map[authz.Repo]struct{}{}

	// Populate perms using cached repository visibility information. After this block,
	// nextRemaining records the repositories that we still have to check.
	//for repo := range remaining {
	//	projID, err := strconv.Atoi(repo.ExternalRepoSpec.ID)
	//	if err != nil {
	//		return nil, errors.Wrap(err, "Bitbucket Server repo external ID did not parse to int")
	//	}
	//	vis, exists := cacheGetRepoVisibility(p.cache, projID, p.cacheTTL)
	//	if !exists {
	//		nextRemaining[repo] = struct{}{}
	//		continue
	//	}
	//	if v := vis.Visibility; v == gitlab.Public || (v == gitlab.Internal && accountID != "") {
	//		perms[repo.RepoName] = map[authz.Perm]bool{authz.Read: true}
	//		continue
	//	}
	//	nextRemaining[repo] = struct{}{}
	//}

	//if len(nextRemaining) == 0 { // shortcut
	//	return perms, nil
	//}

	//// Populate perms using cached user-can-access-repository information. After this block,
	//// nextRemaining records the repositories that we still have to check.
	//if accountID != "" {
	//	remaining, nextRemaining = nextRemaining, map[authz.Repo]struct{}{}
	//	for repo := range remaining {
	//		projID, err := strconv.Atoi(repo.ExternalRepoSpec.ID)
	//		if err != nil {
	//			return nil, errors.Wrap(err, "Bitbucket Server repo external ID did not parse to int")
	//		}
	//		userRepo, exists := cacheGetUserRepo(p.cache, accountID, projID, p.cacheTTL)
	//		if !exists {
	//			nextRemaining[repo] = struct{}{}
	//			continue
	//		}
	//		perms[repo.RepoName] = map[authz.Perm]bool{authz.Read: userRepo.Read}
	//	}

	//	if len(nextRemaining) == 0 { // shortcut
	//		return perms, nil
	//	}
	//}

	// Populate perms for the remaining repos (nextRemaining) by fetching directly from the Bitbucket Server
	// API (and update the user repo-visibility and user-can-access-repo permissions, as well)
	for repo := range remaining {
		projID, err := strconv.Atoi(repo.ExternalRepoSpec.ID)
		if err != nil {
			return nil, errors.Wrap(err, "Bitbucket Server repo external ID did not parse to int")
		}
		isAccessible, vis, isContentAccessible, err := p.fetchProjVis(ctx, sudo, projID)
		if err != nil {
			log15.Error("Failed to fetch visibility for Bitbucket Server project", "projectID", projID, "gitlabHost", p.codeHost.BaseURL().String(), "error", err)
			continue
		}
		if isAccessible {
			// Set perms
			perms[repo.RepoName] = map[authz.Perm]bool{authz.Read: true}

			// Update visibility cache
			err := cacheSetRepoVisibility(p.cache, projID, repoVisibilityCacheVal{Visibility: vis, TTL: p.cacheTTL})
			if err != nil {
				return nil, errors.Wrap(err, "could not set cached repo visibility")
			}

			// Update userRepo cache if the visibility is private
			if vis == gitlab.Private {
				err := cacheSetUserRepo(p.cache, accountID, projID, userRepoCacheVal{Read: isContentAccessible, TTL: p.cacheTTL})
				if err != nil {
					return nil, errors.Wrap(err, "could not set cached user repo")
				}
			}
		} else if accountID != "" {
			// A repo is private if it is not accessible to an authenticated user
			err := cacheSetRepoVisibility(p.cache, projID, repoVisibilityCacheVal{Visibility: gitlab.Private, TTL: p.cacheTTL})
			if err != nil {
				return nil, errors.Wrap(err, "could not set cached repo visibility")
			}
			err = cacheSetUserRepo(p.cache, accountID, projID, userRepoCacheVal{Read: false, TTL: p.cacheTTL})
			if err != nil {
				return nil, errors.Wrap(err, "could not set cached user repo")
			}
		}
	}
	return perms, nil
}

type repoPerms struct {
	username string
	repo     *bitbucketserver.Repo
}

func (p *Provider) fetchRepoPerms(ctx context.Context, username string, repoID int) (*repoPerms, error) {
	return nil, nil
}

// FetchAccount satisfies the authz.Provider interface. It iterates through the current list of
// linked external accounts, find the one (if it exists) that matches the authn provider specified
// in the Provider struct, and fetches the user account from the Bitbucket Server API using that identity.
func (p *Provider) FetchAccount(ctx context.Context, user *types.User, current []*extsvc.ExternalAccount) (mine *extsvc.ExternalAccount, err error) {
	if user == nil {
		return nil, nil
	}

	var glUser *gitlab.User
	if p.useNativeUsername {
		glUser, err = p.fetchAccountByUsername(ctx, user.Username)
	} else {
		// resolve the Bitbucket Server account using the authn provider (specified by p.AuthnConfigID)
		authnProvider := getProviderByConfigID(p.authnConfigID)
		if authnProvider == nil {
			return nil, nil
		}
		var authnAcct *extsvc.ExternalAccount
		for _, acct := range current {
			if acct.ServiceID == authnProvider.CachedInfo().ServiceID && acct.ServiceType == authnProvider.ConfigID().Type {
				authnAcct = acct
				break
			}
		}
		if authnAcct == nil {
			return nil, nil
		}
		glUser, err = p.fetchAccountByExternalUID(ctx, authnAcct.AccountID)
	}
	if err != nil {
		return nil, err
	}
	if glUser == nil {
		return nil, nil
	}

	var accountData extsvc.ExternalAccountData
	gitlab.SetExternalAccountData(&accountData, glUser, nil)

	glExternalAccount := extsvc.ExternalAccount{
		UserID: user.ID,
		ExternalAccountSpec: extsvc.ExternalAccountSpec{
			ServiceType: p.codeHost.ServiceType(),
			ServiceID:   p.codeHost.ServiceID(),
			AccountID:   strconv.Itoa(int(glUser.ID)),
		},
		ExternalAccountData: accountData,
	}
	return &glExternalAccount, nil
}

func (p *Provider) fetchAccountByExternalUID(ctx context.Context, uid string) (*gitlab.User, error) {
	q := make(url.Values)
	q.Add("extern_uid", uid)
	q.Add("provider", p.gitlabProvider)
	q.Add("per_page", "2")
	glUsers, _, err := p.clientProvider.GetPATClient(p.sudoToken, "").ListUsers(ctx, "users?"+q.Encode())
	if err != nil {
		return nil, err
	}
	if len(glUsers) >= 2 {
		return nil, fmt.Errorf("failed to determine unique Bitbucket Server user for query %q", q.Encode())
	}
	if len(glUsers) == 0 {
		return nil, nil
	}
	return glUsers[0], nil
}

func (p *Provider) fetchAccountByUsername(ctx context.Context, username string) (*gitlab.User, error) {
	q := make(url.Values)
	q.Add("username", username)
	q.Add("per_page", "2")
	glUsers, _, err := p.clientProvider.GetPATClient(p.sudoToken, "").ListUsers(ctx, "users?"+q.Encode())
	if err != nil {
		return nil, err
	}
	if len(glUsers) >= 2 {
		return nil, fmt.Errorf("failed to determine unique Bitbucket Server user for query %q", q.Encode())
	}
	if len(glUsers) == 0 {
		return nil, nil
	}
	return glUsers[0], nil
}

var getProviderByConfigID = providers.GetProviderByConfigID
