import H from 'history'
import CheckboxBlankCirckeOutlineIcon from 'mdi-react/CheckboxBlankCircleOutlineIcon'
import CheckboxMarkedCircleOutlineIcon from 'mdi-react/CheckboxMarkedCircleOutlineIcon'
import DotsHorizontalIcon from 'mdi-react/DotsHorizontalIcon'
import PlayCircleOutlineIcon from 'mdi-react/PlayCircleOutlineIcon'
import React, { useCallback, useState } from 'react'
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
    onCodeActionActivate: (codeAction: CodeAction | undefined) => void

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
    const codeActionsWithEdit = codeActions.filter(({ edit }) => !!edit)
    const codeActionsWithCommand = codeActions.filter(({ command }) => !!command)

    const [showCommands, setShowCommands] = useState(false)
    const toggleShowCommands = useCallback(() => setShowCommands(!showCommands), [showCommands])

    return (
        <div className={className}>
            <div className={`d-flex align-items-center`}>
                {/* <PlayCircleOutlineIcon className="icon-inline text-muted mr-2 mb-2" aria-label="Fixes" /> */}
                <label className="mr-2 mb-2 text-muted">Fix:</label>
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    {codeActionsWithEdit.map((codeAction, i) => (
                        <label
                            key={i}
                            className={`d-flex align-items-center ${buttonClassName} ${
                                codeAction === activeCodeAction ? activeButtonClassName : inactiveButtonClassName
                            } mr-2 mb-2`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onCodeActionClick(codeAction)}
                        >
                            <input
                                type="radio"
                                autoComplete="off"
                                checked={codeAction === activeCodeAction}
                                onChange={e => onCodeActionClick(e.currentTarget.checked ? codeAction : undefined)}
                            />{' '}
                            {codeAction === activeCodeAction ? (
                                <CheckboxMarkedCircleOutlineIcon className="icon-inline small mr-1" />
                            ) : (
                                <CheckboxBlankCirckeOutlineIcon className="icon-inline small mr-1" />
                            )}{' '}
                            {codeAction.title}
                        </label>
                    ))}
                </div>
                <button
                    type="button"
                    className={`${buttonClassName} d-flex align-items-center btn-link text-decoration-none mr-2 mb-2`}
                    onClick={toggleShowCommands}
                    data-tooltip="Other actions..."
                >
                    <DotsHorizontalIcon className="icon-inline text-muted" aria-label="Actions" />
                </button>
            </div>
            <div className={`d-flex align-items-center`}>
                {showCommands && (
                    <ul className="list-unstyled mb-0 d-flex flex-wrap">
                        {codeActionsWithCommand.map((codeAction, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`${buttonClassName} ${inactiveButtonClassName} mr-2 mb-2`}
                                onClick={() => onCodeActionClick(codeAction)}
                            >
                                {codeAction.title}
                            </button>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
