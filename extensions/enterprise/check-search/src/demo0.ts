import * as sourcegraph from 'sourcegraph'
import { isDefined } from '../../../../shared/src/util/types'
import { combineLatestOrDefault } from '../../../../shared/src/util/rxjs/combineLatestOrDefault'
import { flatten } from 'lodash'
import { Subscription, Observable, of, Unsubscribable, from } from 'rxjs'
import { map, switchMap, startWith, first, toArray } from 'rxjs/operators'
import { queryGraphQL } from './util'
import * as GQL from '../../../../shared/src/graphql/schema'

export function registerDemo0(): Unsubscribable {
    const subscriptions = new Subscription()
    subscriptions.add(startDiagnostics())
    subscriptions.add(sourcegraph.languages.registerCodeActionProvider(['*'], createCodeActionProvider()))
    return subscriptions
}

function startDiagnostics(): Unsubscribable {
    const subscriptions = new Subscription()

    const diagnosticsCollection = sourcegraph.languages.createDiagnosticCollection('demo0')
    subscriptions.add(diagnosticsCollection)
    subscriptions.add(
        from(sourcegraph.workspace.rootChanges)
            .pipe(
                startWith(void 0),
                map(() => sourcegraph.workspace.roots),
                switchMap(async () => {
                    const results = flatten(
                        await from(
                            sourcegraph.search.findTextInFiles(
                                { pattern: '"import * as react"', type: 'regexp' },
                                {
                                    repositories: { includes: ['sourcegraph$'], type: 'regexp' },
                                    files: {
                                        includes: ['^web/src/.*\\.tsx?$'],
                                        type: 'regexp',
                                    },
                                    maxResults: 10,
                                }
                            )
                        )
                            .pipe(toArray())
                            .toPromise()
                    )
                    return combineLatestOrDefault(
                        results.map(async ({ uri }) => {
                            const { text } = await sourcegraph.workspace.openTextDocument(new URL(uri))
                            const diagnostics: sourcegraph.Diagnostic[] = findMatchRanges(text).map(
                                range =>
                                    ({
                                        message: 'Unnecessary import * from React',
                                        range,
                                        severity: sourcegraph.DiagnosticSeverity.Information,
                                    } as sourcegraph.Diagnostic)
                            )
                            return [new URL(uri), diagnostics] as [URL, sourcegraph.Diagnostic[]]
                        })
                    ).pipe(map(items => items.filter(isDefined))) // .pipe(switchMap(results => flatten<[URL, sourcegraph.Diagnostic[]]>(results)))
                }),
                switchMap(results => results)
            )
            .subscribe(entries => {
                diagnosticsCollection.set(entries)
            })
    )

    return diagnosticsCollection
}

function createCodeActionProvider(): sourcegraph.CodeActionProvider {
    return {
        provideCodeActions: async (doc, _rangeOrSelection, context): Promise<sourcegraph.CodeAction[]> => {
            if (context.diagnostics.length === 0) {
                return []
            }
            const workspaceEdit = new sourcegraph.WorkspaceEdit()
            for (const _diag of context.diagnostics) {
                for (const range of findMatchRanges(doc.text)) {
                    workspaceEdit.replace(new URL(doc.uri), range, "import React from 'react'")
                }
            }
            // for (const [uri, diags] of sourcegraph.languages.getDiagnostics()) {
            //     const doc = await sourcegraph.workspace.openTextDocument(uri)
            //     for (const range of findMatchRanges(doc.text)) {
            //         workspaceEdit.replace(new URL(doc.uri), range, "import React from 'react'")
            //     }
            // }
            return [
                {
                    title: 'Remove unneeded import-star of React',
                    edit: workspaceEdit,
                    diagnostics: flatten(
                        sourcegraph.languages.getDiagnostics().map(([uri, diagnostics]) => diagnostics)
                    ),
                },
            ]
        },
    }
}

function findMatchRanges(text: string): sourcegraph.Range[] {
    const ranges: sourcegraph.Range[] = []
    for (const [i, line] of text.split('\n').entries()) {
        const pat = /^import \* as React from 'react'$/g
        for (let match = pat.exec(line); !!match; match = pat.exec(line)) {
            ranges.push(new sourcegraph.Range(i, match.index, i, match.index + match[0].length))
        }
    }
    return ranges
}
