import H from 'history'
import PencilIcon from 'mdi-react/PencilIcon'
import React, { useCallback, useState } from 'react'
import { ExtensionsControllerProps } from '../../../../../../../shared/src/extensions/controller'
import { WithQueryParameter } from '../../../components/withQueryParameter/WithQueryParameter'
import { ThreadCreatePullRequestsButton } from '../../../form/ThreadCreatePullRequestsButton'
import { threadsQueryWithValues } from '../../../url'
import { ThreadAreaContext } from '../../ThreadArea'
import { ThreadActionsPullRequestsList } from './ThreadActionsPullRequestsList'
import { ThreadPullRequestTemplateEditForm } from './ThreadPullRequestTemplateEditForm'

interface Props extends ThreadAreaContext, ExtensionsControllerProps {
    history: H.History
    location: H.Location
}

/**
 * The page showing commit status actions for a thread.
 */
export const ThreadActionsCommitStatusesPage: React.FunctionComponent<Props> = ({
    thread,
    onThreadUpdate,
    threadSettings,
    ...props
}) => (
    <div>
        <div className="mb-3">
            {isShowingTemplate ? (
                <div className="border rounded p-3">
                    <h2>Pull request template</h2>
                    <ThreadPullRequestTemplateEditForm
                        thread={thread}
                        onThreadUpdate={onThreadUpdate}
                        threadSettings={threadSettings}
                        extraAction={
                            threadSettings.pullRequestTemplate ? (
                                <button type="button" className="btn btn-secondary" onClick={toggleIsShowingTemplate}>
                                    Cancel
                                </button>
                            ) : null
                        }
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="btn btn-secondary d-flex align-items-center"
                    onClick={toggleIsShowingTemplate}
                >
                    <PencilIcon className="icon-inline mr-1" /> Edit pull request template
                </button>
            )}
        </div>
        <WithQueryParameter
            defaultQuery={threadsQueryWithValues('', { is: ['open', 'pending'] })}
            history={props.history}
            location={props.location}
        >
            {({ query, onQueryChange }) => (
                <ThreadActionsPullRequestsList
                    {...props}
                    thread={thread}
                    onThreadUpdate={onThreadUpdate}
                    threadSettings={threadSettings}
                    query={query}
                    onQueryChange={onQueryChange}
                    action={
                        threadSettings.pullRequestTemplate && (
                            <ThreadCreatePullRequestsButton
                                {...props}
                                thread={thread}
                                onThreadUpdate={onThreadUpdate}
                                threadSettings={threadSettings}
                            />
                        )
                    }
                />
            )}
        </WithQueryParameter>
    </div>
)
