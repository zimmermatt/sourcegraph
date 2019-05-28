import { applyEdits } from '@sqs/jsonc-parser'
import { createTwoFilesPatch } from 'diff'
import { WorkspaceEdit } from 'sourcegraph'
import { positionToOffset } from '../../../../../../shared/src/api/client/types/textDocument'
import { ExtensionsControllerProps } from '../../../../../../shared/src/extensions/controller'

export async function computeWorkspaceEditDiff(
    { services: { fileSystem } }: ExtensionsControllerProps['extensionsController'],
    workspaceEdit: WorkspaceEdit
): Promise<{ diff: string }> {
    const fileDiffs: { oldPath: string; newPath: string; oldText: string; newText: string }[] = []
    for (const [uri, edits] of workspaceEdit.textEdits()) {
        const oldText = await fileSystem.readFile(uri)
        fileDiffs.push({
            oldPath: uri.toString(),
            newPath: uri.toString(),
            oldText,
            newText: applyEdits(
                oldText,
                edits.map(edit => {
                    // TODO!(sqs): doesnt account for multiple edits
                    const startOffset = positionToOffset(oldText, edit.range.start)
                    const endOffset = positionToOffset(oldText, edit.range.end)
                    return { offset: startOffset, length: endOffset - startOffset, content: edit.newText }
                })
            ),
        })
    }
    return {
        diff: fileDiffs
            .map(fileDiff =>
                createTwoFilesPatch(
                    fileDiff.oldPath,
                    fileDiff.newPath,
                    fileDiff.oldText,
                    fileDiff.newText,
                    undefined,
                    undefined,
                    { context: 0 }
                )
                    .split('\n')
                    .slice(4, -1)
                    .join('\n')
            )
            .join('\n'),
    }
}
