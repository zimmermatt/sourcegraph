import SourcePullIcon from 'mdi-react/SourcePullIcon'
import React from 'react'
import { Markdown } from '../../../../../../../shared/src/components/Markdown'
import { displayRepoName } from '../../../../../../../shared/src/components/RepoFileLink'
import { renderMarkdown } from '../../../../../../../shared/src/util/markdown'
import { ThreadSettings } from '../../../settings'
import { Changeset } from '../../backend'
import { ThreadChangesetFileDiffItem } from './ThreadChangesetFileDiffItem'

interface Props {
    threadSettings: ThreadSettings
    changeset: Changeset
    className?: string
    headerClassName?: string
    headerStyle?: React.CSSProperties
}

/**
 * A changeset file in a thread (consisting of zero or more file diffs).
 */
export const ThreadChangesetItem: React.FunctionComponent<Props> = ({
    changeset,
    className = '',
    headerClassName = '',
    headerStyle,
}) => (
    <div className={`card border ${className}`}>
        <header className={`card-header d-flex align-items-start ${headerClassName}`} style={headerStyle}>
            <div className="flex-1 d-flex align-items-center">
                <SourcePullIcon className="icon-inline mr-2" />
                <h3 className="mb-0 h4">
                    <span className="font-weight-normal">{displayRepoName(changeset.repo)}</span>
                </h3>
            </div>
        </header>
        <div className="card-body">
            <h4>{changeset.pullRequest.title}</h4>
            <Markdown dangerousInnerHTML={renderMarkdown(changeset.pullRequest.description)} />
        </div>
        {changeset.fileDiffs.map((fileDiff, i) => (
            <ThreadChangesetFileDiffItem key={i} fileDiff={fileDiff} />
        ))}
    </div>
)
