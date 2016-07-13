package rcache

import (
	"fmt"
	"os"
	"sync"

	"sourcegraph.com/sourcegraph/sourcegraph/pkg/conf"

	"github.com/mediocregopher/radix.v2/pool"
	"github.com/mediocregopher/radix.v2/redis"
)

const (
	maxClients = 32

	// dataVersion is used for releases that change type struture for
	// data that may already be cached. Increasing this number will
	// change the key prefix that is used for all hash keys,
	// effectively resetting the cache at the same time the new code
	// is deployed.
	dataVersion = "v1"
)

// Cache implements httpcache.Cache
type Cache struct {
	keyPrefix  string
	ttlSeconds int
}

// New creates a redis backed Cache
func New(keyPrefix string, ttlSeconds int) *Cache {
	return &Cache{
		keyPrefix:  keyPrefix,
		ttlSeconds: ttlSeconds,
	}
}

// Get implements httpcache.Cache.Get
func (r *Cache) Get(key string) ([]byte, bool) {
	resp, err := cmd("GET", r.rkey(key))
	if err != nil || resp.IsType(redis.Nil) {
		return nil, false
	}

	b, err := resp.Bytes()
	if err != nil {
		return nil, false
	}
	return b, true
}

// Delete implements httpcache.Cache.Set
func (r *Cache) Set(key string, b []byte) {
	_, _ = cmd("SETEX", r.rkey(key), r.ttlSeconds, b)
}

// Delete implements httpcache.Cache.Delete
func (r *Cache) Delete(key string) {
	_, _ = cmd("DEL", r.rkey(key))
}

// rkey generates the actual key we use on redis.
func (r *Cache) rkey(key string) string {
	return fmt.Sprintf("%s:%s:%s", globalPrefix, r.keyPrefix, key)
}

// ClearAllForTest clears all of the entries with a given prefix. This
// is an O(n) operation and should only be used in tests.
func ClearAllForTest(prefix string) error {
	_, err := cmd("EVAL", `local keys = redis.call('keys', ARGV[1])
if #keys > 0 then
	return redis.call('del', unpack(keys))
else
	return ''
end`, 0, fmt.Sprintf("%s:*", fmt.Sprintf("%s:%s", globalPrefix, prefix)))
	if err != nil {
		return fmt.Errorf("error clearing Redis test data: %s", err)
	}
	return nil
}

var (
	connPool_    *pool.Pool
	connPoolMu   sync.Mutex
	globalPrefix string
)

// redisPool creates the Redis connection pool if it isn't already
// open and returns it. Subsequent calls return the same pool.
func redisPool() (*pool.Pool, error) {
	connPoolMu.Lock()
	defer connPoolMu.Unlock()

	if connPool_ != nil {
		return connPool_, nil
	}

	hostname := os.Getenv("SRC_APP_URL")
	if hostname == "" {
		hostname, _ = os.Hostname()
	}
	globalPrefix = fmt.Sprintf("%s:%s", hostname, dataVersion)

	endpoint := conf.GetenvOrDefault("REDIS_MASTER_ENDPOINT", ":6379")

	p, err := pool.New("tcp", endpoint, maxClients)
	if err != nil {
		return nil, fmt.Errorf("Could not connect to Redis server at %s: %s", endpoint, err)
	}
	connPool_ = p

	return connPool_, nil
}

// cmd is a helper around redis.(*Client).Cmd. As a convenience it returns
// Resp.Err as err if we get a response. This reduces the number of error
// checks needed.
func cmd(cmd string, args ...interface{}) (*redis.Resp, error) {
	connPool, err := redisPool()
	if err != nil {
		return nil, err
	}
	conn, err := connPool.Get()
	if err != nil {
		return nil, err
	}
	defer connPool.Put(conn)

	resp := conn.Cmd(cmd, args...)
	return resp, resp.Err
}
