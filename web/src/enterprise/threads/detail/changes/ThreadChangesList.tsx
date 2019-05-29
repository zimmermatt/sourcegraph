import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import { flatten } from 'lodash'
import H from 'history'
import React, { useEffect, useState } from 'react'
import { from, Observable, Subscription, combineLatest } from 'rxjs'
import { catchError, map, mapTo, startWith, switchMap } from 'rxjs/operators'
import { Resizable } from '../../../../../../shared/src/components/Resizable'
import { ExtensionsControllerProps } from '../../../../../../shared/src/extensions/controller'
import { gql } from '../../../../../../shared/src/graphql/graphql'
import * as GQL from '../../../../../../shared/src/graphql/schema'
import { PlatformContextProps } from '../../../../../../shared/src/platform/context'
import { asError, createAggregateError, ErrorLike, isErrorLike } from '../../../../../../shared/src/util/errors'
import { QueryParameterProps } from '../../components/withQueryParameter/WithQueryParameter'
import { ThreadSettings } from '../../settings'
import { getCodeActions, getDiagnosticInfos, queryCandidateFiles, getActiveCodeAction } from '../backend'
import { ThreadChangedFileItem } from './item/ThreadChangedFileItem'
import { ThreadInboxSidebar } from './sidebar/ThreadChangesSidebar'
import { computeDiff, FileDiff } from './computeDiff'
import { isDefined } from '../../../../../../shared/src/util/types'

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
 * The list of thread changes.
 */
export const ThreadChangesList: React.FunctionComponent<Props> = ({
    thread,
    onThreadUpdate,
    threadSettings,
    query,
    onQueryChange,
    className = '',
    extensionsController,
    ...props
}) => {
    const [fileDiffsOrError, setFileDiffsOrError] = useState<typeof LOADING | FileDiff[] | ErrorLike>(LOADING)
    // tslint:disable-next-line: no-floating-promises
    useEffect(() => {
        const subscriptions = new Subscription()
        subscriptions.add(
            getDiagnosticInfos(extensionsController)
                .pipe(
                    switchMap(diagnostics =>
                        combineLatest(
                            diagnostics.map(d => getActiveCodeAction(d, extensionsController, threadSettings))
                        )
                    ),
                    switchMap(codeActions => computeDiff(extensionsController, codeActions.filter(isDefined))),
                    catchError(err => [asError(err)]),
                    startWith(LOADING)
                )
                .subscribe(setFileDiffsOrError)
        )
        return () => subscriptions.unsubscribe()
    }, [thread.id, threadSettings, extensionsController])

    return (
        <div className={`thread-changes-list ${className}`}>
            {isErrorLike(fileDiffsOrError) ? (
                <div className="alert alert-danger mt-2">{fileDiffsOrError.message}</div>
            ) : (
                <>
                    {fileDiffsOrError !== LOADING &&
                        !isErrorLike(fileDiffsOrError) &&
                        /* TODO!(sqs) <WithStickyTop scrollContainerSelector=".thread-area">
                            {({ isStuck }) => (
                                <ThreadInboxItemsNavbar
                                    {...props}
                                    thread={thread}
                                    onThreadUpdate={onThreadUpdate}
                                    threadSettings={threadSettings}
                                    items={fileDiffsOrError}
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
                    {fileDiffsOrError === LOADING ? (
                        <LoadingSpinner className="mt-2" />
                    ) : fileDiffsOrError.length === 0 ? (
                        <p className="p-2 mb-0 text-muted">Inbox is empty.</p>
                    ) : (
                        <div className="d-flex">
                            <Resizable
                                className="sticky-top border-right"
                                handlePosition="right"
                                storageKey="thread-inbox-items-list__sidebar-resizable"
                                defaultSize={216 /* px */}
                                element={
                                    <ThreadInboxSidebar
                                        diagnostics={fileDiffsOrError}
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
                                {fileDiffsOrError.map((fileDiff, i) => (
                                    <li key={i}>
                                        <ThreadChangedFileItem
                                            key={i}
                                            className="m-2"
                                            diff={fileDiff}
                                            headerClassName="thread-changes-list__item-header sticky-top"
                                            headerStyle={{
                                                // TODO!(sqs): this is the hardcoded height of ThreadAreaNavbar
                                                top: '39px',
                                            }}
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
