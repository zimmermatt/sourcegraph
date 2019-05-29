import { Range } from '@sourcegraph/extension-api-classes'
import { from, Observable } from 'rxjs'
import { map, mapTo, startWith, switchMap } from 'rxjs/operators'
import * as sourcegraph from 'sourcegraph'
import { ExtensionsControllerProps } from '../../../../../shared/src/extensions/controller'
import { gql } from '../../../../../shared/src/graphql/graphql'
import * as GQL from '../../../../../shared/src/graphql/schema'
import { createAggregateError } from '../../../../../shared/src/util/errors'
import { memoizeObservable } from '../../../../../shared/src/util/memoizeObservable'
import { makeRepoURI, parseRepoURI } from '../../../../../shared/src/util/url'
import { queryGraphQL } from '../../../backend/graphql'
import { ThreadSettings } from '../settings'

export interface DiagnosticInfo extends sourcegraph.Diagnostic {
    entry: Pick<GQL.ITreeEntry, 'path' | 'isDirectory' | 'url'> & {
        commit: Pick<GQL.IGitCommit, 'oid'>
        repository: Pick<GQL.IRepository, 'name'>
    } & (Pick<GQL.IGitBlob, '__typename' | 'content'> | Pick<GQL.IGitTree, '__typename'>)
}

// TODO!(sqs): use relative path/rev for DiscussionThreadTargetRepo
const queryCandidateFile = memoizeObservable(
    (uri: URL): Observable<[URL, DiagnosticInfo['entry']]> => {
        const parsed = parseRepoURI(uri.toString())
        return queryGraphQL(
            gql`
                query CandidateFile($repo: String!, $rev: String!, $path: String!) {
                    repository(name: $repo) {
                        commit(rev: $rev) {
                            blob(path: $path) {
                                path
                                content
                                repository {
                                    name
                                }
                                commit {
                                    oid
                                }
                            }
                        }
                    }
                }
            `,
            { repo: parsed.repoName, rev: parsed.rev || parsed.commitID, path: parsed.filePath }
        ).pipe(
            map(({ data, errors }) => {
                if (
                    !data ||
                    !data.repository ||
                    !data.repository.commit ||
                    !data.repository.commit.blob ||
                    (errors && errors.length > 0)
                ) {
                    throw createAggregateError(errors)
                }
                return data.repository.commit.blob
            }),
            map(data => [uri, data] as [URL, DiagnosticInfo['entry']])
        )
    },
    uri => uri.toString()
)

export const queryCandidateFiles = async (uris: URL[]): Promise<[URL, DiagnosticInfo['entry']][]> =>
    Promise.all(uris.map(uri => queryCandidateFile(uri).toPromise()))

export const getDiagnosticInfos = (
    extensionsController: ExtensionsControllerProps['extensionsController']
): Observable<DiagnosticInfo[]> =>
    from(extensionsController.services.diagnostics.collection.changes).pipe(
        mapTo(() => void 0),
        startWith(() => void 0),
        map(() => Array.from(extensionsController.services.diagnostics.collection.entries())),
        switchMap(async diagEntries => {
            const entries = await queryCandidateFiles(diagEntries.map(([url]) => url))
            const m = new Map<string, DiagnosticInfo['entry']>()
            for (const [url, entry] of entries) {
                m.set(url.toString(), entry)
            }
            return diagEntries.flatMap(([url, diag]) => {
                const entry = m.get(url.toString())
                if (!entry) {
                    throw new Error(`no entry for url ${url}`)
                }
                // tslint:disable-next-line: no-object-literal-type-assertion
                return diag.map(d => ({ ...d, entry } as DiagnosticInfo))
            })
        })
    )

export const getCodeActions = (
    diagnostic: DiagnosticInfo,
    extensionsController: ExtensionsControllerProps['extensionsController']
): Observable<sourcegraph.CodeAction[]> =>
    from(
        extensionsController.services.codeActions.getCodeActions({
            textDocument: {
                uri: makeRepoURI({
                    repoName: diagnostic.entry.repository.name,
                    rev: diagnostic.entry.commit.oid,
                    commitID: diagnostic.entry.commit.oid,
                    filePath: diagnostic.entry.path,
                }),
            },
            range: Range.fromPlain(diagnostic.range),
            context: { diagnostics: [diagnostic] },
        })
    ).pipe(map(codeActions => codeActions || []))

export const diagnosticID = (diagnostic: DiagnosticInfo): string =>
    `${diagnostic.entry.path}:${diagnostic.range.start.line}:${diagnostic.range.start.character}:${diagnostic.message}`

export const codeActionID = (codeAction: sourcegraph.CodeAction): string => codeAction.title // TODO!(sqs): codeAction.title is not guaranteed unique

export const getActiveCodeAction0 = (
    diagnostic: DiagnosticInfo,
    threadSettings: ThreadSettings,
    codeActions: sourcegraph.CodeAction[]
): sourcegraph.CodeAction | undefined => {
    const activeCodeActionID =
        threadSettings && threadSettings.actions && threadSettings.actions[diagnosticID(diagnostic)]
    return codeActions.find(a => codeActionID(a) === activeCodeActionID) || codeActions[0]
}

export const getActiveCodeAction = (
    diagnostic: DiagnosticInfo,
    extensionsController: ExtensionsControllerProps['extensionsController'],
    threadSettings: ThreadSettings
): Observable<sourcegraph.CodeAction | undefined> =>
    getCodeActions(diagnostic, extensionsController).pipe(
        map(codeActions => getActiveCodeAction0(diagnostic, threadSettings, codeActions))
    )
