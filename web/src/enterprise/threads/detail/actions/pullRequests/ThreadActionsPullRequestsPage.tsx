import H from 'history'
import React, { useCallback, useState } from 'react'
import { ExtensionsControllerProps } from '../../../../../../../shared/src/extensions/controller'
import { WithQueryParameter } from '../../../components/withQueryParameter/WithQueryParameter'
import { ThreadCreatePullRequestsButton } from '../../../form/ThreadCreatePullRequestsButton'
import { threadsQueryWithValues } from '../../../url'
import { ThreadAreaContext } from '../../ThreadArea'
import { ThreadActionsPullRequestsList } from './ThreadActionsPullRequestsList'
import { ThreadPullRequestTemplateEditForm } from './ThreadPullRequestTemplateEditForm'
import PencilIcon from 'mdi-react/PencilIcon'

interface Props extends ThreadAreaContext, ExtensionsControllerProps {
    history: H.History
    location: H.Location
}

/**
 * The page showing pull request actions for a single thread.
 */
export const ThreadActionsPullRequestsPage: React.FunctionComponent<Props> = ({
    thread,
    onThreadUpdate,
    threadSettings,
    ...props
}) => {
    const [isShowingTemplate, setIsShowingTemplate] = useState(false)
    const toggleIsShowingTemplate = useCallback(() => setIsShowingTemplate(!isShowingTemplate), [isShowingTemplate])

    return (
        <div className="thread-actions-pull-requests-page">
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
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={toggleIsShowingTemplate}
                                    >
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
}
