import { Range } from '@sourcegraph/extension-api-classes'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import H from 'history'
import React, { useEffect, useState } from 'react'
import { from, Subscription } from 'rxjs'
import { catchError, map, startWith } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { LinkOrSpan } from '../../../../../../../shared/src/components/LinkOrSpan'
import { displayRepoName } from '../../../../../../../shared/src/components/RepoFileLink'
import { ExtensionsControllerProps } from '../../../../../../../shared/src/extensions/controller'
import * as GQL from '../../../../../../../shared/src/graphql/schema'
import { PlatformContextProps } from '../../../../../../../shared/src/platform/context'
import { asError, ErrorLike, isErrorLike } from '../../../../../../../shared/src/util/errors'
import { makeRepoURI } from '../../../../../../../shared/src/util/url'
import { DiagnosticSeverityIcon } from '../../../../../diagnostics/components/DiagnosticSeverityIcon'
import { ThreadSettings } from '../../../settings'
import { ThreadInboxItemActions } from './actions/ThreadInboxItemActions'
import { WorkspaceEditPreview } from './WorkspaceEditPreview'
import { DiagnosticInfo, getCodeActions } from '../../backend'

const LOADING: 'loading' = 'loading'

interface Props extends ExtensionsControllerProps, PlatformContextProps {
    thread: Pick<GQL.IDiscussionThread, 'id' | 'idWithoutKind' | 'settings'>
    onThreadUpdate: (thread: GQL.IDiscussionThread) => void
    threadSettings: ThreadSettings
    diagnostic: DiagnosticInfo
    className?: string
    headerClassName?: string
    headerStyle?: React.CSSProperties
    isLightTheme: boolean
    history: H.History
    location: H.Location
}

/**
 * An inbox item in a thread that refers to a file.
 */
export const ThreadInboxFileItem: React.FunctionComponent<Props> = ({
    diagnostic,
    className = '',
    headerClassName = '',
    headerStyle,
    isLightTheme,
    extensionsController,
    ...props
}) => {
    const [codeActionsOrError, setCodeActionsOrError] = useState<typeof LOADING | sourcegraph.CodeAction[] | ErrorLike>(
        LOADING
    )
    // tslint:disable-next-line: no-floating-promises
    useEffect(() => {
        const subscriptions = new Subscription()
        subscriptions.add(
            getCodeActions(diagnostic, extensionsController)
                .pipe(
                    catchError(err => [asError(err)]),
                    startWith(LOADING)
                )
                .subscribe(setCodeActionsOrError)
        )
        return () => subscriptions.unsubscribe()
    }, [diagnostic, extensionsController])

    const [activeCodeAction, setActiveCodeAction] = useState<sourcegraph.CodeAction | undefined>()
    useEffect(() => {
        setActiveCodeAction(
            codeActionsOrError !== LOADING && !isErrorLike(codeActionsOrError) && codeActionsOrError.length > 0
                ? codeActionsOrError[0]
                : undefined
        )
    }, [codeActionsOrError])

    return (
        <div className={`card border ${className}`}>
            <header className={`card-header d-flex align-items-start ${headerClassName}`} style={headerStyle}>
                <div className="flex-1">
                    <h3 className="mb-0 h6">
                        <LinkOrSpan to={diagnostic.entry.url || 'TODO!(sqs)'} className="d-block">
                            {diagnostic.entry.path ? (
                                <>
                                    <span className="font-weight-normal">
                                        {displayRepoName(diagnostic.entry.repository.name)}
                                    </span>{' '}
                                    › {diagnostic.entry.path}
                                </>
                            ) : (
                                displayRepoName(diagnostic.entry.repository.name)
                            )}
                        </LinkOrSpan>
                    </h3>
                    {/* TODO!(sqs) <small className="text-muted">
                        Changed {formatDistance(Date.parse(item.updatedAt), Date.now())} ago by{' '}
                        <strong>{item.updatedBy}</strong>
                            </small> */}
                </div>
                {/* TODO!(sqs)<div>
                    {item.commentsCount > 0 && (
                        <ul className="list-inline d-flex align-items-center">
                            <li className="list-inline-item">
                                <small className="text-muted">
                                    <MessageOutlineIcon className="icon-inline" /> {item.commentsCount}
                                </small>
                            </li>
                        </ul>
                    )}
                    </div>*/}
            </header>
            <div className="d-flex align-items-center mt-2 mx-2 mb-1">
                <DiagnosticSeverityIcon severity={diagnostic.severity} className="icon-inline mr-1" />
                <span>{diagnostic.message}</span>
            </div>
            {codeActionsOrError === LOADING ? (
                <LoadingSpinner className="icon-inline" />
            ) : isErrorLike(codeActionsOrError) ? (
                <span className="text-danger">{codeActionsOrError.message}</span>
            ) : (
                <>
                    <ThreadInboxItemActions
                        {...props}
                        codeActions={codeActionsOrError}
                        activeCodeAction={activeCodeAction}
                        onCodeActionActivate={setActiveCodeAction}
                        className="px-2 pt-2 pb-0"
                        buttonClassName="btn px-1 py-0 text-decoration-none"
                        inactiveButtonClassName="btn-link"
                        activeButtonClassName="btn-primary"
                        extensionsController={extensionsController}
                    />
                    {activeCodeAction ? (
                        activeCodeAction.edit ? (
                            <WorkspaceEditPreview
                                key={JSON.stringify(activeCodeAction.edit)}
                                {...props}
                                workspaceEdit={activeCodeAction.edit}
                                extensionsController={extensionsController}
                                className="overflow-auto"
                            />
                        ) : (
                            'no edit'
                        )
                    ) : (
                        'no active code action'
                    )}
                </>
            )}
        </div>
    )
}
