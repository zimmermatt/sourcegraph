import { Range } from '@sourcegraph/extension-api-classes'
import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import React, { useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { first, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { ExtensionsControllerProps } from '../../../../../../../shared/src/extensions/controller'
import { getModeFromPath } from '../../../../../../../shared/src/languages'
import { asError, ErrorLike, isErrorLike } from '../../../../../../../shared/src/util/errors'
import { fetchBlob } from '../../../../../repo/blob/BlobPage'
import { useEffectAsync } from '../../../../../util/useEffectAsync'
import { computeWorkspaceEditDiff } from './computeWorkspaceEditDiff'
import { FileDiffNode } from '../../../../../repo/compare/FileDiffNode'
import { FileDiffHunks } from '../../../../../repo/compare/FileDiffHunks'
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
