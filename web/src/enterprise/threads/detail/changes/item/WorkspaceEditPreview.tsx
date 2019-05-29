import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import React, { useState } from 'react'
import * as sourcegraph from 'sourcegraph'
import { ExtensionsControllerProps } from '../../../../../../../shared/src/extensions/controller'
import { asError, ErrorLike, isErrorLike } from '../../../../../../../shared/src/util/errors'
import { useEffectAsync } from '../../../../../util/useEffectAsync'
import { computeWorkspaceEditDiff } from './computeWorkspaceEditDiff'
import { Markdown } from '../../../../../../../shared/src/components/Markdown'
import { renderMarkdown } from '../../../../../../../shared/src/util/markdown'

interface Props extends ExtensionsControllerProps {
    // TODO!(sqs): cant show file create/rename/delete operations unless we use our internal
    // WorkspaceEdit type's #operations field.
    workspaceEdit: sourcegraph.WorkspaceEdit

    className?: string
}

const LOADING: 'loading' = 'loading'

/**
 * Previews a workspace edit's changes.
 */
export const WorkspaceEditPreview: React.FunctionComponent<Props> = ({
    workspaceEdit,
    className = '',
    extensionsController,
}) => {
    const [rawDiff, setRawDiff] = useState<typeof LOADING | { diff: string } | ErrorLike>(LOADING)
    useEffectAsync(async () => {
        setRawDiff(LOADING)
        try {
            setRawDiff(await computeWorkspaceEditDiff(extensionsController, workspaceEdit))
        } catch (err) {
            setRawDiff(asError(err))
        }
    }, [workspaceEdit, extensionsController])

    return rawDiff === LOADING ? (
        <LoadingSpinner className="icon-inline" />
    ) : isErrorLike(rawDiff) ? (
        <span className="text-danger">{rawDiff.message}</span>
    ) : (
        <Markdown dangerousInnerHTML={renderMarkdown('```diff\n' + rawDiff.diff + '\n```')} className={className} />
    )
}
