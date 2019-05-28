import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import H from 'history'
import React, { useEffect, useState } from 'react'
import { from, Subscription, Observable } from 'rxjs'
import { catchError, map, mapTo, startWith, switchMap } from 'rxjs/operators'
import { Resizable } from '../../../../../../shared/src/components/Resizable'
import { ExtensionsControllerProps } from '../../../../../../shared/src/extensions/controller'
import { gql } from '../../../../../../shared/src/graphql/graphql'
import * as GQL from '../../../../../../shared/src/graphql/schema'
import { PlatformContextProps } from '../../../../../../shared/src/platform/context'
import { asError, createAggregateError, ErrorLike, isErrorLike } from '../../../../../../shared/src/util/errors'
import { parseRepoURI } from '../../../../../../shared/src/util/url'
import { queryGraphQL } from '../../../../backend/graphql'
import { discussionThreadTargetFieldsFragment } from '../../../../discussions/backend'
import { useEffectAsync } from '../../../../util/useEffectAsync'
import { QueryParameterProps } from '../../components/withQueryParameter/WithQueryParameter'
import { ThreadSettings } from '../../settings'
import { ThreadInboxSidebar } from './sidebar/ThreadInboxSidebar'
import { DiagnosticInfo, ThreadInboxFileItem } from './ThreadInboxFileItem'
import { memoizeObservable } from '../../../../../../shared/src/util/memoizeObservable'

// TODO!(sqs): use relative path/rev for DiscussionThreadTargetRepo
const queryInboxItems = (threadID: GQL.ID): Promise<GQL.IDiscussionThreadTargetConnection> =>
    queryGraphQL(
        gql`
            query ThreadInboxItems($threadID: ID!) {
                node(id: $threadID) {
                    __typename
                    ... on DiscussionThread {
                        targets {
                            nodes {
                                __typename
                                ...DiscussionThreadTargetFields
                            }
                            totalCount
                            pageInfo {
                                hasNextPage
                            }
                        }
                    }
                }
            }
            ${discussionThreadTargetFieldsFragment}
        `,
        { threadID }
    )
        .pipe(
            map(({ data, errors }) => {
                if (
                    !data ||
                    !data.node ||
                    data.node.__typename !== 'DiscussionThread' ||
                    !data.node.targets ||
                    !data.node.targets.nodes
                ) {
                    throw createAggregateError(errors)
                }
                return data.node.targets
            })
        )
        .toPromise()

// TODO!(sqs): use relative path/rev for DiscussionThreadTargetRepo
const queryCandidateFile = memoizeObservable(
    (uri: URL): Observable<[URL, DiagnosticInfo['entry']]> => {
        const parsed = parseRepoURI(uri.toString())
        return queryGraphQL(
            gql`
                query CandidateFile($repo: String!, $rev: String!, $path: String!) {
                    repository(name: $repo) {
                        commit(rev: $rev) {
                            blob(path: $path) {
                                path
                                content
                                repository {
                                    name
                                }
                                commit {
                                    oid
                                }
                            }
                        }
                    }
                }
            `,
            { repo: parsed.repoName, rev: parsed.rev || parsed.commitID, path: parsed.filePath }
        ).pipe(
            map(({ data, errors }) => {
                if (
                    !data ||
                    !data.repository ||
                    !data.repository.commit ||
                    !data.repository.commit.blob ||
                    (errors && errors.length > 0)
                ) {
                    throw createAggregateError(errors)
                }
                return data.repository.commit.blob
            }),
            map(data => [uri, data] as [URL, DiagnosticInfo['entry']])
        )
    },
    uri => uri.toString()
)

const queryCandidateFiles = async (uris: URL[]): Promise<[URL, DiagnosticInfo['entry']][]> =>
    Promise.all(uris.map(uri => queryCandidateFile(uri).toPromise()))

interface Props extends QueryParameterProps, ExtensionsControllerProps, PlatformContextProps {
    thread: Pick<GQL.IDiscussionThread, 'id' | 'idWithoutKind' | 'title' | 'type' | 'settings'>
    onThreadUpdate: (thread: GQL.IDiscussionThread) => void
    threadSettings: ThreadSettings

    className?: string
    history: H.History
    location: H.Location
    isLightTheme: boolean
}

const LOADING: 'loading' = 'loading'

/**
 * The list of thread inbox items.
 */
