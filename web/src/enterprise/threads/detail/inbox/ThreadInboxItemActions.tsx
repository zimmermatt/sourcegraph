import H from 'history'
import PlayCircleOutlineIcon from 'mdi-react/PlayCircleOutlineIcon'
import React from 'react'
import { CodeAction } from 'sourcegraph'
import { ExtensionsControllerProps } from '../../../../../../shared/src/extensions/controller'
import * as GQL from '../../../../../../shared/src/graphql/schema'
import { ThreadSettings } from '../../settings'

interface Props extends ExtensionsControllerProps {
    thread: Pick<GQL.IDiscussionThread, 'id' | 'idWithoutKind' | 'settings'>
    onThreadUpdate: (thread: GQL.IDiscussionThread) => void
    threadSettings: ThreadSettings

    codeActions: CodeAction[]
    activeCodeAction: CodeAction | undefined
    onCodeActionActivate: (codeAction: CodeAction) => void

    className?: string
    buttonClassName?: string
    inactiveButtonClassName?: string
    activeButtonClassName?: string
    history: H.History
    location: H.Location
}

/**
 * The actions that can be performed on an item in a thread inbox.
 */
// tslint:disable: jsx-no-lambda
export const ThreadInboxItemActions: React.FunctionComponent<Props> = ({
    codeActions,
    activeCodeAction,
    onCodeActionActivate: onCodeActionClick,
    className,
    buttonClassName = 'btn btn-link text-decoration-none',
    inactiveButtonClassName,
    activeButtonClassName,
}) => {
    const a = 123
    return (
        <div className={`d-flex align-items-center ${className}`}>
            {/* <PlayCircleOutlineIcon className="icon-inline text-muted mr-2 mb-2" aria-label="Actions" /> */}
            <label className="mr-2 mb-2 text-muted">Actions:</label>
            {codeActions.map((codeAction, i) => (
                <button
                    key={i}
                    onClick={() => onCodeActionClick(codeAction)}
                    className={`${buttonClassName} ${
                        codeAction === activeCodeAction ? activeButtonClassName : inactiveButtonClassName
                    } mr-2 mb-2`}
                >
                    {codeAction.title}
                </button>
            ))}
        </div>
    )
}
