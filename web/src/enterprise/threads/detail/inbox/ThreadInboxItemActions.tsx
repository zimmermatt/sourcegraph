import H from 'history'
import PencilIcon from 'mdi-react/PencilIcon'
import PlayCircleOutlineIcon from 'mdi-react/PlayCircleOutlineIcon'
import SourceCommitIcon from 'mdi-react/SourceCommitIcon'
import React, { useState } from 'react'
import { CodeAction } from 'sourcegraph'
import { ChatIcon } from '../../../../../../shared/src/components/icons'
import { ExtensionsControllerProps } from '../../../../../../shared/src/extensions/controller'
import * as GQL from '../../../../../../shared/src/graphql/schema'
import { DiscussionsCreate } from '../../../../repo/blob/discussions/DiscussionsCreate'
import { ThreadSettings } from '../../settings'
import { ThreadInboxItemAddToPullRequest } from './actions/addToPullRequest/ThreadInboxItemAddToPullRequest'
import { ThreadInboxItemSlackMessage } from './actions/slackMessage/ThreadInboxItemSlackMessage'
import { ThreadInboxItemIgnoreButton } from './ThreadInboxItemIgnoreButton'

interface Props extends ExtensionsControllerProps {
    thread: Pick<GQL.IDiscussionThread, 'id' | 'idWithoutKind' | 'settings'>
    onThreadUpdate: (thread: GQL.IDiscussionThread) => void
    threadSettings: ThreadSettings

    codeActions: CodeAction[]
    activeCodeAction: CodeAction | undefined
    onCodeActionActivate: (codeAction: CodeAction) => void

    className?: string
    buttonClassName?: string
    history: H.History
    location: H.Location
}

/**
 * The actions that can be performed on an item in a thread inbox.
 */
// tslint:disable: jsx-no-lambda
export const ThreadInboxItemActions: React.FunctionComponent<Props> = ({
    thread,
    onThreadUpdate,
    threadSettings,
    codeActions,
    activeCodeAction,
    onCodeActionActivate: onCodeActionClick,
    className,
    buttonClassName = 'btn btn-link text-decoration-none',
    history,
    location,
    extensionsController,
}) => {
    const a = 123
    return (
        <div className={`d-flex align-items-center ${className}`}>
            <PlayCircleOutlineIcon className="icon-inline text-muted" aria-label="Actions" />
            {/* <label className="mb-0 text-muted">Actions</label> */}
            {codeActions.map((codeAction, i) => (
                <button key={i} onClick={() => onCodeActionClick(codeAction)} className={buttonClassName}>
                    {codeAction.title}
                </button>
            ))}
        </div>
    )
}