export const ThreadInboxItemsList: React.FunctionComponent<Props> = ({
    thread,
    onThreadUpdate,
    threadSettings,
    query,
    onQueryChange,
    className = '',
    extensionsController,
    ...props
}) => {
    const [, setItems0OrError] = useState<
        | typeof LOADING
        | (GQL.IDiscussionThreadTargetConnection & { matchingNodes: GQL.IDiscussionThreadTargetRepo[] })
        | ErrorLike
    >(LOADING)
    // tslint:disable-next-line: no-floating-promises
    useEffectAsync(async () => {
        try {
            const data = await queryInboxItems(thread.id)
            const isHandled = (item: GQL.IDiscussionThreadTargetRepo): boolean =>
                (threadSettings.pullRequests || []).some(pull => pull.items.includes(item.id))
            setItems0OrError({
                ...data,
                matchingNodes: data.nodes
                    .filter(
                        (item): item is GQL.IDiscussionThreadTargetRepo =>
                            item.__typename === 'DiscussionThreadTargetRepo'
                    )
                    .filter(
                        item =>
                            (query.includes('is:open') && !item.isIgnored && !isHandled(item)) ||
                            (query.includes('is:ignored') && item.isIgnored && !isHandled(item)) ||
                            (!query.includes('is:open') && !query.includes('is:ignored'))
                    )
                    .filter(item => {
                        const m = query.match(/repo:([^\s]+)/)
                        if (m && m[1]) {
                            const repo = m[1]
                            const ids = (threadSettings.pullRequests || [])
                                .filter(pull => pull.repo === repo)
                                .flatMap(pull => pull.items)
                            return ids.includes(item.id)
                        }
                        return true
                    }),
            })
        } catch (err) {
            setItems0OrError(asError(err))
        }
    }, [thread.id, threadSettings])

    const [itemsOrError, setItemsOrError] = useState<typeof LOADING | DiagnosticInfo[] | ErrorLike>(LOADING)
    // tslint:disable-next-line: no-floating-promises
    useEffect(() => {
        const subscriptions = new Subscription()
        subscriptions.add(
            from(extensionsController.services.diagnostics.collection.changes)
                .pipe(
                    mapTo(() => void 0),
                    startWith(() => void 0),
                    map(() => Array.from(extensionsController.services.diagnostics.collection.entries())),
                    switchMap(async diagEntries => {
                        const entries = await queryCandidateFiles(diagEntries.map(([url]) => url))
                        const m = new Map<string, DiagnosticInfo['entry']>()
                        for (const [url, entry] of entries) {
                            m.set(url.toString(), entry)
                        }
                        return diagEntries.flatMap(([url, diag]) => {
                            const entry = m.get(url.toString())
                            if (!entry) {
                                throw new Error(`no entry for url ${url}`)
                            }
                            // tslint:disable-next-line: no-object-literal-type-assertion
                            return diag.map(d => ({ ...d, entry } as DiagnosticInfo))
                        })
                    }),
                    catchError(err => [asError(err)]),
                    startWith(LOADING)
                )
                .subscribe(setItemsOrError)
        )
        return () => subscriptions.unsubscribe()
    }, [thread.id, extensionsController])

    return (
        <div className={`thread-inbox-items-list ${className}`}>
            {isErrorLike(itemsOrError) ? (
                <div className="alert alert-danger mt-2">{itemsOrError.message}</div>
            ) : (
                <>
                    {itemsOrError !== LOADING &&
                        !isErrorLike(itemsOrError) &&
                        /* TODO!(sqs) <WithStickyTop scrollContainerSelector=".thread-area">
                            {({ isStuck }) => (
                                <ThreadInboxItemsNavbar
                                    {...props}
                                    thread={thread}
                                    onThreadUpdate={onThreadUpdate}
                                    threadSettings={threadSettings}
                                    items={itemsOrError}
                                    query={query}
                                    onQueryChange={onQueryChange}
                                    includeThreadInfo={isStuck}
                                    className={`sticky-top position-sticky row bg-body thread-inbox-items-list__navbar py-2 px-3 ${
                                        isStuck ? 'border-bottom shadow' : ''
                                    }`}
                                    extensionsController={extensionsController}
                                />
                            )}
                                </WithStickyTop>*/ ''}
                    {itemsOrError === LOADING ? (
                        <LoadingSpinner className="mt-2" />
                    ) : itemsOrError.length === 0 ? (
                        <p className="p-2 mb-0 text-muted">Inbox is empty.</p>
                    ) : (
                        <div className="d-flex">
                            <Resizable
                                className="sticky-top border-right d-none"
                                handlePosition="right"
                                storageKey="thread-inbox-items-list__sidebar-resizable"
                                defaultSize={216 /* px */}
                                element={
                                    <ThreadInboxSidebar
                                        diagnostics={itemsOrError}
                                        query={query}
                                        onQueryChange={onQueryChange}
                                        className="flex-1"
                                    />
                                }
                                style={{
                                    minWidth: '8rem',
                                    maxWidth: '75vh',
                                    height: 'calc(100vh - 83.5px)', // 83.5px = 39px + 44.5px(GlobalNavbar)
                                    top: '39px', // TODO!(sqs): this is the hardcoded height of ThreadAreaNavbar
                                }}
                            />
                            <ul className="list-unstyled mb-0 flex-1" style={{ minWidth: '0' }}>
                                {itemsOrError.map((diagnostic, i) => (
                                    <li key={i}>
                                        <ThreadInboxFileItem
                                            {...props}
                                            key={i}
                                            thread={thread}
                                            threadSettings={threadSettings}
                                            diagnostic={diagnostic}
                                            onThreadUpdate={onThreadUpdate}
                                            className="m-2"
                                            headerClassName="thread-inbox-items-list__item-header sticky-top"
                                            headerStyle={{
                                                // TODO!(sqs): this is the hardcoded height of ThreadAreaNavbar
                                                top: '39px',
                                            }}
                                            extensionsController={extensionsController}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
