import React from 'react'
import { Markdown } from '../../../../../../../shared/src/components/Markdown'
import { renderMarkdown } from '../../../../../../../shared/src/util/markdown'
import { FileDiff } from '../computeDiff'

interface Props {
    diff: FileDiff
    className?: string
    headerClassName?: string
    headerStyle?: React.CSSProperties
}

/**
 * An changed file in a thread
 */
export const ThreadChangedFileItem: React.FunctionComponent<Props> = ({
    diff,
    className = '',
    headerClassName = '',
    headerStyle,
}) => (
    <div className={`card border ${className}`}>
        <header className={`card-header d-flex align-items-start ${headerClassName}`} style={headerStyle}>
            <div className="flex-1">
                <h3 className="mb-0 h6">{diff.newPath || diff.oldPath!}</h3>
            </div>
        </header>
        <Markdown
            dangerousInnerHTML={renderMarkdown('```diff\n' + diff.hunks.map(h => h.body).join('\n') + '\n```')}
            className="overflow-auto"
        />
    </div>
)
